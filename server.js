const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const FormData = require("form-data");

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer();

const CLOUDINARY_CLOUD_NAME = "dto7bji6b";
const CLOUDINARY_UPLOAD_PRESET = "payment_screenshots";

app.get("/", (req, res) => {
  res.send("Hello World");
});

async function getAccessToken() {
  try {
    const response = await axios.post(
      "https://accounts.zoho.in/oauth/v2/token",
      null,
      {
        params: {
          refresh_token: process.env.ZOHO_REFRESH_TOKEN,
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          grant_type: "refresh_token",
        },
      },
    );
    return response.data.access_token;
  } catch (error) {
    console.error(
      "Token Refresh Failed:",
      error.response?.data || error.message,
    );
    throw new Error("Unable to refresh access token");
  }
}

function arrToStr(val) {
  if (Array.isArray(val)) return val.filter(Boolean).join(", ");
  return val || "";
}

async function uploadToCloudinary(images) {
  try {
    if (!images) return "";

    const imageArray = Array.isArray(images) ? images : [images];
    const uploadedUrls = [];

    for (const img of imageArray) {
      const fd = new FormData();
      fd.append("file", img);
      fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      fd.append("folder", "aadhaar_uploads");

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        fd,
        { headers: fd.getHeaders() },
      );

      uploadedUrls.push(res.data.secure_url);
    }

    return uploadedUrls.join(", ");
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    return "";
  }
}

/* -------------------------
   DEMAND FORM
-------------------------- */

app.post("/submit-jotform-demand", upload.any(), async (req, res) => {
  try {
    const body = req.body;

    console.log(
      "JotForm Demand webhook received:",
      JSON.stringify(body, null, 2),
    );

    let raw = {};

    if (body?.rawRequest) {
      raw =
        typeof body.rawRequest === "string"
          ? JSON.parse(body.rawRequest)
          : body.rawRequest;
    } else {
      raw = body || {};
    }

    console.log("Parsed JotForm Demand:", JSON.stringify(raw, null, 2));

    let paymentImageUrl = "";

    if (raw.uploadPayment) {
      paymentImageUrl = await uploadToCloudinary(raw.uploadPayment);
    }

    console.log("Cloudinary Payment URL:", paymentImageUrl);

    const zohoData = {
      Full_Name:
        `${raw.q5_name?.first || ""} ${raw.q5_name?.last || ""}`.trim(),
      Mobile_Number:
        raw.q6_phoneNumber?.full || raw.q4_phoneNumber?.phone || "",
      Email: raw.q64_email || "",
      Street_Address: raw.q65_address?.addr_line1 || "",
      City: raw.q65_address?.city || "",
      State: raw.q65_address?.state || "",
      Pincode: raw.q65_address?.postal || "",
      Service_Type: raw.q59_serviceType || "",
      Service_Label: raw.q9_serviceLabel || "",
      Service_Format: raw.q60_serviceFormat || "",
      Tasks_Needed: arrToStr(raw.q23_tasks),
      Monthly_Budget: raw.q68_budget || "",
      Urgency: raw.q61_urgency || "",
      Special_Instructions: raw.q70_instructions || "",

      Plan_Type: raw.q95_howDo || "",
      Payment_Screenshot: paymentImageUrl,
      Payment_Status: paymentImageUrl ? "Uploaded" : "",
    };

    const accessToken = await getAccessToken();

    const response = await axios.post(
      "https://creator.zoho.in/api/v2/support_domesticpro/helpermatch-system/form/HouseholdRequests",
      { data: zohoData },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Zoho Response:", response.data);

    res.status(200).json({
      message: "JotForm demand submitted successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Zoho Error:", error.response?.data || error.message);

    res.status(500).json({
      message: "Zoho API failed",
      error: error.response?.data || error.message,
    });
  }
});

/* -------------------------
   SUPPLY FORM (AADHAAR)
-------------------------- */

app.post("/submit-jotform", upload.any(), async (req, res) => {
  try {
    const body = req.body;

    console.log("Webhook body:", JSON.stringify(body, null, 2));

    let raw = {};

    if (body?.rawRequest) {
      raw =
        typeof body.rawRequest === "string"
          ? JSON.parse(body.rawRequest)
          : body.rawRequest;
    } else {
      raw = body || {};
    }

    console.log("Parsed JotForm:", JSON.stringify(raw, null, 2));

    let Aadhaar_Card = "";

    if (raw.fileUpload) {
      Aadhaar_Card = await uploadToCloudinary(raw.fileUpload);
    }

    console.log("Cloudinary Aadhaar URLs:", Aadhaar_Card);

    const zohoData = {
      Full_Name:
        `${raw.q5_name?.first || ""} ${raw.q5_name?.last || ""}`.trim(),
      Mobile_Number: raw.q6_phoneNumber?.full || "",
      Gender1: raw.q8_typeA || "",
      Age: raw.q9_number || "",
      Marital_Status: raw.q10_typeA10 || "",
      Street_Address: raw.q64_currentAddress?.addr_line1 || "",
      Current_City: raw.q64_currentAddress?.city || "",
      State: raw.q64_currentAddress?.state || "",
      City: raw.q40_preferredWork || "",
      Native_City: raw.q12_nativeCity || "",

      Service_Type: raw.q59_whichType || "",
      Service_Format: raw.q60_workType || "",
      Monthly_Budget: raw.q38_typeA38 || "",
      Experience_Required: raw.q16_number16 || "",
      Urgency: raw.q61_availability || "",

      Tasks_Needed: arrToStr(raw.q23_typeA23),

      Aadhaar_Card: Aadhaar_Card,

      Form_Submission_ID: body.submissionID || "",
      IP_Address: body.ip || "",
      Form_Title: body.formTitle || "",
    };

    const accessToken = await getAccessToken();

    const response = await axios.post(
      "https://creator.zoho.in/api/v2/support_domesticpro/helpermatch-system/form/Helpers1",
      { data: zohoData },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Zoho Response:", response.data);

    res.status(200).json({
      message: "JotForm supplier submitted successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("Zoho Error:", error.response?.data || error.message);

    res.status(500).json({
      message: "Zoho API failed",
      error: error.response?.data || error.message,
    });
  }
});

app.listen(5000, () => console.log("Backend running on port 5000"));

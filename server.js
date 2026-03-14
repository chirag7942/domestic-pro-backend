const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

dotenv.config();

const app = express();

app.use(cors());

// IMPORTANT for Jotform webhooks
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer();
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

app.post("/submit", async (req, res) => {
  try {
    const body = req.body;
    console.log("Demand form submission:", JSON.stringify(body, null, 2));
    const accessToken = await getAccessToken();
    const zohoData = {
      Full_Name: `${body.FirstName || ""} ${body.LastName || ""}`.trim(),
      First_Name: body.FirstName || "",
      Last_Name: body.LastName || "",
      Mobile_Number: body.Phone || "",
      Email: body.Email || "",
      Street_Address: body.Street || "",
      City: body.City || "",
      State: body.State || "",
      Pincode: body.Pincode || "",
      Service_Type: body.ServiceType || "",
      Service_Label: body.ServiceLabel || "",
      Service_Format: body.ServiceFormat || "",
      Tasks_Needed: arrToStr(body.Tasks),
      House_Size: body.HouseSize || "",
      People_At_Home: body.PeopleAtHome || "",
      Pets_At_Home: body.PetsAtHome || "",
      Meal_Preferences: body.MealPref || "",
      Meals_Needed: arrToStr(body.MealsNeeded),
      Cuisine_Preference: arrToStr(body.CuisinePref),
      Child_Age: body.ChildAge || "",
      Child_Duties: arrToStr(body.ChildDuties),
      Patient_Age: body.PatientAge || "",
      Patient_Gender: body.PatientGender || "",
      Care_Needed: arrToStr(body.CareNeeded),
      Vehicle_Type: arrToStr(body.VehicleType),
      Experience_Required: body.ExperienceRequired || "",
      Manager_Duties: arrToStr(body.ManagerDuties),
      Home_Type: body.HomeType || "",
      Multi_Services: arrToStr(body.MultiServices),
      Monthly_Budget: body.Budget || "",
      Urgency: body.Urgency || "",
      Plan_Type: body.PlanType || "",
      Payment_Status: body.PaymentStatus || "",
      Special_Instructions: body.Instructions || "",
      Payment_Screenshot: body.ScreenshotUrl || "",
    };
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
    console.log(
      "Zoho Response (Demand):",
      JSON.stringify(response.data, null, 2),
    );
    res
      .status(200)
      .json({ message: "Submitted successfully", data: response.data });
  } catch (error) {
    console.error(
      "Zoho Error (Demand):",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: "Zoho API failed",
      error: error.response?.data || error.message,
    });
  }
});

// JOTFORM DEMAND WEBHOOK — paste this into server.js
// Receives JotForm webhook → maps fields → sends to Zoho

app.post("/submit-jotform-demand", upload.any(), async (req, res) => {
  try {
    const body = req.body;
    console.log(
      "JotForm Demand webhook received:",
      JSON.stringify(body, null, 2),
    );

    // Parse rawRequest (JotForm sends data nested here)
    let raw = {};
    if (body?.rawRequest) {
      raw =
        typeof body.rawRequest === "string"
          ? JSON.parse(body.rawRequest)
          : body.rawRequest;
    } else {
      raw = body || {};
    }

    console.log("Parsed JotForm Demand data:", JSON.stringify(raw, null, 2));

    // ── Map JotForm fields to your existing Zoho schema ──────────────────────
    // UPDATE the q-numbers below to match your actual JotForm demand form fields
    // (Open your JotForm form → right-click any field → "Inspect" to find q-numbers)
    const zohoData = {
      Full_Name:
        `${raw.q5_name?.first || ""} ${raw.q5_name?.last || ""}`.trim(),
      Mobile_Number:
        raw.q6_phoneNumber?.full || raw.q4_phoneNumber?.phone || "",
      Email: raw.q64_email || "",
      Street_Address: raw.q65_address?.addr_line1 || "",
      City: raw.q65_address?.city || raw.q65_city || "",
      State: raw.q65_address?.state || raw.q65_state || "",
      Pincode: raw.q65_address?.postal || raw.q65_pincode || "",
      Service_Type: raw.q59_serviceType || "",
      Service_Label: raw.q9_serviceLabel || "",
      Service_Format: raw.q60_serviceFormat || "",
      Tasks_Needed: arrToStr(raw.q23_tasks),
      House_Size: raw.q66_houseSize || "",
      People_At_Home: raw.q67_peopleAtHome || "",
      Pets_At_Home: raw.q62_petsAtHome || "",
      Meal_Preferences: raw.q20_mealPref || "",
      // Meals_Needed: arrToStr(raw.q16_mealsNeeded),
      Cuisine_Preference: arrToStr(raw.q19_cuisinePref),
      Child_Age: raw.q72_childsAge || "",
      Child_Duties: arrToStr(raw.q45_childDuties),
      Patient_Age: raw.q73_patientAge || "",
      Patient_Gender: raw.q53_patientGender || "",
      Care_Needed: arrToStr(raw.q54_careNeeded),
      Vehicle_Type: arrToStr(raw.q21_vehicleType),
      Manager_Duties: arrToStr(raw.q55_managerDuties),
      Home_Type: raw.q57_homeType || "",
      Multi_Services: arrToStr(raw.q15_multiServices),
      Monthly_Budget: raw.q68_budget || "",
      Urgency: raw.q61_urgency || "",
      Special_Instructions: raw.q70_instructions || "",

      // JotForm-only fields (no payment in JotForm demand form)
      Plan_Type: "jotform_submission",
      Payment_Status: "Not Applicable",
      Payment_Screenshot: "",
    };

    console.log(
      "Sending to Zoho (JotForm Demand):",
      JSON.stringify(zohoData, null, 2),
    );

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

    console.log(
      "Zoho Response (JotForm Demand):",
      JSON.stringify(response.data, null, 2),
    );

    res.status(200).json({
      message: "JotForm demand submitted successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Zoho Error (JotForm Demand):",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: "Zoho API failed",
      error: error.response?.data || error.message,
    });
  }
});

app.post("/submit-jotform", upload.any(), async (req, res) => {
  try {
    console.log("Body:", req.body);
    console.log("Files:", req.files);
    const body = req.body;

    console.log("Webhook body:", JSON.stringify(body, null, 2));

    let raw = {};

    if (body && body.$return_value && body.$return_value.rawRequest) {
      raw = body.$return_value.rawRequest;
    } else if (body && body.rawRequest) {
      raw =
        typeof body.rawRequest === "string"
          ? JSON.parse(body.rawRequest)
          : body.rawRequest;
    } else {
      raw = body || {};
    }

    console.log("Parsed JotForm data:", JSON.stringify(raw, null, 2));
    const accessToken = await getAccessToken();
    const zohoData = {
      // COMMON
      Full_Name:
        `${raw.q5_name?.first || ""} ${raw.q5_name?.last || ""}`.trim(),
      Mobile_Number: raw.q6_phoneNumber?.full || "",
      Gender1: raw.q8_typeA || "",
      Age: raw.q9_number || "",
      Marital_Status: raw.q10_typeA10 || "", // "Yes" or "No"
      Street_Address: raw.q64_currentAddress?.addr_line1 || "",
      Current_City: raw.q64_currentAddress?.city || raw.q65_city || "",
      State: raw.q64_currentAddress?.state || raw.q65_state || "",
      City: raw.q40_preferredWork || "", // e.g. "Gurgaon, Delhi, Noida"
      Native_City: raw.q12_nativeCity || "",
      // ── Job Details ───────────────────────────────────────────────────────
      Service_Type: raw.q59_whichType || "", // "House Help", "Cook", "Driver" etc.
      Service_Format: raw.q60_workType || "", // "Live-In", "Live-Out", "Substitute"
      Monthly_Budget: raw.q38_typeA38 || "",
      Experience_Required: raw.q16_number16 || "",
      Urgency: raw.q61_availability || "",

      // HOUSE HELP
      Tasks_Needed: arrToStr(raw.q23_typeA23), // Work tasks — comes as array: ["Cleaning", "Utensils", "Laundry"]
      House_Size: raw.q49_experienceWith || "", // "1 BHK", "2 BHK" etc.
      People_At_Home: raw.q50_comfortableWorking || "", // number as string
      Pets_At_Home: raw.q62_comfortableWith || "", // "Yes" or "No"

      // BABYSITTER
      Child_Age: arrToStr(raw.q17_typeA17),
      Child_Duties: arrToStr(raw.q45_skills),

      // COOK
      Cuisine_Preference: arrToStr(raw.q19_typeA19),
      Meal_Preferences: raw.q20_typeA20 || "",

      // DRIVER
      Vehicle_Type: arrToStr(raw.q21_typeA21),
      Driving_License: raw.q22_typeA22 || "",

      // ELDERLY CARE
      Patient_Age: raw.q52_experienceWith52 || "",
      Patient_Gender: raw.q53_comfortableCaring || "",
      Care_Needed: arrToStr(raw.q54_careSkills),

      // HOUSE MANAGER
      Multi_Services: raw.q15_typeA15 || "",
      Responsibilities: arrToStr(raw.q55_responsibilitiesYou),
      Home_Type: raw.q57_experienceWith57 || "",

      // INTERVIEW ASSESSMENT (Page 2 - all services)
      Understands_Instructions: raw.q63_understandsInstructions,
      Overall_Attitude: raw.q30_typeA30 || "",
      Punctuality: raw.q31_typeA31 || "",
      Personal_Hygiene: raw.q32_typeA32 || "",

      // VERIFICATION (Page 3 - all services)
      Domestic_Pro_Verified: raw.q33_typeA33 || "",

      // DOCUMENT UPLOADS
      Aadhaar_Card: Array.isArray(raw.fileUpload)
        ? raw.fileUpload.join(", ")
        : raw.fileUpload || "",

      Photograph: Array.isArray(raw.fileUpload25)
        ? raw.fileUpload25.join(", ")
        : raw.fileUpload25 || "",

      // METADATA
      Form_Submission_ID: body.submissionID || "",
      IP_Address: body.ip || "",
      Form_Title: body.formTitle || "",
    };

    console.log("Sending to Zoho (Supply):", JSON.stringify(zohoData, null, 2));

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

    console.log(
      "Zoho Response (Supply):",
      JSON.stringify(response.data, null, 2),
    );
    res.status(200).json({
      message: "JotForm supplier submitted successfully",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Zoho Error (Supply):",
      error.response?.data || error.message,
    );
    res.status(500).json({
      message: "Zoho API failed",
      error: error.response?.data || error.message,
    });
  }
});

// PDF GENERATION

let pdfBusy = false;
let lastPdfBuffer = null; // ← stores the most recently generated PDF
let lastPdfFilename = "last.pdf";

app.post("/generate-pdf", async (req, res) => {
  if (pdfBusy) {
    return res.status(429).json({
      message: "PDF render in progress, retry in 10 seconds",
    });
  }

  pdfBusy = true;
  let browser = null;

  try {
    const { html, filename } = req.body;

    if (!html) {
      pdfBusy = false;
      return res.status(400).json({ message: "HTML content is required" });
    }

    console.log(`PDF started — ${filename}`);
    console.log(`HTML size: ${(html.length / 1024).toFixed(1)} KB`);

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
      printBackground: true,
    });

    await browser.close();
    browser = null;
    pdfBusy = false;

    console.log(`PDF done — ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // ── Save for /last-pdf preview ──
    lastPdfBuffer = pdfBuffer;
    lastPdfFilename = filename || "document.pdf";
    console.log(`PDF saved to /last-pdf for preview`);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename || "document.pdf"}"`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    pdfBusy = false;
    console.error("PDF Error:", error.message);
    res.status(500).json({
      message: "PDF generation failed",
      error: error.message,
    });
  }
});

// LAST PDF PREVIEW — open in browser to see latest PDF
app.get("/last-pdf", (req, res) => {
  if (!lastPdfBuffer) {
    return res.status(404).send(`
      <html><body style="font-family:Arial;padding:40px;text-align:center;">
        <h2>No PDF generated yet</h2>
        <p>Trigger your Zoho workflow first, then open this URL again.</p>
      </body></html>
    `);
  }

  console.log(`/last-pdf viewed — serving: ${lastPdfFilename}`);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${lastPdfFilename}"`,
    "Content-Length": lastPdfBuffer.length,
  });

  res.send(lastPdfBuffer);
});

// LOGGING ENDPOINT — receives logs from Zoho Deluge
app.post("/log", (req, res) => {
  const { level = "INFO", message, data } = req.body;
  const timestamp = new Date().toISOString();

  if (data) {
    console.log(
      `[${timestamp}] [ZOHO-${level}] ${message}`,
      JSON.stringify(data, null, 2),
    );
  } else {
    console.log(`[${timestamp}] [ZOHO-${level}] ${message}`);
  }

  res.status(200).json({ ok: true });
});

app.listen(5000, () => console.log("Backend running on port 5000"));

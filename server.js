const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");

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
      Current_City: raw.q11_typeA11 || "",
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

app.listen(5000, () => console.log("Backend running on port 5000"));

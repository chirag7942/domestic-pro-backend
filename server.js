const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

/*
  FUNCTION: Automatically generate new access token
*/
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

/*
  HELPER: Convert array to comma-separated string
  Empty arrays become "" — Zoho stores them as blank, no error
*/
function arrToStr(val) {
  if (Array.isArray(val)) return val.filter(Boolean).join(", ");
  return val || "";
}

/*
  SUBMIT ROUTE — Sends all 33 fields to Zoho Creator
  Unfilled fields are sent as "" and stored blank in Zoho
*/
app.post("/submit", async (req, res) => {
  try {
    const body = req.body;

    console.log("Received form submission:", JSON.stringify(body, null, 2));

    // Always generate a fresh access token
    const accessToken = await getAccessToken();

    const zohoData = {
      // ── Section 1: Contact Info ──────────────────────────────────────────
      Full_Name: `${body.FirstName || ""} ${body.LastName || ""}`.trim(),
      First_Name: body.FirstName || "",
      Last_Name: body.LastName || "",
      Mobile_Number: body.Phone || "",
      Email: body.Email || "",

      // ── Section 2: Address ───────────────────────────────────────────────
      Street_Address: body.Street || "",
      City: body.City || "",
      State: body.State || "",
      Pincode: body.Pincode || "",

      // ── Section 3: Service Info ──────────────────────────────────────────
      Service_Type: body.ServiceType || "",
      Service_Label: body.ServiceLabel || "",
      Service_Format: body.ServiceFormat || "",

      // ── Section 4: House Help ────────────────────────────────────────────
      Tasks_Needed: arrToStr(body.Tasks),
      House_Size: body.HouseSize || "",
      People_At_Home: body.PeopleAtHome || "",
      Pets_At_Home: body.PetsAtHome || "",

      // ── Section 5: Cook ──────────────────────────────────────────────────
      Meal_Preferences: body.MealPref || "",
      Meals_Needed: arrToStr(body.MealsNeeded),
      Cuisine_Preference: arrToStr(body.CuisinePref),

      // ── Section 6: Babysitter ────────────────────────────────────────────
      Child_Age: body.ChildAge || "",
      Child_Duties: arrToStr(body.ChildDuties),

      // ── Section 7: Elderly Care ──────────────────────────────────────────
      Patient_Age: body.PatientAge || "",
      Patient_Gender: body.PatientGender || "",
      Care_Needed: arrToStr(body.CareNeeded),

      // ── Section 8: Driver ────────────────────────────────────────────────
      Vehicle_Type: arrToStr(body.VehicleType),
      Experience_Required: body.ExperienceRequired || "",

      // ── Section 9: House Manager ─────────────────────────────────────────
      Manager_Duties: arrToStr(body.ManagerDuties),
      Home_Type: body.HomeType || "",

      // ── Section 10: Multiple Services ────────────────────────────────────
      Multi_Services: arrToStr(body.MultiServices),

      // ── Section 11: Budget & Urgency ─────────────────────────────────────
      Monthly_Budget: body.Budget || "",
      Urgency: body.Urgency || "",

      // ── Section 12: Plan & Payment ───────────────────────────────────────
      Plan_Type: body.PlanType || "",
      Payment_Status: body.PaymentStatus || "",

      // ── Section 13: Notes ────────────────────────────────────────────────
      Special_Instructions: body.Instructions || "",
      Payment_Screenshot: body.ScreenshotUrl || "",
    };

    console.log("Sending to Zoho:", JSON.stringify(zohoData, null, 2));

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

    console.log("Zoho Response:", JSON.stringify(response.data, null, 2));

    res.status(200).json({
      message: "Submitted successfully",
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

/* ============================================================
   JOTFORM ROUTE — DomesticPro Supplier Onboarding Form
   JotForm Webhook URL: https://yourdomain.com/submit-jotform
   Form: https://form.jotform.com/253542636960058
   ============================================================

   JotForm field key format: q{number}_{camelCaseName}
   Log raw body first to confirm exact keys from your form.

   FIELDS FROM YOUR FORM:
   ┌─────────────────────────────────────────────────────────┐
   │ Page 1                                                  │
   │  • Name (First + Last)                                  │
   │  • Phone Number                                         │
   │  • Gender                                               │
   │  • Age                                                  │
   │  • Marital Status                                       │
   │  • Current City                                         │
   │  • Native City                                          │
   │  • Language Spoken                                      │
   │  • Service Applying For                                 │
   │  • Salary Expectation                                   │
   │  • Years of Experience                                  │
   │  • Age Groups Handled   (Nanny-specific)                │
   │  • Cuisine Expertise    (Cook-specific)                 │
   │  • Category (Veg/Non-Veg) (Cook-specific)               │
   │  • Vehicle Experience   (Driver-specific)               │
   │  • Driving License      (Driver-specific)               │
   │  • Work Comfortable With (House Help-specific)          │
   │  • Aadhaar Card (file upload)                           │
   │  • Photograph (file upload)                             │
   │                                                         │
   │ Page 2 — Interview Assessment                           │
   │  • Understands Instructions                             │
   │  • Overall Attitude                                     │
   │  • Punctuality & Responsiveness                         │
   │  • Personal Hygiene & Neatness                          │
   │                                                         │
   │ Page 3                                                  │
   │  • Domestic Pro Verified                                │
   └─────────────────────────────────────────────────────────┘
*/
app.post("/submit-jotform", async (req, res) => {
  try {
    const body = req.body;
    // ── RAW LOG — Check this on first test to confirm field keys ──────────
    console.log("JotForm RAW body:", JSON.stringify(body, null, 2));
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

    console.log("Sending to Zoho:", JSON.stringify(zohoData, null, 2));

    // ⚠️ IMPORTANT: Change the form name below to your Zoho Creator
    //    supplier form name (e.g. SupplierOnboarding) if it's different
    const response = await axios.post(
      "https://creator.zoho.in/appbuilder/support_domesticpro/helpermatch-system/form/Helpers1",
      { data: zohoData },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Zoho Response:", JSON.stringify(response.data, null, 2));

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

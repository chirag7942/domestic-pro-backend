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
      // ── Section 1: Personal Info ─────────────────────────────────────────
      // JotForm sends Name as: { first: "John", last: "Doe" }
      Full_Name:
        `${body.q3_name?.first || ""} ${body.q3_name?.last || ""}`.trim(),
      Phone_Number: body.q4_phoneNumber || "",
      Gender: body.q5_gender || "",
      Age: body.q6_age || "",
      Marital_Status: body.q7_maritalStatus || "", // "Yes" or "No"

      // ── Section 2: Location ──────────────────────────────────────────────
      Current_City: body.q8_currentCity || "",
      Native_City: body.q9_nativeCity || "",

      // ── Section 3: Skills & Service ─────────────────────────────────────
      Language_Spoken: body.q10_languageSpoken || "",
      Service_Applying: body.q11_whichService || "", // e.g. "Nanny", "Cook", "Driver" etc.
      Salary_Expectation: body.q12_salaryExpectation || "",
      Years_Of_Experience: body.q13_yearsOf || "",

      // ── Section 4: Role-Specific Fields ─────────────────────────────────

      // Nanny — Age Groups Handled (checkbox → comma-separated)
      Age_Groups_Handled: arrToStr(body.q14_ageGroups),

      // Cook — Cuisine & Category
      Cuisine_Expertise: body.q15_cuisineExpertise || "", // single select
      Food_Category: body.q16_category || "", // Veg / Non-Veg / Both

      // Driver — Vehicle & License
      Vehicle_Experience: arrToStr(body.q17_typeOf), // checkbox
      Driving_License: body.q18_drivingLicense || "", // "Yes" or "No"

      // House Help — Work Type
      Work_Comfortable_With: arrToStr(body.q19_typeOf1), // checkbox

      // ── Section 5: Document Uploads ──────────────────────────────────────
      // JotForm sends file uploads as a URL string
      Aadhaar_Card: body.q20_aadhaarCard || "",
      Photograph: body.q21_phot0ograph || "", // note: typo in form kept as-is

      // ── Section 6: Interview Assessment (Page 2) ─────────────────────────
      Understands_Instructions: body.q22_understandsInstructions || "", // Poor/Average/Good
      Overall_Attitude: body.q23_overallAttitude || "", // Uncooperative/Neutral/Cooperative
      Punctuality: body.q24_punctualityResponsiveness || "", // Poor/Average/Good
      Personal_Hygiene: body.q25_personalHygiene || "", // Poor/Acceptable/Good

      // ── Section 7: Verification (Page 3) ────────────────────────────────
      Domestic_Pro_Verified: body.q26_domesticPro || "", // "Yes" or "No"
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

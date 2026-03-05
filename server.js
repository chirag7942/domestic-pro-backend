const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

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

app.listen(5000, () => console.log("Backend running on port 5000"));

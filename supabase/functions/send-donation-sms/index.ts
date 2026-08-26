import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    // --------------------------------------------------
    // 1. Parse request safely
    // --------------------------------------------------
    const body = await req.json().catch(() => ({}));

    console.log("REQUEST BODY:", body);

    const {
      phone,
      donorName,
      amount,
      institutionName
    } = body;

    // --------------------------------------------------
    // 2. Load secrets
    // --------------------------------------------------
    const apiKey = Deno.env.get("ALKASEL_API_KEY");
    const senderId = Deno.env.get("ALKASEL_SENDER_ID");

    console.log("API KEY LOADED:", !!apiKey);
    console.log("SENDER ID LOADED:", !!senderId);

    // --------------------------------------------------
    // 3. Validate inputs (IMPORTANT)
    // --------------------------------------------------
    if (!apiKey) {
      throw new Error("ALKASEL_API_KEY secret not found");
    }

    if (!senderId) {
      throw new Error("ALKASEL_SENDER_ID secret not found");
    }

    if (!phone) {
      throw new Error("Phone number is missing");
    }

    if (!donorName) {
      throw new Error("Donor name is missing");
    }

    // --------------------------------------------------
    // 4. Build SMS message
    // --------------------------------------------------
    const message =
      `Hello ${donorName}, thank you for your donation of ${amount} to ${institutionName}.`;

    console.log("Sending SMS...");
    console.log("Phone:", phone);
    console.log("Sender:", senderId);

    // --------------------------------------------------
    // 5. Call Alkasel API
    // --------------------------------------------------
    const response = await fetch(
      "https://api.alkasel.com/v1/sms/send",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sender_id: senderId,
          recipient: phone,
          message: message
        })
      }
    );

    const result = await response.json().catch(() => ({}));

    console.log("ALKASEL STATUS:", response.status);
    console.log("ALKASEL RESPONSE:", result);

    // --------------------------------------------------
    // 6. Handle API failure properly
    // --------------------------------------------------
    if (!response.ok) {
      throw new Error(
        result?.message || `SMS gateway error (${response.status})`
      );
    }

    // --------------------------------------------------
    // 7. Success response
    // --------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS sent successfully",
        result
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  } catch (error) {
    console.error("SMS FUNCTION ERROR:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
});
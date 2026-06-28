import { createClient } from "https://esm.sh/@supabase/supabase-js";

// =============================
// SUPABASE CLIENT (SERVER SIDE)
// =============================
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// =============================
// META WHATSAPP PROVIDER
// =============================
async function sendWhatsApp(to: string, message: string) {
  const url = `https://graph.facebook.com/v20.0/${Deno.env.get(
    "META_PHONE_NUMBER_ID"
  )}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("META_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace("+", "").trim(), // Meta requires no "+"
      type: "text",
      text: {
        body: message,
      },
    }),
  });

  const result = await response.json();

  console.log("[WHATSAPP META RESPONSE]", result);

  if (!response.ok) {
    throw new Error(result?.error?.message || "WhatsApp send failed");
  }

  return {
    success: true,
    provider: "meta_whatsapp",
    result,
  };
}

// =============================
// SMS PROVIDER (PLACEHOLDER)
// =============================
async function sendSMS(to: string, message: string) {
  console.log("[SMS SENT]", to, message);

  // Later replace with Hubtel / Twilio / Arkesel
  return {
    success: true,
    provider: "sms",
  };
}

// =============================
// EDGE FUNCTION WORKER
// =============================
Deno.serve(async () => {
  try {
    console.log("[WORKER] Fetching pending notifications...");

    const { data: jobs, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) throw error;

    if (!jobs || jobs.length === 0) {
      return new Response("No pending notifications");
    }

    console.log(`[WORKER] Processing ${jobs.length} jobs`);

    for (const job of jobs) {
      try {
        let result;

        // =============================
        // CHANNEL ROUTING ENGINE
        // =============================
        if (job.channel === "whatsapp") {
          result = await sendWhatsApp(job.recipient, job.message);
        } else if (job.channel === "sms") {
          result = await sendSMS(job.recipient, job.message);
        } else {
          throw new Error("Unsupported channel: " + job.channel);
        }

        // =============================
        // SUCCESS UPDATE
        // =============================
        await supabase
          .from("notifications")
          .update({
            status: "sent",
            provider: result.provider,
            sent_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        console.log(`[WORKER] SENT: ${job.id}`);

      } catch (err: any) {
        console.error(`[WORKER ERROR] Job ${job.id}:`, err.message);

        await supabase
          .from("notifications")
          .update({
            status: "failed",
            error: err.message,
            retry_count: (job.retry_count || 0) + 1,
          })
          .eq("id", job.id);
      }
    }

    return new Response("Processed notifications successfully");

  } catch (err: any) {
    console.error("[WORKER FATAL ERROR]", err.message);

    return new Response("Worker failed: " + err.message, {
      status: 500,
    });
  }
});
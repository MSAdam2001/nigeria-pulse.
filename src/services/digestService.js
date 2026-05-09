const supabase = require("../config/supabase");
const { sendEmailDigest } = require("./emailService");
const { sendWhatsAppDigest } = require("./whatsappService");
const { sendTelegramDigest } = require("./telegramService");

async function getDigestData() {
  const { data: summary } = await supabase
    .from("daily_summaries")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  const { data: rates } = await supabase
    .from("naira_rates")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1);

  const { data: alerts } = await supabase
    .from("foreign_alerts")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(3);

  return {
    top_topics: summary?.top_topics || [],
    nairaRate: rates?.[0] || null,
    foreignAlerts: alerts || [],
    generated_at: summary?.generated_at,
  };
}

async function sendDailyDigest() {
  console.log("\n📨 Starting daily digest send...");

  const data = await getDigestData();

  if (!data.top_topics.length) {
    console.log("⚠️  No topics found — skipping digest");
    return;
  }

  // Send to Telegram channel
  console.log("📱 Sending to Telegram channel...");
  await sendTelegramDigest(data);

  // Get all active subscribers
  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("*")
    .eq("active", true);

  if (error || !subscribers?.length) {
    console.log("⚠️  No active subscribers found");
    return;
  }

  console.log(`👥 Sending to ${subscribers.length} email subscribers...`);

  let emailSent = 0;
  let whatsappSent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    if (subscriber.email) {
      const ok = await sendEmailDigest(subscriber, data);
      if (ok) emailSent++;
      else failed++;
    }
    if (subscriber.whatsapp) {
      const ok = await sendWhatsAppDigest(subscriber, data);
      if (ok) whatsappSent++;
      else failed++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  await supabase.from("digest_logs").insert({
    sent_at: new Date().toISOString(),
    total_sent: subscribers.length,
    email_sent: emailSent,
    whatsapp_sent: whatsappSent,
    failed,
  });

  console.log(`✅ Digest complete!`);
  console.log(`   📱 Telegram: sent to channel`);
  console.log(`   📧 Email: ${emailSent} sent`);
  console.log(`   ❌ Failed: ${failed}`);
}

module.exports = { sendDailyDigest };
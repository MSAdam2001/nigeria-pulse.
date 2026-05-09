const twilio = require("twilio");
require("dotenv").config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function buildWhatsAppMessage(data) {
  const { top_topics, nairaRate, foreignAlerts } = data;
  const date = new Date().toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });

  const topics = top_topics.map((t, i) => {
    const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"];
    return `${nums[i]} *${t.name}*\n    ${t.summary}`;
  }).join("\n\n");

  const rate = nairaRate
    ? `💵 *NAIRA RATE*\n$1 = ₦${Number(nairaRate.usd_to_ngn).toFixed(0)} | €1 = ₦${Number(nairaRate.eur_to_ngn).toFixed(0)}`
    : "";

  const alert = foreignAlerts?.length > 0
    ? `\n\n🌍 *GLOBAL ALERT*\n${foreignAlerts[0].event}\n_${foreignAlerts[0].nigeria_impact}_`
    : "";

  return `🇳🇬 *NIGERIA PULSE*
_${date}_
━━━━━━━━━━━━━━━

🔥 *TOP 5 TRENDING NOW*

${topics}

━━━━━━━━━━━━━━━
${rate}${alert}

📱 Read full analysis:
nigeriapulse.ng

_Reply STOP to unsubscribe_`;
}

async function sendWhatsAppDigest(subscriber, data) {
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${subscriber.whatsapp}`,
      body: buildWhatsAppMessage(data),
    });

    console.log(`✅ WhatsApp sent to ${subscriber.whatsapp}`);
    return true;
  } catch (err) {
    console.error(`❌ WhatsApp failed for ${subscriber.whatsapp}:`, err.message);
    return false;
  }
}

module.exports = { sendWhatsAppDigest };
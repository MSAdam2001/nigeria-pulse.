const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

function buildTelegramMessage(data) {
  const { top_topics, nairaRate, foreignAlerts } = data;

  const date = new Date().toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣"];

  const topics = top_topics.map((t, i) => {
    const badges = [];
    if (t.in_govt_agenda) badges.push("🏛 GOVT");
    if (t.foreign_impact) badges.push("🌍 GLOBAL");
    const badge = badges.length > 0 ? ` • ${badges.join(" ")}` : "";
    return `${nums[i]} *${t.name}*${badge}\n_${t.summary}_\n📊 Intensity: ${t.intensity}/10`;
  }).join("\n\n");

  const rate = nairaRate
    ? `💵 *NAIRA RATE*\n$1 = ₦${Number(nairaRate.usd_to_ngn).toFixed(0)} | €1 = ₦${Number(nairaRate.eur_to_ngn).toFixed(0)} | £1 = ₦${Number(nairaRate.gbp_to_ngn).toFixed(0)}`
    : "";

  const alerts = foreignAlerts?.length > 0
    ? `\n\n🌍 *GLOBAL ALERT*\n${foreignAlerts[0].event}\n_${foreignAlerts[0].nigeria_impact}_`
    : "";

  return `🇳🇬 *NIGERIA PULSE*
_${date}_
━━━━━━━━━━━━━━━━━━

🔥 *TOP 5 TRENDING IN NIGERIA*

${topics}

━━━━━━━━━━━━━━━━━━
${rate}${alerts}

📱 [Read full analysis](http://localhost:3000)

_Auto-generated every 2 hours · 23 sources_`;
}

async function sendTelegramDigest(data) {
  try {
    const message = buildTelegramMessage(data);
    await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, message, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
    console.log("✅ Telegram digest sent to channel!");
    return true;
  } catch (err) {
    console.error("❌ Telegram error:", err.message);
    return false;
  }
}

async function testTelegram() {
  try {
    await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID,
      "🇳🇬 *Nigeria Pulse Bot is now LIVE!*\n\nYou will receive daily news digests at 6AM and 6PM WAT.\n\nStay informed! 🚀",
      { parse_mode: "Markdown" }
    );
    console.log("✅ Test message sent!");
    return true;
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    return false;
  }
}

module.exports = { sendTelegramDigest, testTelegram };
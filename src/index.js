require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const apiRoutes = require("./routes/api");
const { runAllScrapers } = require("./scrapers/newsScraper");
const { scrapeGoogleTrends } = require("./scrapers/trendsScraper");
const { runSocialScrapers } = require("./scrapers/socialScraper");
const { scrapeNairaRate } = require("./scrapers/nairaScraper");
const { runNairalandScraper } = require("./scrapers/nairalandScraper");
const { runSummarizer } = require("./services/summarizer");
const { sendDailyDigest } = require("./services/digestService");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/api", apiRoutes);
app.use("/images", express.static("public/images"));

app.get("/", (req, res) => {
  res.json({ name: "Nigeria Pulse API", status: "running" });
});

// ─────────────────────────────────────────
//  CRON JOBS
// ─────────────────────────────────────────

// Scrape news every 2 hours at :00
cron.schedule("0 */2 * * *", async () => {
  console.log("\n⏰ [CRON] Scraping news...");
  await runAllScrapers();
});

// Naira rate every 2 hours at :01
cron.schedule("1 */2 * * *", async () => {
  console.log("\n💵 [CRON] Fetching Naira rate...");
  await scrapeNairaRate();
});

// Social + Google Trends every 2 hours at :02
cron.schedule("2 */2 * * *", async () => {
  console.log("\n📱 [CRON] Scraping social media...");
  await scrapeGoogleTrends();
  await runSocialScrapers();
});

// Nairaland every 2 hours at :06
cron.schedule("6 */2 * * *", async () => {
  console.log("\n🇳🇬 [CRON] Scraping Nairaland...");
  await runNairalandScraper();
});

// AI Summarizer every 2 hours at :05
cron.schedule("5 */2 * * *", async () => {
  console.log("\n🧠 [CRON] Summarizing...");
  await runSummarizer();
});

// Daily digest — 6AM WAT (5AM UTC)
cron.schedule("0 5 * * *", async () => {
  console.log("\n📨 [CRON] Sending 6AM digest...");
  await sendDailyDigest();
});

// Daily digest — 6PM WAT (5PM UTC)
cron.schedule("0 17 * * *", async () => {
  console.log("\n📨 [CRON] Sending 6PM digest...");
  await sendDailyDigest();
});

// ─────────────────────────────────────────
//  STARTUP
// ─────────────────────────────────────────
async function startup() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🇳🇬  NIGERIA PULSE — Starting...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔄 Step 1: Scraping news sources...");
  await runAllScrapers();

  console.log("\n🔄 Step 1b: Fetching Naira rate...");
  await scrapeNairaRate();

  console.log("\n🔄 Step 2: Scraping social media + Google Trends...");
  await scrapeGoogleTrends();
  await runSocialScrapers();

  console.log("\n🔄 Step 2c: Scraping Nairaland...");
  await runNairalandScraper();

  console.log("\n🔄 Step 3: Running AI summarizer...");
  await new Promise((r) => setTimeout(r, 3000));
  await runSummarizer();

  console.log("\n✅ Startup complete! Auto-refresh every 2 hours.");
  console.log("📨 Digest schedule: 6AM + 6PM WAT daily\n");
}

app.listen(PORT, async () => {
  console.log(`🌍 Nigeria Pulse API → http://localhost:${PORT}`);
  console.log(`🔁 Schedule: scrape :00, trends :02, nairaland :06, summarize :05`);
  await startup();
});

module.exports = app;
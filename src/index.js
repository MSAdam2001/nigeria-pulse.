require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const apiRoutes = require("./routes/api");
const { runAllScrapers } = require("./scrapers/newsScraper");
const { runSummarizer } = require("./services/summarizer");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({ name: "Nigeria Pulse API", status: "running" });
});

// Auto-refresh every 2 hours
cron.schedule("0 */2 * * *", async () => {
  console.log("\n⏰ [CRON] Scraping...");
  await runAllScrapers();
});

cron.schedule("5 */2 * * *", async () => {
  console.log("\n🧠 [CRON] Summarizing...");
  await runSummarizer();
});

app.listen(PORT, async () => {
  console.log(`\n🇳🇬 Nigeria Pulse running on http://localhost:${PORT}`);
  console.log("🔄 Running initial data load...\n");
  await runAllScrapers();
  await new Promise((r) => setTimeout(r, 3000));
  await runSummarizer();
});
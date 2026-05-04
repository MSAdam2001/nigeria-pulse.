const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { runAllScrapers } = require("../scrapers/newsScraper");
const { runSummarizer } = require("../services/summarizer");

router.get("/pulse", async (req, res) => {
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return res.status(404).json({ error: "No summary yet." });
  res.json({ success: true, data });
});

router.get("/news", async (req, res) => {
  const { source, limit = 20 } = req.query;
  let query = supabase.from("raw_signals").select("*")
    .order("scraped_at", { ascending: false }).limit(parseInt(limit));
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, count: data.length, data });
});

router.get("/summaries", async (req, res) => {
  const { data, error } = await supabase
    .from("daily_summaries").select("*")
    .order("generated_at", { ascending: false }).limit(10);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

router.post("/trigger/scrape", async (req, res) => {
  const articles = await runAllScrapers();
  res.json({ success: true, articles_scraped: articles.length });
});

router.post("/trigger/summarize", async (req, res) => {
  const summary = await runSummarizer();
  if (!summary) return res.status(500).json({ error: "Failed" });
  res.json({ success: true, summary });
});

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Nigeria Pulse API", time: new Date().toISOString() });
});

module.exports = router;
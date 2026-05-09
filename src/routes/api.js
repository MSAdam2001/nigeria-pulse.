const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { setCache, getCache, clearCache } = require("../config/cache");
const { runAllScrapers } = require("../scrapers/newsScraper");
const { runSummarizer } = require("../services/summarizer");

// GET /api/pulse
router.get("/pulse", async (req, res) => {
  try {
    const cached = getCache("pulse");
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const { data, error } = await supabase
      .from("daily_summaries").select("*")
      .order("generated_at", { ascending: false }).limit(1).single();
    if (error || !data) return res.status(404).json({ error: "No summary yet." });
    setCache("pulse", data, 300);
    res.json({ success: true, data, cached: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/news
router.get("/news", async (req, res) => {
  try {
    const { source, limit = 20 } = req.query;
    const cacheKey = `news_${source || "all"}_${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, count: cached.length, data: cached, cached: true });
    let query = supabase.from("raw_signals").select("*")
      .order("scraped_at", { ascending: false }).limit(parseInt(limit));
    if (source) query = query.eq("source", source);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    setCache(cacheKey, data, 120);
    res.json({ success: true, count: data.length, data, cached: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/summaries
router.get("/summaries", async (req, res) => {
  try {
    const cached = getCache("summaries");
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const { data, error } = await supabase
      .from("daily_summaries").select("*")
      .order("generated_at", { ascending: false }).limit(10);
    if (error) return res.status(500).json({ error: error.message });
    setCache("summaries", data, 300);
    res.json({ success: true, data, cached: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/foreign-alerts
router.get("/foreign-alerts", async (req, res) => {
  try {
    const cached = getCache("foreign_alerts");
    if (cached) return res.json({ success: true, count: cached.length, data: cached, cached: true });
    const { data, error } = await supabase
      .from("foreign_alerts").select("*")
      .order("generated_at", { ascending: false }).limit(20);
    if (error) return res.status(500).json({ error: error.message });
    setCache("foreign_alerts", data, 300);
    res.json({ success: true, count: data.length, data, cached: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/naira
router.get("/naira", async (req, res) => {
  try {
    const cached = getCache("naira");
    if (cached) return res.json({ success: true, data: cached, cached: true });
    const { data, error } = await supabase
      .from("naira_rates").select("*")
      .order("recorded_at", { ascending: false }).limit(24);
    if (error) return res.status(500).json({ error: error.message });
    setCache("naira", data, 300);
    res.json({ success: true, data, cached: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/subscribers
router.get("/subscribers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("subscribers")
      .select("id, name, email, whatsapp, channel, active, created_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: data.length, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/subscribe
router.post("/subscribe", async (req, res) => {
  try {
    const { name, email, whatsapp } = req.body;
    if (!email && !whatsapp) {
      return res.status(400).json({ error: "Email or WhatsApp number required" });
    }
    const { data, error } = await supabase
      .from("subscribers")
      .insert({
        name: name || "",
        email: email || null,
        whatsapp: whatsapp || null,
        channel: email && whatsapp ? "both" : email ? "email" : "whatsapp",
        active: true,
      })
      .select().single();

    if (error) {
      if (error.code === "23505") return res.status(400).json({ error: "Already subscribed!" });
      return res.status(500).json({ error: error.message });
    }

    // Send welcome email
    if (email && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Nigeria Pulse <onboarding@resend.dev>",
          to: email,
          subject: "🇳🇬 Welcome to Nigeria Pulse!",
          html: `
            <div style="background:#0a0a0a;color:#f0ede6;padding:32px;font-family:Arial;max-width:500px;margin:0 auto;border-radius:12px;border:1px solid #2a2a2a;">
              <div style="height:4px;background:linear-gradient(90deg,#008751,#00C853);border-radius:2px;margin-bottom:24px;"></div>
              <h1 style="color:#008751;margin:0 0 12px;">Welcome to Nigeria Pulse! 🇳🇬</h1>
              <p style="color:#9a9590;">You're now subscribed to Nigeria's most intelligent news digest.</p>
              <p style="color:#9a9590;">Every day at <strong style="color:#ffd600;">6AM and 6PM</strong> WAT you'll receive:</p>
              <ul style="color:#9a9590;line-height:2;">
                <li>🔥 Top 5 trending topics in Nigeria</li>
                <li>💵 Live Naira exchange rate (USD/EUR/GBP)</li>
                <li>🌍 Global events affecting Nigeria</li>
                <li>📊 AI-powered sentiment analysis</li>
              </ul>
              <p style="color:#666;font-size:13px;">Your first digest arrives at 6AM tomorrow. Stay informed! 🚀</p>
              <div style="height:3px;background:linear-gradient(90deg,#00C853,#008751);border-radius:2px;margin-top:24px;"></div>
            </div>`,
        });
        console.log(`✅ Welcome email sent to ${email}`);
      } catch (emailErr) {
        console.error("⚠️  Welcome email failed:", emailErr.message);
      }
    }

    res.json({ success: true, message: "Subscribed! Check your email for confirmation." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/unsubscribe
router.post("/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;
    await supabase.from("subscribers").update({ active: false }).eq("email", email);
    res.json({ success: true, message: "Unsubscribed successfully." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/trigger/scrape
router.post("/trigger/scrape", async (req, res) => {
  clearCache();
  const articles = await runAllScrapers();
  res.json({ success: true, articles_scraped: articles.length });
});

// POST /api/trigger/summarize
router.post("/trigger/summarize", async (req, res) => {
  clearCache();
  const summary = await runSummarizer();
  if (!summary) return res.status(500).json({ error: "Failed" });
  res.json({ success: true, summary });
});

// POST /api/trigger/digest — manually test digest
router.post("/trigger/digest", async (req, res) => {
  try {
    const { sendDailyDigest } = require("../services/digestService");
    await sendDailyDigest();
    res.json({ success: true, message: "Digest sent!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/health
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Nigeria Pulse API",
    time: new Date().toISOString(),
    digest_schedule: "6AM + 6PM WAT daily",
  });
});

module.exports = router;
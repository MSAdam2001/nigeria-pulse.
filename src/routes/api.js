const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const { setCache, getCache, clearCache } = require("../config/cache");
const { runAllScrapers } = require("../scrapers/newsScraper");
const { runSummarizer } = require("../services/summarizer");

// ─── GET /api/pulse ───────────────────────────────────────────
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

// ─── GET /api/news ────────────────────────────────────────────
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

// ─── GET /api/summaries ───────────────────────────────────────
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

// ─── GET /api/foreign-alerts ──────────────────────────────────
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

// ─── GET /api/naira ───────────────────────────────────────────
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

// ─── GET /api/subscribers ─────────────────────────────────────
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

// ─── POST /api/subscribe ──────────────────────────────────────
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

// ─── POST /api/unsubscribe ────────────────────────────────────
router.post("/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;
    await supabase.from("subscribers").update({ active: false }).eq("email", email);
    res.json({ success: true, message: "Unsubscribed successfully." });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/trigger/scrape ─────────────────────────────────
router.post("/trigger/scrape", async (req, res) => {
  clearCache();
  const articles = await runAllScrapers();
  res.json({ success: true, articles_scraped: articles.length });
});

// ─── POST /api/trigger/summarize ─────────────────────────────
router.post("/trigger/summarize", async (req, res) => {
  clearCache();
  const summary = await runSummarizer();
  if (!summary) return res.status(500).json({ error: "Failed" });
  res.json({ success: true, summary });
});

// ─── POST /api/trigger/digest ─────────────────────────────────
router.post("/trigger/digest", async (req, res) => {
  try {
    const { sendDailyDigest } = require("../services/digestService");
    await sendDailyDigest();
    res.json({ success: true, message: "Digest sent!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/health ──────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Nigeria Pulse API",
    time: new Date().toISOString(),
    digest_schedule: "6AM + 6PM WAT daily",
  });
});

// ─── POST /api/ai-chat (Groq — free) ─────────────────────────
router.post("/ai-chat", async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ success: false, error: "GROQ_API_KEY not set in .env" });
    }
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are Nigeria Pulse AI assistant. You help users understand Nigerian news, politics, economy, and current events. Be concise, factual, and helpful. ${context || ""}`,
        },
        ...messages,
      ],
    });
    res.json({ success: true, text: response.choices[0].message.content });
  } catch (err) {
    console.error("❌ AI chat error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
//  NEW FEATURES
// ═════════════════════════════════════════════════════════════

// ─── GET /api/naira-rate/current ──────────────────────────────
router.get("/naira-rate/current", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("naira_rates")
      .select("usd_to_ngn, eur_to_ngn, gbp_to_ngn, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();
    if (error) throw error;

    const { data: prev } = await supabase
      .from("naira_rates")
      .select("usd_to_ngn")
      .order("recorded_at", { ascending: false })
      .range(1, 1)
      .single();

    const change = prev
      ? ((data.usd_to_ngn - prev.usd_to_ngn) / prev.usd_to_ngn) * 100
      : 0;

    res.json({
      success: true,
      data: {
        ...data,
        usd_change_pct: parseFloat(change.toFixed(2)),
        direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/naira-rate/chart ────────────────────────────────
router.get("/naira-rate/chart", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days || "7", 10), 30);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from("naira_rates")
      .select("usd_to_ngn, eur_to_ngn, gbp_to_ngn, recorded_at")
      .gte("recorded_at", since.toISOString())
      .order("recorded_at", { ascending: true });
    if (error) throw error;

    const hourly = {};
    (data || []).forEach((row) => {
      const hour = row.recorded_at.slice(0, 13);
      if (!hourly[hour]) hourly[hour] = { sum: 0, count: 0, eur: 0, gbp: 0 };
      hourly[hour].sum += parseFloat(row.usd_to_ngn);
      hourly[hour].eur += parseFloat(row.eur_to_ngn);
      hourly[hour].gbp += parseFloat(row.gbp_to_ngn);
      hourly[hour].count++;
    });

    const points = Object.entries(hourly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, v]) => ({
        timestamp: `${hour}:00:00Z`,
        usd_to_ngn: parseFloat((v.sum / v.count).toFixed(2)),
        eur_to_ngn: parseFloat((v.eur / v.count).toFixed(2)),
        gbp_to_ngn: parseFloat((v.gbp / v.count).toFixed(2)),
      }));

    const usdValues = points.map((p) => p.usd_to_ngn);
    const stats = {
      current: usdValues[usdValues.length - 1] || null,
      min: Math.min(...usdValues),
      max: Math.max(...usdValues),
      change_pct: usdValues.length > 1
        ? parseFloat((((usdValues.at(-1) - usdValues[0]) / usdValues[0]) * 100).toFixed(2))
        : 0,
    };

    res.json({ success: true, data: points, stats, days });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/topic/:id ─────────────────────────────────────────────────────
// REPLACES the existing router.get("/topic/:id", ...) handler in routes/api.js
//
// WHAT'S NEW vs your current version:
//  1. Generates a full, original AI-written article (headline + byline + 5-8
//     paragraphs) from the scraped snippets, using Groq — NOT copied text from
//     any source. This is what powers the new ABC-News-style reading page.
//  2. The article is CACHED in the `daily_summaries` table (new JSON column
//     `generated_articles`) so it's written ONCE per topic per refresh cycle,
//     not regenerated on every page view — keeps it fast and cheap.
//  3. Still returns articles[] (the raw source list) for the "Sources" section
//     at the bottom of the page, and sentiment_breakdown for the sidebar.
//
// REQUIRES: a new column on daily_summaries:
//   ALTER TABLE daily_summaries ADD COLUMN generated_articles JSONB DEFAULT '{}';
// (Run this once in Supabase SQL editor — see migration note at bottom of file)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/topic/:id", async (req, res) => {
  try {
    const topicIndex = parseInt(req.params.id, 10);
    if (isNaN(topicIndex) || topicIndex < 0 || topicIndex > 4) {
      return res.status(400).json({ success: false, error: "Invalid topic id (0-4)" });
    }

    // 1. Load the latest summary
    const { data: summary, error: summaryErr } = await supabase
      .from("daily_summaries")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (summaryErr || !summary) {
      return res.status(404).json({ success: false, error: "No summary available" });
    }

    const topic = summary.top_topics?.[topicIndex];
    if (!topic) {
      return res.status(404).json({ success: false, error: "Topic not found" });
    }

    // 2. Build keyword list (topic name words + keywords array)
    const nameWords = (topic.name || "")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
    const allKeywords = [...new Set([topic.name, ...(topic.keywords || []), ...nameWords])].slice(0, 6);

    // 3. Fetch matching articles — progressive window (48h → 7d → 30d → fallback)
    const WINDOWS = [48, 168, 720];
    let articles = [];
    for (const hours of WINDOWS) {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const orFilter = allKeywords.map((kw) => `title.ilike.%${kw}%,summary.ilike.%${kw}%`).join(",");
      const { data } = await supabase
        .from("raw_signals")
        .select("source, category, title, summary, link, published_at, scraped_at")
        .gte("scraped_at", since)
        .or(orFilter)
        .order("published_at", { ascending: false })
        .limit(20);
      if (data && data.length > 0) { articles = data; break; }
    }
    if (articles.length === 0) {
      const { data: fallback } = await supabase
        .from("raw_signals")
        .select("source, category, title, summary, link, published_at, scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(15);
      articles = fallback || [];
    }

    // 4. Related foreign alerts
    const { data: foreignAlerts } = await supabase
      .from("foreign_alerts")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(10);
    const relatedAlerts = (foreignAlerts || []).filter((a) =>
      allKeywords.some((kw) =>
        a.event?.toLowerCase().includes(kw.toLowerCase()) ||
        a.nigeria_impact?.toLowerCase().includes(kw.toLowerCase())
      )
    );

    // 5. Sentiment breakdown
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    const positiveWords = ["growth", "improve", "rise", "gain", "success", "win", "increase", "boost", "record", "achieve"];
    const negativeWords = ["crisis", "fall", "decline", "attack", "death", "fail", "drop", "loss", "arrest", "protest", "strike"];
    articles.forEach((a) => {
      const text = `${a.title} ${a.summary || ""}`.toLowerCase();
      const pos = positiveWords.filter((w) => text.includes(w)).length;
      const neg = negativeWords.filter((w) => text.includes(w)).length;
      if (pos > neg) sentimentCounts.positive++;
      else if (neg > pos) sentimentCounts.negative++;
      else sentimentCounts.neutral++;
    });

    // 6. ── GENERATE OR REUSE THE FULL AI ARTICLE ──
    const cachedArticles = summary.generated_articles || {};
    let fullArticle = cachedArticles[topicIndex];

    // Only generate if not already cached for THIS summary (summary.id ties cache to refresh cycle)
    if (!fullArticle || fullArticle.summary_id !== summary.id) {
      fullArticle = await generateFullArticle(topic, articles, allKeywords);
      fullArticle.summary_id = summary.id;

      // Save back to cache (fire-and-forget — don't block the response on failure)
      const updatedCache = { ...cachedArticles, [topicIndex]: fullArticle };
      supabase
        .from("daily_summaries")
        .update({ generated_articles: updatedCache })
        .eq("id", summary.id)
        .then(({ error }) => { if (error) console.error("⚠️ Article cache save failed:", error.message); });
    }

    res.json({
      success: true,
      data: {
        topic,
        topic_index: topicIndex,
        article: fullArticle, // { headline, byline, paragraphs[], generated_at }
        articles: articles || [],          // raw sources, for "Sources" section
        related_alerts: relatedAlerts,
        sentiment_breakdown: sentimentCounts,
        total_articles: articles?.length || 0,
        generated_at: summary.generated_at,
        engine_used: summary.engine_used,
        confidence: summary.analysis_confidence,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Helper: generateFullArticle ───────────────────────────────────────────
// Sends the topic + scraped snippets to Groq and asks it to write an
// ORIGINAL full-length article (not copied text) in news style.
async function generateFullArticle(topic, articles, keywords) {
  const FALLBACK = {
    headline: topic.name,
    byline: "Nigeria Pulse Intelligence",
    paragraphs: [
      topic.summary || "Full coverage for this topic is being compiled.",
      topic.sentiment_reason || "",
    ].filter(Boolean),
    generated_at: new Date().toISOString(),
  };

  if (!process.env.GROQ_API_KEY || articles.length === 0) {
    return FALLBACK;
  }

  try {
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Build a compact digest of source snippets for the model to synthesize
    const sourceDigest = articles
      .slice(0, 12)
      .map((a, i) => `[${i + 1}] ${a.source}: "${a.title}" — ${(a.summary || "").slice(0, 180)}`)
      .join("\n");

    const prompt = `You are a Nigerian news desk editor writing an ORIGINAL news article for "Nigeria Pulse". You are given a topic and short snippets gathered from multiple Nigerian news outlets monitoring this story. Your job is to SYNTHESIZE these into one cohesive, original article — written entirely in your own words. NEVER copy phrases verbatim from the snippets. Write like a wire-service journalist (Reuters/AP style): factual, neutral, clear.

TOPIC: ${topic.name}
AI SUMMARY: ${topic.summary || ""}
CATEGORY: ${topic.category || "general"}

SOURCE SNIPPETS (for context only — do not quote directly):
${sourceDigest}

Write a JSON object with this EXACT shape and nothing else (no markdown, no preamble):
{
  "headline": "a clear, specific news headline (not the topic name verbatim, write it like a real headline)",
  "paragraphs": [
    "opening paragraph stating the core news (2-3 sentences)",
    "second paragraph with supporting context/detail",
    "third paragraph — different angle or stakeholder reaction",
    "fourth paragraph — broader implications for Nigeria",
    "closing paragraph — what happens next / what to watch"
  ]
}

Each paragraph should be 2-4 sentences. Total length 350-550 words. Do not invent specific quotes, names, or statistics that are not implied by the snippets — stay general where source detail is thin. Output ONLY the JSON object.`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1200,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in model output");

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.headline || !Array.isArray(parsed.paragraphs) || parsed.paragraphs.length === 0) {
      throw new Error("Malformed article JSON");
    }

    return {
      headline: parsed.headline,
      byline: "Nigeria Pulse Intelligence",
      paragraphs: parsed.paragraphs,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("⚠️ Article generation failed, using fallback:", err.message);
    return FALLBACK;
  }
}

// ─── ONE-TIME MIGRATION (run in Supabase SQL editor before deploying) ───────
// ALTER TABLE daily_summaries ADD COLUMN IF NOT EXISTS generated_articles JSONB DEFAULT '{}';
// ─── GET /api/history ─────────────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    const { date, days = 7, limit = 14 } = req.query;

    let query = supabase
      .from("daily_summaries")
      .select("id, top_topics, overall_sentiment, dominant_category, total_articles_analyzed, engine_used, analysis_confidence, generated_at")
      .order("generated_at", { ascending: false });

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      query = query.gte("generated_at", start.toISOString()).lte("generated_at", end.toISOString());
    } else {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      query = query.gte("generated_at", since.toISOString()).limit(parseInt(limit, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    const byDay = {};
    (data || []).forEach((row) => {
      const day = row.generated_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = row;
    });

    const history = Object.entries(byDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, row]) => ({
        date: day,
        ...row,
        top_topics: (row.top_topics || []).map((t) => ({
          name: t.name,
          intensity: t.intensity,
          sentiment: t.sentiment,
          category: t.category,
        })),
      }));

    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/search ──────────────────────────────────────────
router.get("/search", async (req, res) => {
  try {
    const { q, category, source, limit = 20, offset = 0, days = 7 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Query must be at least 2 characters" });
    }

    const term = q.trim().slice(0, 100);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));

    let query = supabase
      .from("raw_signals")
      .select("source, category, title, summary, link, published_at, scraped_at", { count: "exact" })
      .gte("scraped_at", since.toISOString())
      .or(`title.ilike.%${term}%,summary.ilike.%${term}%`)
      .order("published_at", { ascending: false })
      .range(parseInt(offset, 10), parseInt(offset, 10) + parseInt(limit, 10) - 1);

    if (category) query = query.eq("category", category);
    if (source) query = query.ilike("source", `%${source}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    const highlight = (text, term) => {
      if (!text) return "";
      const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      return text.replace(re, "**$1**");
    };

    const results = (data || []).map((row) => ({
      ...row,
      title_highlighted: highlight(row.title, term),
      summary_highlighted: highlight(row.summary?.slice(0, 200), term),
    }));

    const sourceBreakdown = {};
    results.forEach((r) => { sourceBreakdown[r.source] = (sourceBreakdown[r.source] || 0) + 1; });

    res.json({
      success: true,
      data: results,
      meta: {
        total: count,
        query: term,
        days: parseInt(days, 10),
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        sources: Object.entries(sourceBreakdown)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([source, count]) => ({ source, count })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ADMIN AUTH MIDDLEWARE ────────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-key"] || req.query.key;
  const adminKey = process.env.ADMIN_KEY || "nigeria-pulse-admin-2026";
  if (token !== adminKey) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// ─── GET /api/admin/health ────────────────────────────────────
router.get("/admin/health", adminAuth, async (req, res) => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: sourceData } = await supabase
      .from("raw_signals")
      .select("source, category, scraped_at")
      .gte("scraped_at", twoHoursAgo);

    const sourceCounts = {};
    (sourceData || []).forEach((row) => {
      if (!sourceCounts[row.source]) {
        sourceCounts[row.source] = { count: 0, category: row.category, last_seen: row.scraped_at };
      }
      sourceCounts[row.source].count++;
      if (row.scraped_at > sourceCounts[row.source].last_seen) {
        sourceCounts[row.source].last_seen = row.scraped_at;
      }
    });

    const EXPECTED_SOURCES = [
      "Punch Nigeria", "Vanguard Nigeria", "Premium Times", "Channels TV",
      "Daily Trust", "Nairametrics", "BBC Africa", "BusinessDay Nigeria",
      "Reddit Nigeria", "Google Trends Nigeria", "YouTube — Channels TV",
    ];

    const scraperHealth = EXPECTED_SOURCES.map((name) => ({
      source: name,
      status: sourceCounts[name] ? "ok" : "failed",
      count: sourceCounts[name]?.count || 0,
      last_seen: sourceCounts[name]?.last_seen || null,
    }));

    const { count: totalCount } = await supabase
      .from("raw_signals").select("*", { count: "exact", head: true });

    const { count: dayCount } = await supabase
      .from("raw_signals").select("*", { count: "exact", head: true })
      .gte("scraped_at", oneDayAgo);

    const { count: summaryCount } = await supabase
      .from("daily_summaries").select("*", { count: "exact", head: true })
      .gte("generated_at", oneDayAgo);

    const { data: latestSummary } = await supabase
      .from("daily_summaries")
      .select("generated_at, engine_used, analysis_confidence")
      .order("generated_at", { ascending: false })
      .limit(1).single();

    const { count: subscriberCount } = await supabase
      .from("subscribers").select("*", { count: "exact", head: true })
      .eq("active", true);

    const { data: digestLogs } = await supabase
      .from("digest_logs")
      .select("sent_at, total_sent, email_sent, whatsapp_sent, failed")
      .order("sent_at", { ascending: false }).limit(5);

    const { data: latestRate } = await supabase
      .from("naira_rates")
      .select("recorded_at, usd_to_ngn")
      .order("recorded_at", { ascending: false })
      .limit(1).single();

    const rateAge = latestRate
      ? Math.round((Date.now() - new Date(latestRate.recorded_at).getTime()) / 60000)
      : null;

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        scrapers: {
          sources: scraperHealth,
          ok_count: scraperHealth.filter((s) => s.status === "ok").length,
          failed_count: scraperHealth.filter((s) => s.status === "failed").length,
        },
        articles: {
          total: totalCount,
          last_24h: dayCount,
          last_2h: sourceData?.length || 0,
        },
        summaries: {
          last_24h: summaryCount,
          latest: latestSummary || null,
        },
        naira_rate: {
          age_minutes: rateAge,
          current_usd: latestRate?.usd_to_ngn,
          status: rateAge !== null && rateAge < 150 ? "fresh" : "stale",
        },
        subscribers: { active: subscriberCount },
        digest_history: digestLogs || [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/test-push ────────────────────────────────
router.post("/admin/test-push", adminAuth, async (req, res) => {
  try {
    let triggerPushNotifications;
    try {
      triggerPushNotifications = require("../services/pushNotification").triggerPushNotifications;
    } catch {
      return res.json({ success: true, message: "Push service not set up yet — skipped." });
    }
    await triggerPushNotifications({
      name: "Test Alert",
      summary: "This is a test push notification from Nigeria Pulse admin.",
      intensity: 8,
    });
    res.json({ success: true, message: "Push sent" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/push/subscribe ─────────────────────────────────
router.post("/push/subscribe", async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ success: false, error: "Invalid subscription object" });
    }
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh,
        auth: subscription.keys?.auth,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
    res.json({ success: true, message: "Push subscription saved" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── module.exports must be the LAST line ─────────────────────
module.exports = router;
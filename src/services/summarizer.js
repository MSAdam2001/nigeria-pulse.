
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Groq = require("groq-sdk");
const supabase = require("../config/supabase");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─────────────────────────────────────────────────────────────
//  PROMPT
//  Both engines receive the exact same prompt for fair comparison
// ─────────────────────────────────────────────────────────────
function buildPrompt(articles) {
  const articleText = articles
    .slice(0, 80) // cap to avoid token overflow
    .map((a, i) => `[${i + 1}] SOURCE: ${a.source} | CATEGORY: ${a.category}\nTITLE: ${a.title}\nSUMMARY: ${a.summary?.slice(0, 300) || ""}`)
    .join("\n\n");

  return `You are Nigeria Pulse — an AI analyst monitoring Nigerian news, social media, and trends.

Analyze the articles below and return a JSON object. Return ONLY valid JSON, no markdown, no extra text.

REQUIRED JSON STRUCTURE:
{
  "top_topics": [
    {
      "name": "short topic name (3-6 words)",
      "summary": "2-3 sentence plain-English summary of what is happening and why it matters to Nigerians",
      "intensity": 8,
      "sentiment": "negative",
      "sentiment_reason": "one sentence explaining the sentiment score",
      "category": "politics",
      "in_govt_agenda": true,
      "foreign_impact": false,
      "sources_cited": ["Punch Nigeria", "Channels TV"],
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "foreign_alerts": [
    {
      "event": "brief description of global event",
      "nigeria_impact": "one sentence on how this affects Nigeria specifically"
    }
  ],
  "overall_sentiment": "mixed",
  "total_articles_analyzed": 45,
  "analysis_confidence": 0.85,
  "dominant_category": "politics",
  "generated_at": "${new Date().toISOString()}"
}

RULES:
- Return exactly 5 top_topics, ranked by public interest intensity
- intensity: 1-10 integer (10 = extremely viral/urgent)
- sentiment per topic: "positive" | "negative" | "neutral" | "mixed"
- overall_sentiment: "positive" | "negative" | "neutral" | "mixed"
- category: one of "politics" | "economy" | "security" | "entertainment" | "sports" | "technology" | "social" | "religion" | "health" | "international"
- in_govt_agenda: true if Nigerian federal/state government is directly involved
- foreign_impact: true if topic involves international actors or has global implications
- sources_cited: list up to 3 source names that covered this topic most
- keywords: 3-5 keywords for this topic
- analysis_confidence: 0.0-1.0, how confident you are given the data quality
- foreign_alerts: 0-3 items max, only include if genuinely relevant to Nigeria
- If data is sparse, still return valid JSON with best estimates

ARTICLES TO ANALYZE:
${articleText}`;
}

// ─────────────────────────────────────────────────────────────
//  SCORING — pick the better result
//  Scores based on: completeness, confidence, topic quality
// ─────────────────────────────────────────────────────────────
function scoreResult(parsed, engineName) {
  let score = 0;
  const reasons = [];

  if (!parsed || typeof parsed !== "object") return { score: 0, reasons: ["Invalid JSON"] };

  // Has all 5 topics
  const topicCount = parsed.top_topics?.length || 0;
  score += topicCount * 10;
  if (topicCount < 5) reasons.push(`Only ${topicCount}/5 topics`);

  // Each topic has required fields
  (parsed.top_topics || []).forEach((t, i) => {
    if (t.name?.length > 3) score += 5;
    if (t.summary?.length > 50) score += 5;
    if (t.sentiment) score += 3;
    if (t.sentiment_reason) score += 2;
    if (t.category) score += 2;
    if (Array.isArray(t.sources_cited) && t.sources_cited.length > 0) score += 3;
    if (Array.isArray(t.keywords) && t.keywords.length > 0) score += 2;
    if (typeof t.intensity === "number") score += 2;
    if (typeof t.in_govt_agenda === "boolean") score += 1;
    if (typeof t.foreign_impact === "boolean") score += 1;
  });

  // Confidence score bonus
  const confidence = parsed.analysis_confidence || 0;
  score += Math.round(confidence * 20);

  // Has overall_sentiment
  if (parsed.overall_sentiment) score += 5;
  if (parsed.dominant_category) score += 5;

  return { score, reasons, engine: engineName };
}

// ─────────────────────────────────────────────────────────────
//  GEMINI FLASH ENGINE
// ─────────────────────────────────────────────────────────────
async function runGemini(prompt) {
  try {
    console.log("  🔵 Gemini Flash: analyzing...");
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), 30000)
      ),
    ]);

    const text = result.response.text();
    // Strip markdown fences if present
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    console.log("  ✅ Gemini Flash: done");
    return { parsed, raw: text, engine: "gemini-flash" };
  } catch (err) {
    console.error("  ❌ Gemini Flash failed:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  GROQ ENGINE
// ─────────────────────────────────────────────────────────────
async function runGroq(prompt) {
  try {
    console.log("  🟠 Groq (LLaMA): analyzing...");
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Groq timeout")), 30000)
      ),
    ]);

    const text = completion.choices[0]?.message?.content || "";
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    console.log("  ✅ Groq: done");
    return { parsed, raw: text, engine: "groq-llama" };
  } catch (err) {
    console.error("  ❌ Groq failed:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  RACE + PICK BEST
// ─────────────────────────────────────────────────────────────
async function runDualEngineAnalysis(articles) {
  const prompt = buildPrompt(articles);

  console.log("\n🧠 Running dual-engine analysis (Gemini Flash + Groq)...");
  const [geminiResult, groqResult] = await Promise.all([
    runGemini(prompt),
    runGroq(prompt),
  ]);

  const candidates = [geminiResult, groqResult].filter(Boolean);

  if (candidates.length === 0) {
    console.error("❌ Both engines failed");
    return null;
  }

  // Score each result
  const scored = candidates.map((c) => ({
    ...c,
    ...scoreResult(c.parsed, c.engine),
  }));

  scored.forEach((s) => {
    console.log(`  📊 ${s.engine}: score=${s.score}${s.reasons.length ? ` (${s.reasons.join(", ")})` : ""}`);
  });

  // Pick the winner
  const winner = scored.sort((a, b) => b.score - a.score)[0];
  console.log(`\n🏆 Winner: ${winner.engine} (score: ${winner.score})`);

  // Attach metadata
  winner.parsed._engine_used = winner.engine;
  winner.parsed._engine_score = winner.score;
  winner.parsed._both_engines_ran = candidates.length === 2;
  winner.parsed.total_articles_analyzed = articles.length;

  return winner.parsed;
}

// ─────────────────────────────────────────────────────────────
//  FETCH RECENT ARTICLES from Supabase
// ─────────────────────────────────────────────────────────────
async function getRecentArticles() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("raw_signals")
    .select("source, category, title, summary, published_at")
    .gte("scraped_at", twoHoursAgo)
    .order("scraped_at", { ascending: false })
    .limit(150);

  if (error) {
    console.error("❌ Failed to fetch articles:", error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────
//  SAVE SUMMARY to Supabase
// ─────────────────────────────────────────────────────────────
async function saveSummary(summary) {
  const { error } = await supabase.from("summaries").insert({
    top_topics: summary.top_topics,
    foreign_alerts: summary.foreign_alerts,
    overall_sentiment: summary.overall_sentiment,
    dominant_category: summary.dominant_category,
    analysis_confidence: summary.analysis_confidence,
    total_articles_analyzed: summary.total_articles_analyzed,
    engine_used: summary._engine_used,
    engine_score: summary._engine_score,
    both_engines_ran: summary._both_engines_ran,
    generated_at: summary.generated_at || new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  if (error) console.error("❌ Summary save error:", error.message);
  else console.log(`💾 Summary saved (engine: ${summary._engine_used})`);
}

// ─────────────────────────────────────────────────────────────
//  MAIN RUNNER — called by cron every 2 hours
// ─────────────────────────────────────────────────────────────
async function runSummarizer() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🧠 SUMMARIZER — dual engine");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const articles = await getRecentArticles();

  if (articles.length < 5) {
    console.log(`⚠️  Only ${articles.length} articles — skipping (need at least 5)`);
    return null;
  }

  console.log(`📰 Analyzing ${articles.length} articles...`);
  const summary = await runDualEngineAnalysis(articles);

  if (!summary) {
    console.error("❌ Summarizer failed — no output from either engine");
    return null;
  }

  await saveSummary(summary);

  console.log("\n📊 Summary output:");
  console.log(`  Engine: ${summary._engine_used} (score: ${summary._engine_score})`);
  console.log(`  Both ran: ${summary._both_engines_ran}`);
  console.log(`  Confidence: ${summary.analysis_confidence}`);
  console.log(`  Sentiment: ${summary.overall_sentiment}`);
  console.log(`  Topics: ${summary.top_topics?.map((t) => t.name).join(" · ")}`);

  return summary;
}

module.exports = { runSummarizer, runDualEngineAnalysis };
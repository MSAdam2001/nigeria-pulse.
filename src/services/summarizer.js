const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase = require("../config/supabase");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getRecentArticles() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("raw_signals")
    .select("*")
    .gte("scraped_at", twoHoursAgo)
    .order("scraped_at", { ascending: false });

  if (error) { console.error("❌ Fetch error:", error.message); return []; }
  return data || [];
}

async function runSummarizer() {
  console.log("\n🧠 Running AI Summarizer...");
  const articles = await getRecentArticles();
  console.log(`📰 Found ${articles.length} recent articles`);

  if (articles.length === 0) return null;

  const articleList = articles.slice(0, 50).map((a, i) =>
    `${i + 1}. [${a.source}] ${a.title}\n   ${a.summary?.slice(0, 150) || ""}`
  ).join("\n\n");

  const prompt = `You are Nigeria Pulse — tracking what Nigerians are discussing right now.

NEWS ARTICLES (last 2 hours):
${articleList}

Return the TOP 5 trending topics as JSON only. No markdown, no explanation, no code fences.

{
  "generated_at": "${new Date().toISOString()}",
  "total_articles_analyzed": ${articles.length},
  "top_topics": [
    {
      "rank": 1,
      "name": "Short Topic Name",
      "summary": "One sentence max 20 words.",
      "intensity": 8,
      "sources": ["Source Name"],
      "in_govt_agenda": false
    }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    console.log("✅ Gemini summarized", parsed.top_topics.length, "topics");

    const { error } = await supabase.from("daily_summaries").insert({
      generated_at: new Date().toISOString(),
      top_topics: parsed.top_topics,
      total_articles_analyzed: articles.length,
    });

    if (error) console.error("❌ Save error:", error.message);
    else console.log("💾 Summary saved to Supabase");

    return parsed;
  } catch (err) {
    console.error("❌ Summarizer error:", err.message);
    return null;
  }
}

module.exports = { runSummarizer };
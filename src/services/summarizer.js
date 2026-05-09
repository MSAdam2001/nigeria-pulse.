const Groq = require("groq-sdk");
const supabase = require("../config/supabase");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

 const articleList = articles.slice(0, 35).map((a, i) =>
  `${i + 1}. [${a.source}] ${a.title}`
).join("\n");

  const prompt = `You are Nigeria Pulse — an AI intelligence analyst specializing in Nigerian public discourse and geopolitics.

You have two jobs:

JOB 1: TOP 5 NIGERIAN TOPICS
Analyze the articles and find the 5 most discussed topics IN Nigeria right now.

RULES FOR JOB 1:
- Focus on stories Nigerians are actually talking about
- Politics, economy, security, education, health, infrastructure
- Score intensity 1-10 based on volume of coverage and public interest
- Mark in_govt_agenda: true if government has responded or is involved

JOB 2: FOREIGN EVENTS AFFECTING NIGERIA
Scan for ANY foreign news that has a DIRECT impact on Nigeria through these channels:

OIL & ENERGY: Nigeria earns 90% of forex from oil. Any war, OPEC decision,
US shale news, or Middle East conflict that moves oil prices DIRECTLY affects
Nigeria's budget, Naira value, and fuel prices.

DOLLAR & FOREX: US Fed decisions, dollar strengthening, or any event that
affects USD availability hits Nigeria's import-dependent economy hard.

DIASPORA: 1.7 million Nigerians live abroad. Events in UK, USA, South Africa,
UAE that affect Nigerians abroad (deportations, policy changes, remittances).

TRADE & IMPORTS: Nigeria imports most of its food and goods. China slowdown,
Red Sea shipping disruptions, or EU trade policy changes affect Nigerian prices.

REGIONAL SECURITY: Events in Niger, Mali, Chad, Cameroon, Sudan directly
affect Nigeria's northern border security and Boko Haram dynamics.

FOOD & COMMODITIES: Global wheat, rice, or fertilizer price changes hit
Nigerian food inflation directly.

EXAMPLES OF WHAT TO FLAG:
- "Iran attacks Israel" = NIGERIA IMPACT: oil prices spike, fuel imports cost more
- "US Fed raises rates" = NIGERIA IMPACT: dollar strengthens, Naira pressure increases
- "South Africa xenophobia" = NIGERIA IMPACT: Nigerian diaspora at risk
- "OPEC cuts production" = NIGERIA IMPACT: Nigeria quota affected, oil revenue changes
- "France wins World Cup" = NOT relevant
- "US election results" = only relevant if it affects Nigeria policy or aid

NEWS ARTICLES + SOCIAL SIGNALS (last 2 hours from ${articles.length} sources):
Note: Sources labeled "Twitter Politics NG", "Twitter Economy NG", "Google Trends Nigeria" 
are social media signals — weight them heavily as they show what real Nigerians are 
discussing RIGHT NOW, not just what media is reporting.
${articleList}

Return ONLY valid JSON. No markdown, no explanation, no code fences.

{
  "generated_at": "${new Date().toISOString()}",
  "total_articles_analyzed": ${articles.length},
  "top_topics": [
    {
      "rank": 1,
      "name": "Short Topic Name",
      "summary": "One sentence max 20 words, Nigerian angle only.",
      "intensity": 8,
      "sources": ["Source Name"],
      "in_govt_agenda": false,
      "foreign_impact": false,
      "foreign_impact_reason": ""
    }
  ],
  "foreign_alerts": [
    {
      "event": "Name of foreign event",
      "country": "Country where it happened",
      "nigeria_impact": "Specific explanation of how this affects Nigeria",
      "impact_sector": "oil|forex|diaspora|trade|security|food|other",
      "impact_score": 7,
      "what_to_watch": "What Nigerians should monitor as a result"
    }
  ]
}`;

  try {
    const response = await groq.chat.completions.create({
  model: "llama-3.1-8b-instant",
  messages: [{ role: "user", content: prompt }],
  max_tokens: 800,
  temperature: 0.3,
});

    const raw = response.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    console.log("✅ Groq summarized", parsed.top_topics.length, "topics");
    if (parsed.foreign_alerts?.length > 0) {
      console.log(`🌍 ${parsed.foreign_alerts.length} foreign alerts detected`);
    }

    // Save to daily_summaries
    const { error } = await supabase.from("daily_summaries").insert({
      generated_at: new Date().toISOString(),
      top_topics: parsed.top_topics,
      total_articles_analyzed: articles.length,
      foreign_alerts: parsed.foreign_alerts || [],
    });

    if (error) {
      console.error("❌ Save error:", error.message);
    } else {
      console.log("💾 Summary saved to Supabase");

      // Save foreign alerts separately
      if (parsed.foreign_alerts && parsed.foreign_alerts.length > 0) {
        const alerts = parsed.foreign_alerts.map(a => ({
          ...a,
          generated_at: new Date().toISOString(),
        }));
        const { error: alertError } = await supabase
          .from("foreign_alerts")
          .insert(alerts);
        if (alertError) console.error("❌ Foreign alerts error:", alertError.message);
        else console.log(`🌍 ${alerts.length} foreign alerts saved`);
      }

      // Generate share image
      try {
        const { generatePulseImage } = require("./imageGenerator");
        const imageUrl = await generatePulseImage(parsed);
        if (imageUrl) {
          console.log("🖼️  Share image ready:", imageUrl);
          parsed.image_url = imageUrl;
        }
      } catch (imgErr) {
        console.error("⚠️  Image generation skipped:", imgErr.message);
      }
    }

    return parsed;
  } catch (err) {
    console.error("❌ Summarizer error:", err.message);
    return null;
  }
}

module.exports = { runSummarizer };
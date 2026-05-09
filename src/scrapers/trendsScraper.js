const supabase = require("../config/supabase");

async function scrapeGoogleTrends() {
  try {
    console.log("📈 Fetching Google Trends Nigeria via SerpAPI...");

    if (!process.env.SERPAPI_KEY) {
      console.log("⚠️  No SERPAPI_KEY — skipping Google Trends");
      return [];
    }

    const response = await fetch(
      `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=NG&api_key=${process.env.SERPAPI_KEY}`
    );
    const data = await response.json();

    if (!data.trending_searches) {
      console.log("⚠️  No trending searches returned");
      return [];
    }

    const trends = data.trending_searches.slice(0, 15).map(item => ({
      source: "Google Trends Nigeria",
      category: "trending_search",
      title: item.query || item.title || "",
      summary: `Trending search in Nigeria with ${item.search_volume || "high"} searches`,
      link: `https://trends.google.com/trends/explore?q=${encodeURIComponent(item.query || item.title)}&geo=NG`,
      published_at: new Date().toISOString(),
      scraped_at: new Date().toISOString(),
    }));

    console.log(`✅ Google Trends Nigeria: ${trends.length} trends`);

    if (trends.length > 0) {
      const { error } = await supabase
        .from("raw_signals")
        .upsert(trends, { onConflict: "link", ignoreDuplicates: true });
      if (error) console.error("❌ Trends save error:", error.message);
      else console.log("💾 Google Trends saved");
    }

    return trends;
  } catch (err) {
    console.error("❌ Google Trends error:", err.message);
    return [];
  }
}

module.exports = { scrapeGoogleTrends };
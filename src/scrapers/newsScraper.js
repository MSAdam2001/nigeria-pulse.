const Parser = require("rss-parser");
const supabase = require("../config/supabase");

const parser = new Parser();

const NEWS_SOURCES = [
  { name: "Punch Nigeria", url: "https://punchng.com/feed/", category: "general" },
  { name: "Vanguard Nigeria", url: "https://www.vanguardngr.com/feed/", category: "general" },
  { name: "Channels TV", url: "https://www.channelstv.com/feed/", category: "broadcast" },
  { name: "Premium Times", url: "https://www.premiumtimesng.com/feed", category: "investigative" },
  { name: "The Nation Nigeria", url: "https://thenationonlineng.net/feed/", category: "general" },
  { name: "Daily Trust", url: "https://dailytrust.com/feed", category: "northern" },
  { name: "BusinessDay Nigeria", url: "https://businessday.ng/feed/", category: "business" },
  { name: "Sahara Reporters", url: "https://saharareporters.com/rss.xml", category: "independent" },
];

async function scrapeRSSFeed(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const articles = feed.items.slice(0, 10).map((item) => ({
      source: source.name,
      category: source.category,
      title: item.title || "",
      summary: item.contentSnippet || item.content || "",
      link: item.link || "",
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      scraped_at: new Date().toISOString(),
    }));
    console.log(`✅ ${source.name}: ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.error(`❌ Failed: ${source.name} — ${err.message}`);
    return [];
  }
}

async function runAllScrapers() {
  console.log("\n🚀 Starting scraper...");
  const results = await Promise.allSettled(NEWS_SOURCES.map(scrapeRSSFeed));
  const allArticles = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  console.log(`📰 Total articles: ${allArticles.length}`);

  if (allArticles.length === 0) return [];

  const { error } = await supabase
    .from("raw_signals")
    .upsert(allArticles, { onConflict: "link", ignoreDuplicates: true });

  if (error) console.error("❌ Supabase error:", error.message);
  else console.log("💾 Saved to Supabase");

  return allArticles;
}

module.exports = { runAllScrapers };
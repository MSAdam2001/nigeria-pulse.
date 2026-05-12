const Parser = require("rss-parser");
const supabase = require("../config/supabase");

const parser = new Parser();

const NEWS_SOURCES = [
  { name: "Punch Nigeria", url: "https://punchng.com/feed/", category: "general" },
  { name: "Vanguard Nigeria", url: "https://www.vanguardngr.com/feed/", category: "general" },
  { name: "Tribune Nigeria", url: "https://tribuneonlineng.com/feed/", category: "general" },
  { name: "Sun Nigeria", url: "https://www.sunnewsonline.com/feed/", category: "general" },
  { name: "Leadership Nigeria", url: "https://leadership.ng/feed/", category: "general" },
  { name: "Blueprint Nigeria", url: "https://www.blueprint.ng/feed/", category: "general" },
  { name: "Daily Post Nigeria", url: "https://dailypost.ng/feed/", category: "general" },
  { name: "Legit Nigeria", url: "https://www.legit.ng/rss/all.rss", category: "general" },
  { name: "Naija News", url: "https://www.naijanews.com/feed/", category: "general" },
  { name: "Naija247News", url: "https://www.naija247news.com/feed/", category: "general" },
  { name: "Premium Times", url: "https://www.premiumtimesng.com/feed", category: "investigative" },
  { name: "Sahara Reporters", url: "https://saharareporters.com/rss.xml", category: "independent" },
  { name: "HumAngle", url: "https://humanglemedia.com/feed/", category: "investigative" },
  { name: "Channels TV", url: "https://www.channelstv.com/feed/", category: "broadcast" },
  { name: "TVC News", url: "https://www.tvcnews.tv/feed/", category: "broadcast" },
  { name: "Daily Trust", url: "https://dailytrust.com/feed", category: "northern" },
  { name: "Arewa Agenda", url: "https://arewa24.com/feed/", category: "northern" },
  { name: "Nairametrics", url: "https://nairametrics.com/feed/", category: "business" },
  // International sources covering Nigeria/Africa
  { name: "BBC Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", category: "international" },
  { name: "Al Jazeera Africa", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "international" },
  { name: "BusinessDay Nigeria", url: "http://businessday.ng/feed/", category: "business" },
  { name: "Arise News",          url: "https://www.arise.tv/feed/", category: "broadcast" }, 
  { name: "TheCable Nigeria", url: "https://www.thecable.ng/feed/", category: "investigative" },

 
];

async function scrapeRSSFeed(source) {
  try {
    const feed = await Promise.race([
      parser.parseURL(source.url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 10000)
      ),
    ]);
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
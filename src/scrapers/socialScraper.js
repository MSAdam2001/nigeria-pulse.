const Parser = require("rss-parser");
const supabase = require("../config/supabase");

const parser = new Parser();

const SOCIAL_FEEDS = [
  // ── REDDIT ──
  {
    name: "Reddit Nigeria",
    url: "https://www.reddit.com/r/Nigeria/new.json?limit=15",
    category: "social_reddit",
  },
  {
    name: "Reddit Nigeria Politics",
    url: "https://www.reddit.com/r/Nigeria/search.json?q=politics&sort=new&limit=10",
    category: "social_reddit",
  },
  {
    name: "Reddit Naija Economy",
    url: "https://www.reddit.com/r/Nigeria/search.json?q=economy+naira&sort=new&limit=10",
    category: "social_reddit",
  },

  // ── YOUTUBE — verified channel IDs from YouTube URLs ──
  {
    name: "Channels TV YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCEXGDNclvmg6RW0vipJYsTQ",
    category: "social_video",
  },
  {
    name: "TVC News YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCgp4A6I8LCWrhUzn-5SbKvA",
    category: "social_video",
  },
  {
    name: "Arise News YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCyEJX-kSj0kOOCS7Qlq2G7g",
    category: "social_video",
  },
  {
    name: "Guardian Nigeria YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCjV6LnXFtXzWoYxnq-zIvXw",
    category: "social_video",
  },
  {
    name: "TV360 Nigeria YouTube",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCBzu4YqGiBxBD8pq8NiBuKw",
    category: "social_video",
  },

  // ── CATEGORY RSS FEEDS (confirmed working in your terminal) ──
  {
    name: "Daily Post Politics",
    url: "https://dailypost.ng/category/politics/feed/",
    category: "social_signal",
  },
  {
    name: "Legit Politics NG",
    url: "https://www.legit.ng/rss/politics.rss",
    category: "social_signal",
  },
  {
    name: "Legit Economy NG",
    url: "https://www.legit.ng/rss/economy.rss",
    category: "social_signal",
  },
  
  {
    name: "ThisDay Nigeria",
    url: "https://www.thisdaylive.com/index.php/feed/",
    category: "social_signal",
  },
  
];

async function runSocialScrapers() {
  console.log("\n📱 Running Social Media Scrapers...");
  let allPosts = [];

  for (const feed of SOCIAL_FEEDS) {
    try {
      // ── REDDIT JSON (handles both /new and /search endpoints) ──
      if (feed.url.includes("reddit.com")) {
        const res = await Promise.race([
          fetch(feed.url, {
            headers: {
              "User-Agent": "NigeriaPulse/1.0 (news aggregator)",
              "Accept": "application/json",
            },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 8000)
          ),
        ]);

        if (!res.ok) throw new Error(`Status code ${res.status}`);

        const data = await res.json();
        const children = data?.data?.children || [];

        if (children.length === 0) {
          console.log(`⚠️  ${feed.name}: 0 posts`);
          continue;
        }

        const posts = children.slice(0, 12).map((p) => ({
          source: feed.name,
          category: feed.category,
          title: p.data.title || "",
          summary:
            p.data.selftext?.slice(0, 200) ||
            `👍 ${p.data.score} upvotes · 💬 ${p.data.num_comments} comments`,
          link: `https://reddit.com${p.data.permalink}`,
          published_at: new Date(p.data.created_utc * 1000).toISOString(),
          scraped_at: new Date().toISOString(),
        }));
        allPosts = [...allPosts, ...posts];
        console.log(`✅ ${feed.name}: ${posts.length} posts`);
        continue;
      }

      // ── STANDARD RSS (YouTube + category feeds) ──
      const result = await Promise.race([
        parser.parseURL(feed.url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 10000)
        ),
      ]);

      const posts = result.items.slice(0, 8).map((item) => ({
        source: feed.name,
        category: feed.category,
        title: item.title?.slice(0, 200) || "",
        summary: item.contentSnippet?.slice(0, 200) || "",
        link: item.link || "",
        published_at: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
        scraped_at: new Date().toISOString(),
      }));

      allPosts = [...allPosts, ...posts];
      console.log(`✅ ${feed.name}: ${posts.length} posts`);

    } catch (err) {
      console.error(`❌ ${feed.name}: ${err.message}`);
    }
  }

  if (allPosts.length > 0) {
    const { error } = await supabase
      .from("raw_signals")
      .upsert(allPosts, { onConflict: "link", ignoreDuplicates: true });
    if (error) console.error("❌ Social save error:", error.message);
    else console.log(`💾 ${allPosts.length} social posts saved`);
  }

  console.log(`📱 Social done: ${allPosts.length} signals`);
  return allPosts;
}

module.exports = { runSocialScrapers };
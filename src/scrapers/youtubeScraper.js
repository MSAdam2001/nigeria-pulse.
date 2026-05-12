const Parser = require("rss-parser");
const supabase = require("../config/supabase");

const parser = new Parser();

// ─────────────────────────────────────────────────────────────
//  NIGERIAN YOUTUBE CHANNELS — IDs verified May 2026
//  Source: live youtube.com/channel/ID URLs
// ─────────────────────────────────────────────────────────────
const NIGERIAN_CHANNELS = [
  // Broadcast / TV
  { name: "Channels TV",        id: "UCEXGDNclvmg6RW0vipJYsTQ" }, // ✅ fixed
  { name: "TVC News Nigeria",   id: "UCgp4A6I8LCWrhUzn-5SbKvA" }, // ✅ fixed
  { name: "Arise News",         id: "UCyEJX-kSj0kOOCS7Qlq2G7g" }, // ✅ fixed
  { name: "NTA Network",        id: "UCLLWAXn5F415g2kNAcE_T1g" }, // ✅ fixed

  // Print → video
  { name: "Punch Newspapers",   id: "UCKBMh5v6VrB0t75ryyiVsBg" }, // ✅ fixed
  { name: "Vanguard News TV",   id: "UCkRLkFEEJR3o7QYm1r8_5yg" }, // ✅ fixed
  { name: "Guardian Nigeria",   id: "UCjV6LnXFtXzWoYxnq-zIvXw" }, // ✅ new
];

// ─────────────────────────────────────────────────────────────
//  SHARED FETCH HEADERS
//  Prevents YouTube from returning 404 to bot-like requests
// ─────────────────────────────────────────────────────────────
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/rss+xml, application/xml, text/xml, */*",
};

// ─────────────────────────────────────────────────────────────
//  1. VIDEOS via YouTube RSS (no API key needed)
// ─────────────────────────────────────────────────────────────
async function scrapeYouTubeTrending() {
  console.log("\n📺 Scraping YouTube RSS feeds...");
  const allVideos = [];

  const results = await Promise.allSettled(
    NIGERIAN_CHANNELS.map(async (channel) => {
      try {
        const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;

        // Pass User-Agent headers so YouTube serves the feed
        const customParser = new Parser({
          headers: HEADERS,
          timeout: 10000,
        });

        const feed = await Promise.race([
          customParser.parseURL(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          ),
        ]);

        const videos = feed.items.slice(0, 5).map((item) => ({
          source: `YouTube — ${channel.name}`,
          category: "social_video",
          title: item.title || "",
          summary:
            item.contentSnippet?.slice(0, 200) ||
            item.content?.slice(0, 200) ||
            "",
          link: item.link || "",
          published_at: item.pubDate
            ? new Date(item.pubDate).toISOString()
            : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
        }));

        console.log(`  ✅ ${channel.name}: ${videos.length} videos`);
        return videos;
      } catch (err) {
        console.error(`  ❌ YouTube RSS: ${channel.name} — ${err.message}`);
        return [];
      }
    })
  );

  results
    .filter((r) => r.status === "fulfilled")
    .forEach((r) => allVideos.push(...r.value));

  console.log(`✅ YouTube videos (RSS): ${allVideos.length} total`);

  if (allVideos.length > 0) {
    const { error } = await supabase
      .from("raw_signals")
      .upsert(allVideos, { onConflict: "link", ignoreDuplicates: true });
    if (error) console.error("❌ YouTube video save error:", error.message);
    else console.log("💾 YouTube videos saved");
  }

  return allVideos;
}

// ─────────────────────────────────────────────────────────────
//  2. COMMENTS via YouTube Data API v3
//     Requires YOUTUBE_API_KEY in .env
//     Free tier: 10,000 units/day
// ─────────────────────────────────────────────────────────────
async function fetchCommentsForVideo(videoId, channelName) {
  if (!process.env.YOUTUBE_API_KEY) return [];

  try {
    const url = new URL(
      "https://www.googleapis.com/youtube/v3/commentThreads"
    );
    url.searchParams.set("part", "snippet");
    url.searchParams.set("videoId", videoId);
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("order", "relevance");
    url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

    const res = await Promise.race([
      fetch(url.toString(), { headers: HEADERS }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 8000)
      ),
    ]);

    if (!res.ok) {
      if (res.status === 403) return []; // comments disabled — silent skip
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data.items) return [];

    return data.items.map((item) => {
      const c = item.snippet.topLevelComment.snippet;
      return {
        source: `YouTube Comments — ${channelName}`,
        category: "youtube_comment",
        title: c.textOriginal?.slice(0, 200) || "",
        summary: `👍 ${c.likeCount} likes · by ${c.authorDisplayName}`,
        link: `https://www.youtube.com/watch?v=${videoId}&lc=${item.id}`,
        published_at: c.publishedAt || new Date().toISOString(),
        scraped_at: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error(`  ❌ Comments fetch (${videoId}): ${err.message}`);
    return [];
  }
}

async function scrapeYouTubeComments() {
  if (!process.env.YOUTUBE_API_KEY) {
    console.log("⚠️  No YOUTUBE_API_KEY — skipping comments");
    return [];
  }

  console.log("\n💬 Scraping YouTube comments via Data API...");
  const allComments = [];

  for (const channel of NIGERIAN_CHANNELS) {
    try {
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
      const customParser = new Parser({ headers: HEADERS, timeout: 8000 });

      const feed = await Promise.race([
        customParser.parseURL(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 8000)
        ),
      ]);

      const latestItem = feed.items[0];
      if (!latestItem?.link) continue;

      const videoId = new URL(latestItem.link).searchParams.get("v");
      if (!videoId) continue;

      console.log(`  💬 ${channel.name}: "${latestItem.title?.slice(0, 50)}..."`);
      const comments = await fetchCommentsForVideo(videoId, channel.name);
      allComments.push(...comments);

      await new Promise((r) => setTimeout(r, 500)); // quota protection
    } catch (err) {
      console.error(`  ❌ Comment scrape: ${channel.name} — ${err.message}`);
    }
  }

  console.log(`✅ YouTube comments (API): ${allComments.length} total`);

  if (allComments.length > 0) {
    const { error } = await supabase
      .from("raw_signals")
      .upsert(allComments, { onConflict: "link", ignoreDuplicates: true });
    if (error) console.error("❌ YouTube comments save error:", error.message);
    else console.log("💾 YouTube comments saved");
  }

  return allComments;
}

// ─────────────────────────────────────────────────────────────
//  COMBINED RUNNER
// ─────────────────────────────────────────────────────────────
async function runYouTubeScraper() {
  const [videos, comments] = await Promise.all([
    scrapeYouTubeTrending(),
    scrapeYouTubeComments(),
  ]);
  return [...videos, ...comments];
}

module.exports = { runYouTubeScraper, scrapeYouTubeTrending, scrapeYouTubeComments };
const Parser = require("rss-parser");
const supabase = require("../config/supabase");

const parser = new Parser();

// ─────────────────────────────────────────────────────────────
//  NIGERIAN YOUTUBE CHANNELS TO MONITOR
//  Add/remove channel IDs as needed
// ─────────────────────────────────────────────────────────────
const NIGERIAN_CHANNELS = [
  { name: "Channels TV",        id: "UCzLHODRACGYckCLgrpPAe4g" },
  { name: "TVC News Nigeria",   id: "UCh3qlpBMR3tBBbgn4ib5qeg" },
  { name: "Arise News",         id: "UCp4KNUFIxXKABQw1tiO2hxQ" },
  { name: "Punch Newspapers",   id: "UCbYCGGEITnMOoWBJLrVdgcQ" },
  { name: "Vanguard Newspaper", id: "UCnvHdqAmJlnjW0pHKXx9GYg" },
  { name: "Daily Trust",        id: "UCx2xzNTj_4_SyKM3xjlzNUw" },
  { name: "NTA News",           id: "UCt2JxRqC2bjzFtfN6RbhGRw" },
];

// ─────────────────────────────────────────────────────────────
//  1. TRENDING — YouTube RSS (no API key needed)
//     Each channel has a public RSS feed of its latest uploads
// ─────────────────────────────────────────────────────────────
async function scrapeYouTubeTrending() {
  console.log("\n📺 Scraping YouTube trending videos...");
  const allVideos = [];

  const results = await Promise.allSettled(
    NIGERIAN_CHANNELS.map(async (channel) => {
      try {
        const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
        const feed = await Promise.race([
          parser.parseURL(url),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          ),
        ]);

        return feed.items.slice(0, 5).map((item) => ({
          source: `YouTube — ${channel.name}`,
          category: "youtube_video",
          title: item.title || "",
          summary: item.contentSnippet || item.content || "",
          link: item.link || "",
          published_at: item.pubDate
            ? new Date(item.pubDate).toISOString()
            : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
          // extra metadata stored in summary prefix
          meta_channel_id: channel.id,
          meta_channel_name: channel.name,
        }));
      } catch (err) {
        console.error(`❌ YouTube RSS failed: ${channel.name} — ${err.message}`);
        return [];
      }
    })
  );

  results
    .filter((r) => r.status === "fulfilled")
    .forEach((r) => allVideos.push(...r.value));

  console.log(`✅ YouTube trending: ${allVideos.length} videos`);

  if (allVideos.length > 0) {
    const { error } = await supabase
      .from("raw_signals")
      .upsert(allVideos, { onConflict: "link", ignoreDuplicates: true });
    if (error) console.error("❌ YouTube trending save error:", error.message);
    else console.log("💾 YouTube trending saved");
  }

  return allVideos;
}

// ─────────────────────────────────────────────────────────────
//  2. COMMENTS — YouTube Data API v3
//     Pulls top comments from the latest video of each channel
//     Requires YOUTUBE_API_KEY in .env
// ─────────────────────────────────────────────────────────────
async function fetchCommentsForVideo(videoId, channelName) {
  if (!process.env.YOUTUBE_API_KEY) return [];

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("videoId", videoId);
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("order", "relevance");
    url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

    const res = await Promise.race([
      fetch(url.toString()),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 8000)
      ),
    ]);

    if (!res.ok) {
      // Comments disabled on this video — not an error
      if (res.status === 403) return [];
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
    console.error(`❌ Comments fetch failed (${videoId}): ${err.message}`);
    return [];
  }
}

async function scrapeYouTubeComments() {
  if (!process.env.YOUTUBE_API_KEY) {
    console.log("⚠️  No YOUTUBE_API_KEY — skipping YouTube comments");
    return [];
  }

  console.log("\n💬 Scraping YouTube comments...");
  const allComments = [];

  for (const channel of NIGERIAN_CHANNELS) {
    try {
      // Get the latest video ID from this channel's RSS feed
      const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`;
      const feed = await Promise.race([
        parser.parseURL(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 8000)
        ),
      ]);

      const latestItem = feed.items[0];
      if (!latestItem?.link) continue;

      // Extract video ID from URL
      const videoId = new URL(latestItem.link).searchParams.get("v");
      if (!videoId) continue;

      console.log(`  💬 ${channel.name}: fetching comments on "${latestItem.title?.slice(0, 50)}..."`);
      const comments = await fetchCommentsForVideo(videoId, channel.name);
      allComments.push(...comments);

      // Respect YouTube API quota — small delay between channels
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`❌ Comment scrape failed: ${channel.name} — ${err.message}`);
    }
  }

  console.log(`✅ YouTube comments: ${allComments.length} comments`);

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
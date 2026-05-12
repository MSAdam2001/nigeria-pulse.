const cheerio = require("cheerio");
const supabase = require("../config/supabase");

// ─────────────────────────────────────────
//  BOARDS TO SCRAPE
//  These are the most active Nigerian-focused boards on Nairaland
// ─────────────────────────────────────────
const NAIRALAND_BOARDS = [
  { name: "Nairaland Front Page",  url: "https://www.nairaland.com",                  category: "social_nairaland" },
  { name: "Nairaland Politics",    url: "https://www.nairaland.com/politics",          category: "social_nairaland" },
  { name: "Nairaland Business",    url: "https://www.nairaland.com/business",          category: "social_nairaland" },
  { name: "Nairaland Crime",       url: "https://www.nairaland.com/crime",             category: "social_nairaland" },
  { name: "Nairaland Investment",  url: "https://www.nairaland.com/investment",        category: "social_nairaland" },
  { name: "Nairaland Nigeria",     url: "https://www.nairaland.com/nigeria",           category: "social_nairaland" },
  { name: "Nairaland Education",   url: "https://www.nairaland.com/education",         category: "social_nairaland" },
  { name: "Nairaland Health",      url: "https://www.nairaland.com/health",            category: "social_nairaland" },
];

const BASE_URL = "https://www.nairaland.com";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
};

// ─────────────────────────────────────────
//  PARSE A SINGLE BOARD PAGE
// ─────────────────────────────────────────
function parseBoardPage(html, boardName, category) {
  const $ = cheerio.load(html);
  const posts = [];

  // Nairaland board pages: topics listed in <table> rows
  // Each topic row has: title link, author, reply count, view count, last post time
  $("table").each((tableIndex, table) => {
    $(table).find("tr").each((rowIndex, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      // Title cell — Nairaland topic links are like /1234567/topic-slug
      const titleCell = cells.eq(1);
      const titleLink = titleCell.find("a").first();
      const title = titleLink.text().trim();
      const href = titleLink.attr("href");

      if (!title || !href || href === "/" || !href.match(/^\/\d+\//)) return;
      if (title.length < 10) return; // skip nav/garbage rows

      const link = `${BASE_URL}${href}`;

      // Stats: replies and views are in later cells
      const replies = cells.eq(2).text().trim().replace(/,/g, "") || "0";
      const views   = cells.eq(3).text().trim().replace(/,/g, "") || "0";

      // Last activity timestamp — Nairaland shows relative time like "2hrs"
      // We parse it into a real ISO date
      const timeText = cells.last().text().trim();
      const published_at = parseNairalandTime(timeText);

      // Author
      const author = cells.eq(0).text().trim() || "Anonymous";

      posts.push({
        source: boardName,
        category,
        title: title.slice(0, 200),
        summary: `💬 ${replies} replies · 👁 ${views} views · by ${author}`,
        link,
        published_at,
        scraped_at: new Date().toISOString(),
      });
    });
  });

  return posts;
}

// ─────────────────────────────────────────
//  PARSE NAIRALAND RELATIVE TIME
//  e.g. "2hrs", "34mins", "5secs", "3days", "1wk"
// ─────────────────────────────────────────
function parseNairalandTime(text) {
  if (!text) return new Date().toISOString();

  const now = Date.now();
  const t = text.toLowerCase().trim();

  const match = t.match(/^(\d+)\s*(sec|min|hr|day|wk|mon|yr)/);
  if (!match) return new Date().toISOString();

  const value = parseInt(match[1]);
  const unit  = match[2];

  const msMap = {
    sec: 1000,
    min: 60 * 1000,
    hr:  60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    wk:  7  * 24 * 60 * 60 * 1000,
    mon: 30 * 24 * 60 * 60 * 1000,
    yr:  365 * 24 * 60 * 60 * 1000,
  };

  const ms = msMap[unit] || 0;
  return new Date(now - value * ms).toISOString();
}

// ─────────────────────────────────────────
//  FETCH + PARSE ONE BOARD
// ─────────────────────────────────────────
async function scrapeBoard(board) {
  try {
    const res = await Promise.race([
      fetch(board.url, { headers: HEADERS }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000)),
    ]);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    if (!html.includes("nairaland")) {
      throw new Error("Unexpected response — possible block");
    }

    const posts = parseBoardPage(html, board.name, board.category);

    // Take top 15 most recent/active threads per board
    const top = posts.slice(0, 15);
    console.log(`✅ ${board.name}: ${top.length} threads`);
    return top;

  } catch (err) {
    console.error(`❌ ${board.name}: ${err.message}`);
    return [];
  }
}

// ─────────────────────────────────────────
//  MAIN RUNNER
// ─────────────────────────────────────────
async function runNairalandScraper() {
  console.log("\n🇳🇬 Running Nairaland Scraper...");

  let allPosts = [];

  // Scrape boards sequentially with a small delay
  // (Nairaland blocks aggressive parallel requests)
  for (const board of NAIRALAND_BOARDS) {
    const posts = await scrapeBoard(board);
    allPosts = [...allPosts, ...posts];
    await new Promise((r) => setTimeout(r, 1500)); // 1.5s between boards
  }

  if (allPosts.length === 0) {
    console.log("⚠️  Nairaland: 0 posts scraped — may be blocked or structure changed");
    return [];
  }

  // Deduplicate by link before saving
  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.link)) return false;
    seen.add(p.link);
    return true;
  });

  const { error } = await supabase
    .from("raw_signals")
    .upsert(unique, { onConflict: "link", ignoreDuplicates: true });

  if (error) console.error("❌ Nairaland save error:", error.message);
  else console.log(`💾 ${unique.length} Nairaland threads saved`);

  console.log(`🇳🇬 Nairaland done: ${unique.length} unique threads from ${NAIRALAND_BOARDS.length} boards`);
  return unique;
}

module.exports = { runNairalandScraper };
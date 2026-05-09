const puppeteer = require("puppeteer");
const supabase = require("../config/supabase");
const fs = require("fs");
const path = require("path");

async function generatePulseImage(summaryData) {
  console.log("\n🎨 Generating share image...");

  const { top_topics, total_articles_analyzed, generated_at } = summaryData;

  const rankColors = ["#FFD600", "#FFFFFF", "#FF6B35", "#A0A0A0", "#707070"];

  function intensityColor(v) {
    return v >= 8 ? "#FF6B35" : v >= 5 ? "#FFD600" : "#00C853";
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("en-NG", {
      hour: "2-digit", minute: "2-digit",
    });
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString("en-NG", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }

  const topicsHTML = top_topics.map((t, i) => {
    const color = intensityColor(t.intensity);
    const rankColor = rankColors[i] || "#555";
    const isTop = i === 0;
    return `
    <div style="
      display:flex;align-items:stretch;gap:0;
      border-radius:12px;overflow:hidden;
      border:1px solid ${isTop ? '#333' : '#1e1e1e'};
      background:${isTop ? '#181818' : '#141414'};
      margin-bottom:10px;
    ">
      <!-- Left accent bar -->
      <div style="width:4px;background:${color};flex-shrink:0;"></div>

      <!-- Rank -->
      <div style="
        width:64px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        border-right:1px solid #1e1e1e;
      ">
        <span style="
          font-family:'Syne',sans-serif;
          font-size:${isTop ? '28px' : '22px'};
          font-weight:800;
          color:${rankColor};
          opacity:${isTop ? '1' : '0.7'};
        ">${String(i + 1).padStart(2, "0")}</span>
      </div>

      <!-- Content -->
      <div style="flex:1;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
          <p style="
            font-family:'Syne',sans-serif;
            font-size:${isTop ? '16px' : '14px'};
            font-weight:700;
            color:#f0ede6;
            margin:0;
          ">${t.name}</p>
          ${t.in_govt_agenda ? `
          <span style="
            font-size:9px;
            background:rgba(0,135,81,0.2);
            border:1px solid rgba(0,200,83,0.3);
            color:#00C853;
            border-radius:4px;
            padding:2px 7px;
            letter-spacing:0.06em;
            font-weight:600;
            flex-shrink:0;
          ">GOVT</span>` : ""}
          ${t.foreign_impact ? `
          <span style="
            font-size:9px;
            background:rgba(255,107,53,0.15);
            border:1px solid rgba(255,107,53,0.3);
            color:#FF6B35;
            border-radius:4px;
            padding:2px 7px;
            letter-spacing:0.06em;
            font-weight:600;
            flex-shrink:0;
          ">GLOBAL</span>` : ""}
        </div>
        <p style="
          font-size:12px;
          color:#888;
          margin:0;
          line-height:1.5;
        ">${t.summary}</p>
      </div>

      <!-- Intensity -->
      <div style="
        width:64px;flex-shrink:0;
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        gap:6px;
        border-left:1px solid #1e1e1e;
        padding:0 12px;
      ">
        <span style="
          font-family:'Syne',sans-serif;
          font-size:20px;font-weight:800;
          color:${color};
        ">${t.intensity}</span>
        <div style="width:32px;height:3px;background:#2a2a2a;border-radius:2px;">
          <div style="width:${t.intensity * 10}%;height:100%;background:${color};border-radius:2px;"></div>
        </div>
      </div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a0a; width: 640px; font-family: 'DM Sans', sans-serif; }
  </style>
</head>
<body>
<div style="width:640px;background:#0a0a0a;padding:0;">

  <!-- Top green stripe -->
  <div style="height:4px;background:linear-gradient(90deg,#008751 0%,#00C853 100%);width:100%;"></div>

  <!-- Main content -->
  <div style="padding:32px 32px 28px;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="
          width:42px;height:42px;border-radius:10px;
          background:#008751;
          display:flex;align-items:center;justify-content:center;
          font-size:22px;line-height:1;
        ">🇳🇬</div>
        <div>
          <h1 style="
            font-family:'Syne',sans-serif;
            font-size:22px;font-weight:800;
            color:#f0ede6;
            letter-spacing:-0.02em;margin:0;line-height:1;
          ">NIGERIA <span style="color:#008751;">PULSE</span></h1>
          <p style="font-size:10px;color:#3a3a3a;letter-spacing:0.15em;margin:3px 0 0;">REAL-TIME SENTIMENT INTELLIGENCE</p>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="
          display:inline-flex;align-items:center;gap:6px;
          background:rgba(0,200,83,0.1);
          border:1px solid rgba(0,200,83,0.25);
          border-radius:20px;padding:5px 14px;
          margin-bottom:5px;
        ">
          <div style="width:6px;height:6px;border-radius:50%;background:#00C853;"></div>
          <span style="font-size:11px;color:#00C853;font-weight:600;letter-spacing:0.1em;">LIVE</span>
        </div>
        <p style="font-size:10px;color:#3a3a3a;margin:0;">${formatDate(generated_at)}</p>
      </div>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:#1a1a1a;margin-bottom:24px;"></div>

    <!-- Headline -->
    <div style="margin-bottom:20px;">
      <p style="font-size:10px;color:#008751;letter-spacing:0.2em;font-weight:600;margin:0 0 6px;">TOP 5 TRENDING IN NIGERIA</p>
      <h2 style="
        font-family:'Syne',sans-serif;
        font-size:28px;font-weight:800;
        color:#f0ede6;
        letter-spacing:-0.03em;line-height:1.05;margin:0 0 12px;
      ">What Nigeria is<br><span style="color:#2a2a2a;">talking about right now</span></h2>
      <div style="display:flex;gap:20px;">
        <span style="font-size:11px;color:#3a3a3a;">
          <span style="color:#555;">${total_articles_analyzed}</span> articles analyzed
        </span>
        <span style="font-size:11px;color:#2a2a2a;">·</span>
        <span style="font-size:11px;color:#3a3a3a;">
          Generated <span style="color:#555;">${formatTime(generated_at)}</span> WAT
        </span>
        <span style="font-size:11px;color:#2a2a2a;">·</span>
        <span style="font-size:11px;color:#3a3a3a;">
          <span style="color:#555;">19</span> sources
        </span>
      </div>
    </div>

    <!-- Topics -->
    <div style="margin-bottom:24px;">
      ${topicsHTML}
    </div>

    <!-- Divider -->
    <div style="height:1px;background:#1a1a1a;margin-bottom:20px;"></div>

    <!-- Footer -->
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;gap:20px;">
        <div>
          <p style="font-size:9px;color:#2a2a2a;letter-spacing:0.1em;margin:0 0 2px;">SOURCES</p>
          <p style="font-size:11px;color:#444;margin:0;">Punch · Vanguard · Channels · Premium Times + 15 more</p>
        </div>
      </div>
      <div style="text-align:right;">
        <p style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#1e1e1e;letter-spacing:0.05em;margin:0;">nigeriapulse.ng</p>
        <p style="font-size:9px;color:#2a2a2a;margin:2px 0 0;letter-spacing:0.08em;">AUTO-REFRESHES EVERY 2 HOURS</p>
      </div>
    </div>

  </div>

  <!-- Bottom green stripe -->
  <div style="height:3px;background:linear-gradient(90deg,#00C853 0%,#008751 100%);width:100%;"></div>

</div>
</body>
</html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
      timeout: 60000,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 640, height: 900 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    await new Promise(r => setTimeout(r, 1500));

    const height = await page.evaluate(() => {
      return document.querySelector("div").scrollHeight;
    });

    await page.setViewport({ width: 640, height: height + 4 });

    const screenshotBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 640, height: height + 4 },
    });

    await browser.close();

    const outputDir = path.join(__dirname, "../../public/images");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const filename = `pulse-${Date.now()}.png`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, screenshotBuffer);
    console.log(`✅ Image saved: public/images/${filename}`);

    const { data, error } = await supabase.storage
      .from("pulse-images")
      .upload(`cards/${filename}`, screenshotBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (error) {
      console.error("❌ Supabase storage error:", error.message);
      return `http://localhost:3001/images/${filename}`;
    }

    const { data: urlData } = supabase.storage
      .from("pulse-images")
      .getPublicUrl(`cards/${filename}`);

    console.log("✅ Image uploaded:", urlData.publicUrl);
    return urlData.publicUrl;

  } catch (err) {
    console.error("❌ Image generation error:", err.message);
    if (browser) await browser.close();
    return null;
  }
}

module.exports = { generatePulseImage };
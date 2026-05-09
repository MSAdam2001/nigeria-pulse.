const { Resend } = require("resend");
require("dotenv").config();

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailHTML(data) {
  const { top_topics, nairaRate, foreignAlerts, date } = data;

  const topicsHTML = top_topics.map((t, i) => {
    const rankColors = ["#FFD600", "#FFFFFF", "#FF6B35", "#888888", "#666666"];
    const intensityColor = t.intensity >= 8 ? "#FF6B35" : t.intensity >= 5 ? "#FFD600" : "#00C853";
    return `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #1e1e1e;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="40" style="vertical-align: top;">
                <span style="font-family: Arial, sans-serif; font-size: 20px; font-weight: 900; color: ${rankColors[i]}; opacity: 0.8;">
                  ${String(i + 1).padStart(2, "0")}
                </span>
              </td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="margin-bottom: 4px;">
                  ${t.in_govt_agenda ? `<span style="background: rgba(0,135,81,0.2); border: 1px solid rgba(0,200,83,0.3); color: #00C853; border-radius: 3px; padding: 2px 6px; font-size: 10px; font-weight: 600; margin-right: 6px;">GOVT AGENDA</span>` : ""}
                  ${t.foreign_impact ? `<span style="background: rgba(255,107,53,0.2); border: 1px solid rgba(255,107,53,0.3); color: #FF6B35; border-radius: 3px; padding: 2px 6px; font-size: 10px; font-weight: 600;">GLOBAL IMPACT</span>` : ""}
                </div>
                <p style="margin: 4px 0; font-size: 15px; font-weight: 700; color: #f0ede6;">${t.name}</p>
                <p style="margin: 4px 0; font-size: 13px; color: #888; line-height: 1.4;">${t.summary}</p>
                <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 12px; color: ${intensityColor}; font-weight: 700;">Intensity: ${t.intensity}/10</span>
                  <span style="font-size: 11px; color: #444;">${t.sources?.join(", ")}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join("");

  const alertsHTML = foreignAlerts?.length > 0 ? foreignAlerts.slice(0, 3).map(a => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #1e1e1e;">
        <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #ff6b35;">${a.event} — ${a.country}</p>
        <p style="margin: 0; font-size: 12px; color: #888; line-height: 1.4;">${a.nigeria_impact}</p>
      </td>
    </tr>`).join("") : `<tr><td style="padding: 16px; color: #444; font-size: 13px;">No global alerts today.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #0a0a0a; font-family: Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background: #0a0a0a; padding: 24px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden;">

        <!-- Top stripe -->
        <tr><td style="height: 4px; background: linear-gradient(90deg, #008751, #00C853);"></td></tr>

        <!-- Header -->
        <tr>
          <td style="padding: 28px 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin: 0; font-size: 22px; font-weight: 900; color: #f0ede6; letter-spacing: -0.5px;">
                    🇳🇬 NIGERIA <span style="color: #008751;">PULSE</span>
                  </p>
                  <p style="margin: 2px 0 0; font-size: 10px; color: #444; letter-spacing: 2px;">DAILY INTELLIGENCE DIGEST</p>
                </td>
                <td align="right">
                  <p style="margin: 0; font-size: 12px; color: #555;">${date}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Naira Rate -->
        <tr>
          <td style="padding: 0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #161616; border: 1px solid #2a2a2a; border-radius: 8px; padding: 14px 16px;">
              <tr>
                <td>
                  <p style="margin: 0 0 8px; font-size: 10px; color: #444; letter-spacing: 2px; font-weight: 700;">💵 TODAY'S NAIRA RATE</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right: 24px;">
                        <span style="font-size: 11px; color: #555;">USD/NGN </span>
                        <span style="font-size: 18px; font-weight: 900; color: #FFD600;">₦${nairaRate ? Number(nairaRate.usd_to_ngn).toFixed(2) : "—"}</span>
                      </td>
                      <td style="padding-right: 24px;">
                        <span style="font-size: 11px; color: #555;">EUR/NGN </span>
                        <span style="font-size: 18px; font-weight: 900; color: #f0ede6;">₦${nairaRate ? Number(nairaRate.eur_to_ngn).toFixed(2) : "—"}</span>
                      </td>
                      <td>
                        <span style="font-size: 11px; color: #555;">GBP/NGN </span>
                        <span style="font-size: 18px; font-weight: 900; color: #f0ede6;">₦${nairaRate ? Number(nairaRate.gbp_to_ngn).toFixed(2) : "—"}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Top 5 Topics -->
        <tr>
          <td style="padding: 0 32px 20px;">
            <p style="margin: 0 0 12px; font-size: 10px; color: #008751; letter-spacing: 2px; font-weight: 700;">🔥 TOP 5 TRENDING IN NIGERIA</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #161616; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden;">
              ${topicsHTML}
            </table>
          </td>
        </tr>

        <!-- Foreign Alerts -->
        <tr>
          <td style="padding: 0 32px 20px;">
            <p style="margin: 0 0 12px; font-size: 10px; color: #ff6b35; letter-spacing: 2px; font-weight: 700;">🌍 GLOBAL ALERTS AFFECTING NIGERIA</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #161616; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden;">
              ${alertsHTML}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding: 0 32px 28px;" align="center">
            <a href="https://nigeriapulse.ng" style="display: inline-block; background: #008751; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;">
              READ FULL ANALYSIS →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr><td style="height: 3px; background: linear-gradient(90deg, #00C853, #008751);"></td></tr>
        <tr>
          <td style="padding: 16px 32px;" align="center">
            <p style="margin: 0; font-size: 11px; color: #333;">
              🇳🇬 Nigeria Pulse · Auto-refreshes every 2 hours · 23 sources
            </p>
            <p style="margin: 6px 0 0; font-size: 11px; color: #2a2a2a;">
              You're receiving this because you subscribed to Nigeria Pulse.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

async function sendEmailDigest(subscriber, data) {
  try {
    const date = new Date().toLocaleDateString("en-NG", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    await resend.emails.send({
      from: "Nigeria Pulse <onboarding@resend.dev>",
      to: subscriber.email,
      subject: `🇳🇬 Nigeria Pulse — Top 5 Today: ${data.top_topics[0]?.name || "Latest Updates"}`,
      html: buildEmailHTML({ ...data, date }),
    });

    console.log(`✅ Email sent to ${subscriber.email}`);
    return true;
  } catch (err) {
    console.error(`❌ Email failed for ${subscriber.email}:`, err.message);
    return false;
  }
}

module.exports = { sendEmailDigest };
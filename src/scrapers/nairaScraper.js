const supabase = require("../config/supabase");

async function scrapeNairaRate() {
  try {
    console.log("💵 Fetching Naira exchange rate...");

    // Free forex API - no key needed
    const res = await Promise.race([
      fetch("https://open.er-api.com/v6/latest/USD"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000)),
    ]);

    const data = await res.json();

    if (!data.rates || !data.rates.NGN) {
      console.log("⚠️  NGN rate not found");
      return null;
    }

    const rate = {
      usd_to_ngn: data.rates.NGN,
      eur_to_ngn: data.rates.NGN / data.rates.EUR,
      gbp_to_ngn: data.rates.NGN / data.rates.GBP,
      recorded_at: new Date().toISOString(),
    };

    console.log(`✅ Naira rate: $1 = ₦${rate.usd_to_ngn.toFixed(2)}`);

    const { error } = await supabase
      .from("naira_rates")
      .insert(rate);

    if (error) console.error("❌ Naira rate save error:", error.message);
    else console.log("💾 Naira rate saved");

    return rate;
  } catch (err) {
    console.error("❌ Naira rate error:", err.message);
    return null;
  }
}

module.exports = { scrapeNairaRate };
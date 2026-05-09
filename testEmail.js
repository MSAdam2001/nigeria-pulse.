require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  try {
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "mujaheedsaid801@gmail.com",
      subject: "Test from Nigeria Pulse",
      html: "<h1>Nigeria Pulse Test Email</h1><p>If you see this, email is working!</p>",
    });
    console.log("✅ Email sent:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

test();
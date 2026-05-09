require('dotenv').config();

async function list() {
  const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
  const data = await resp.json();
  data.models.forEach(m => console.log(m.name));
}

list();
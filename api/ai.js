// ═══════════════════════════════════════════════════════
//  /api/ai.js  —  Serverless Proxy for OpenRouter
//  المفتاح محفوظ في بيئة Vercel — مش ظاهر للعميل أبداً
// ═══════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  // ── CORS Headers ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    const body = req.body;
    if (!body || !body.messages) return res.status(400).json({ error: 'messages required' });

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENROUTER_KEY,
        'HTTP-Referer': process.env.SITE_URL || 'https://seo-tool.vercel.app',
        'X-Title': 'SEO Pro Tool v6',
      },
      body: JSON.stringify({
        model: body.model || 'inclusionai/ling-2.6-flash:free',
        messages: body.messages,
        max_tokens: body.max_tokens || 2400,
      }),
    });

    if (!upstream.ok) {
      const errData = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: errData?.error?.message || 'Upstream error' });
    }

    const data = await upstream.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

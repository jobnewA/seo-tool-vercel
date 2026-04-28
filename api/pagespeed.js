// ═══════════════════════════════════════════════════════
//  /api/pagespeed.js  —  Serverless Proxy for PageSpeed
//  المفتاح محفوظ في بيئة Vercel — مش ظاهر للعميل
// ═══════════════════════════════════════════════════════

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const PS_KEY = process.env.PAGESPEED_API_KEY;
  if (!PS_KEY) return res.status(500).json({ error: 'PageSpeed key not configured' });

  const { url, strategy = 'MOBILE' } = req.query;
  if (!url) return res.status(400).json({ error: 'url parameter required' });

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy.toUpperCase()}&key=${PS_KEY}&locale=ar&category=PERFORMANCE&category=ACCESSIBILITY&category=SEO&category=BEST_PRACTICES`;
    const upstream = await fetch(apiUrl);
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

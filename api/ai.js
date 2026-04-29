// ═══════════════════════════════════════════════════════
//  /api/ai.js  —  Serverless Proxy for OpenRouter
//  مع Fallback تلقائي بين عدة موديلات
//  المفتاح محفوظ في بيئة Vercel — مش ظاهر للعميل أبداً
// ═══════════════════════════════════════════════════════

// ✅ قائمة الموديلات — عدّل هنا فقط لو أردت تغيير أو إضافة
// السيرفر يجرّبهم بالترتيب، لو الأول فشل ينتقل للتاني تلقائياً
const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'poolside/laguna-xs.2:free',
  'poolside/laguna-m.1:free',
  'baidu/qianfan-ocr-fast:free',
  'bytedance/seedance-2.0-fast',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/llama-nemotron-embed-vl-1b-v2:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'minimax/minimax-m2.5:free',
];

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

    const max_tokens = body.max_tokens || 2400;
    const messages   = body.messages;
    const siteUrl    = process.env.SITE_URL || 'https://seo-tool.vercel.app';

    let lastError = 'No models available';

    // جرّب كل موديل بالترتيب حتى يشتغل واحد
    for (const model of FALLBACK_MODELS) {
      try {
        const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OPENROUTER_KEY,
            'HTTP-Referer': siteUrl,
            'X-Title': 'SEO Pro Tool v6',
          },
          body: JSON.stringify({ model, messages, max_tokens }),
        });

        // لو نجح — ارجع النتيجة فوراً
        if (upstream.ok) {
          const data = await upstream.json();
          // أضف اسم الموديل اللي اشتغل (اختياري — للـ debugging)
          data._model_used = model;
          return res.status(200).json(data);
        }

        // لو فشل — احفظ الخطأ وجرّب التالي
        const errData = await upstream.json().catch(() => ({}));
        lastError = `${model}: ${errData?.error?.message || upstream.status}`;
        console.warn('[ai.js] Model failed, trying next:', lastError);

      } catch (modelErr) {
        lastError = `${model}: ${modelErr.message}`;
        console.warn('[ai.js] Model threw error, trying next:', lastError);
      }
    }

    // كل الموديلات فشلت
    return res.status(503).json({ error: 'All models failed. Last error: ' + lastError });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

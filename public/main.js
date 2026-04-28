
// SEO Pro Tool v4.0
// ═══════════════════════════════════════════
// STATE & INIT
// ═══════════════════════════════════════════
let schemaType = 'Article';
let imgCount = 1;
let contentType = 'outline';


// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
window.onload = () => {
  // لا يوجد API key للمستخدم — كل شيء عبر السيرفر
};

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function toast(msg, color='var(--green)') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.borderColor = color; t.style.color = color;
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800);
}

function switchTab(t, el) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  el.classList.add('active');
  const panel = document.getElementById('panel-' + t);
  if (panel) panel.style.display = 'block';
}

function setSchemaType(t, el) {
  schemaType = t;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

function setContentType(t, el) {
  contentType = t;
  document.querySelectorAll('#content-type-btns .seg-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('rewrite-field').style.display = t === 'rewrite' ? 'block' : 'none';
}

function counter(inp, cnt, max) {
  const v = document.getElementById(inp).value.length;
  const el = document.getElementById(cnt);
  el.textContent = v + ' / ' + max;
  el.className = 'counter ' + (v > max ? 'warn' : v > max * .8 ? 'ok' : '');
}

// مش محتاجين checkKey — المفتاح على السيرفر
function checkKey() {}
function getKey() { return true; } // دايمًا true — السيرفر هو اللي يتحقق

function copyEl(id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.textContent || el.innerText).then(() => toast('تم النسخ ✓'));
}
function copyFaq() {
  const items = document.querySelectorAll('.faq-item');
  const text = Array.from(items).map(el => el.querySelector('.faq-q').textContent + '\n' + el.querySelector('.faq-a').textContent).join('\n\n');
  navigator.clipboard.writeText(text).then(() => toast('تم نسخ الـ FAQ ✓'));
}
function copyKws() {
  const tags = document.querySelectorAll('.kw-tag');
  navigator.clipboard.writeText(Array.from(tags).map(t => t.textContent).join(', ')).then(() => toast('تم نسخ الكلمات ✓'));
}
function showFile(id, el) {
  document.querySelectorAll('.file-tab').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('robots-file').style.display = 'none';
  document.getElementById('sitemap-file').style.display = 'none';
  document.getElementById(id).style.display = 'block';
}

async function callAI(prompt, maxTok=2400) {
  const model = (document.getElementById('model-id')?.value || '').trim() || 'inclusionai/ling-2.6-flash:free';
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTok })
    });
    if (!res.ok) { const e = await res.json(); toast('خطأ: ' + (e.error || res.status), 'var(--red)'); return null; }
    const d = await res.json();
    return d.choices?.[0]?.message?.content || '';
  } catch(e) { toast('فشل الاتصال بالخادم', 'var(--red)'); return null; }
}

// ═══════════════════════════════════════════
// FETCH PAGE HTML (multi-proxy fallback)
// ═══════════════════════════════════════════
async function fetchPageHTML(url) {
  const proxies = [
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&timestamp=${Date.now()}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const makeUrl of proxies) {
    try {
      const res = await fetch(makeUrl(url), { signal: AbortSignal.timeout(14000) });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const d = await res.json();
        const content = d.contents || d.body || '';
        if (content && content.length > 100) return content;
      } else {
        const text = await res.text();
        if (text && text.length > 100) return text;
      }
    } catch(e) { continue; }
  }
  return null;
}

async function fetchURL(url) {
  const proxies = [
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&timestamp=${Date.now()}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ];
  for (const makeUrl of proxies) {
    try {
      const res = await fetch(makeUrl(url), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        // Try to get status from allorigins response
        try {
          const d = await res.json();
          return { ok: false, content: null, status: d.status?.http_code || res.status };
        } catch(e2) {}
        return { ok: false, content: null, status: res.status };
      }
      const ct = res.headers.get('content-type') || '';
      let content = '';
      if (ct.includes('json')) {
        const d = await res.json();
        content = d.contents || d.body || '';
        const httpCode = d.status?.http_code;
        if (httpCode && httpCode !== 200) {
          return { ok: httpCode >= 200 && httpCode < 300, content, status: httpCode };
        }
      } else {
        content = await res.text();
      }
      return { ok: true, content, status: 200 };
    } catch(e) { continue; }
  }
  return { ok: false, content: null, status: 0 };
}

// ═══════════════════════════════════════════
// REAL HTML PARSER
// ═══════════════════════════════════════════
function parseHTMLForSEO(html, baseUrl) {
  if (!html) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const lower = html.toLowerCase();

  // Basic meta
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const viewport = !!doc.querySelector('meta[name="viewport"]');
  const charset = !!doc.querySelector('meta[charset], meta[http-equiv="Content-Type"]');
  const lang = doc.documentElement.getAttribute('lang') || '';
  const robots_meta = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';

  // Headings
  const h1s = doc.querySelectorAll('h1');
  const h2s = doc.querySelectorAll('h2');
  const h3s = doc.querySelectorAll('h3');

  // Images
  const imgs = doc.querySelectorAll('img');
  const imgsNoAlt = Array.from(imgs).filter(i => !i.getAttribute('alt') || i.getAttribute('alt').trim() === '');
  const totalImgs = imgs.length;

  // Links
  const links = doc.querySelectorAll('a[href]');
  const internalLinks = Array.from(links).filter(a => {
    const href = a.getAttribute('href') || '';
    return href.startsWith('/') || href.includes(new URL(baseUrl).hostname);
  }).length;
  const externalLinks = links.length - internalLinks;

  // Schema
  const schemaScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const hasSchema = schemaScripts.length > 0;
  let schemaTypes = [];
  schemaScripts.forEach(s => {
    try { const j = JSON.parse(s.textContent); schemaTypes.push(j['@type'] || ''); } catch(e){}
  });

  // Social media detection (REAL - from actual HTML)
  const socialPatterns = {
    facebook: /facebook\.com|fb\.com|fb\.me/i,
    instagram: /instagram\.com/i,
    twitter: /twitter\.com|x\.com/i,
    youtube: /youtube\.com|youtu\.be/i,
    linkedin: /linkedin\.com/i,
    tiktok: /tiktok\.com/i,
    snapchat: /snapchat\.com/i,
    pinterest: /pinterest\.com/i,
  };
  const socialFound = {};
  const allAnchors = Array.from(doc.querySelectorAll('a[href]'));
  Object.entries(socialPatterns).forEach(([name, pattern]) => {
    socialFound[name] = allAnchors.some(a => pattern.test(a.getAttribute('href') || ''));
  });
  const hasSocialLinks = Object.values(socialFound).some(Boolean);

  // WhatsApp detection (REAL)
  const whatsappPatterns = /wa\.me|whatsapp\.com|api\.whatsapp\.com/i;
  const hasWhatsapp = allAnchors.some(a => whatsappPatterns.test(a.getAttribute('href') || '')) ||
                      lower.includes('wa.me') || lower.includes('whatsapp');

  // Phone detection (REAL)
  const phoneHrefs = allAnchors.filter(a => (a.getAttribute('href') || '').startsWith('tel:'));
  const hasPhone = phoneHrefs.length > 0;
  const phoneNumbers = phoneHrefs.map(a => a.getAttribute('href').replace('tel:','')).slice(0,2);

  // Email
  const emailHrefs = allAnchors.filter(a => (a.getAttribute('href') || '').startsWith('mailto:'));
  const hasEmail = emailHrefs.length > 0;

  // Open Graph
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const twitterCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '';
  const hasOG = !!(ogTitle || ogDesc || ogImage);
  const hasTwitterCard = !!twitterCard;

  // Google tools detection (REAL)
  const hasGTM = lower.includes('googletagmanager.com') || lower.includes('gtm.js');
  const hasGA = lower.includes('google-analytics.com') || lower.includes('gtag(') || lower.includes('ga(') || lower.includes('_ga') || lower.includes('googletagmanager.com/gtag');
  const hasGSC = lower.includes('google-site-verification');
  const gscToken = doc.querySelector('meta[name="google-site-verification"]')?.getAttribute('content') || '';
  const hasPixel = lower.includes('connect.facebook.net') || lower.includes('fbq(') || lower.includes('fbevents');
  const hasTikTokPixel = lower.includes('analytics.tiktok.com');

  // Platform detection (REAL from HTML)
  let platform = 'unknown';
  if (lower.includes('cdn.salla.') || lower.includes('salla.sa') || lower.includes('cdn.sallacdn')) platform = 'salla';
  else if (lower.includes('zid.store') || lower.includes('zid-sa') || lower.includes('zid_store')) platform = 'zid';
  else if (lower.includes('cdn.shopify.com') || lower.includes('shopify.com/s/') || lower.includes('myshopify.com')) platform = 'shopify';
  else if (lower.includes('wp-content') || lower.includes('wp-includes') || lower.includes('wp-json')) platform = 'wordpress';
  else if (lower.includes('woocommerce')) platform = 'woocommerce';
  else if (lower.includes('blogger.com') || lower.includes('blogspot.com')) platform = 'blogger';
  else if (lower.includes('webflow.com')) platform = 'webflow';
  else if (lower.includes('squarespace.com') || lower.includes('squarespace-cdn')) platform = 'squarespace';

  // Speed hints from HTML
  const hasLazyLoad = lower.includes('loading="lazy"') || lower.includes("loading='lazy'");
  const hasAMP = !!doc.querySelector('html[amp], html[⚡]') || lower.includes('<html amp');
  const cssCount = doc.querySelectorAll('link[rel="stylesheet"]').length;
  const jsCount = doc.querySelectorAll('script[src]').length;

  // HTTPS
  const isHttps = baseUrl.startsWith('https://');

  return {
    title, titleLen: title.length,
    metaDesc, metaDescLen: metaDesc.length,
    canonical, hasCanonical: !!canonical,
    viewport, charset, lang,
    robots_meta,
    h1Count: h1s.length, h1Text: h1s[0]?.textContent?.trim() || '',
    h2Count: h2s.length, h3Count: h3s.length,
    totalImgs, imgsNoAlt: imgsNoAlt.length,
    internalLinks, externalLinks,
    hasSchema, schemaTypes,
    socialFound, hasSocialLinks,
    hasWhatsapp, hasPhone, phoneNumbers, hasEmail,
    ogTitle, ogDesc, ogImage, hasOG, hasTwitterCard, twitterCard,
    hasGTM, hasGA, hasGSC, gscToken, hasPixel, hasTikTokPixel,
    platform, isHttps,
    hasLazyLoad, hasAMP, cssCount, jsCount
  };
}

// ═══════════════════════════════════════════
// PLATFORM INFO
// ═══════════════════════════════════════════
function getPlatformInfo(p) {
  const map = {
    salla: { name: 'سلة Salla', cls: 'platform-salla', icon: '🛒' },
    zid: { name: 'زد Zid', cls: 'platform-zid', icon: '🛍️' },
    shopify: { name: 'Shopify', cls: 'platform-shopify', icon: '🟢' },
    wordpress: { name: 'WordPress', cls: 'platform-woo', icon: '🔵' },
    woocommerce: { name: 'WooCommerce', cls: 'platform-woo', icon: '🛒' },
    blogger: { name: 'Blogger', cls: 'platform-blogger', icon: '📝' },
    webflow: { name: 'Webflow', cls: 'platform-woo', icon: '🌊' },
    squarespace: { name: 'Squarespace', cls: 'platform-woo', icon: '⬛' },
  };
  return map[p] || { name: 'غير محدد', cls: 'platform-unknown', icon: '🌐' };
}

// ═══════════════════════════════════════════
// SCORE CALCULATOR
// ═══════════════════════════════════════════
function calcScore(data, files) {
  let score = 100;
  const deductions = [];

  if (!data.title) { score -= 15; deductions.push('لا يوجد Title'); }
  else if (data.titleLen > 65) { score -= 5; deductions.push(`Title طويل (${data.titleLen} حرف)`); }
  else if (data.titleLen < 30) { score -= 3; deductions.push(`Title قصير (${data.titleLen} حرف)`); }

  if (!data.metaDesc) { score -= 10; deductions.push('لا توجد Meta Description'); }
  else if (data.metaDescLen > 165) { score -= 3; deductions.push('Meta Description طويلة'); }

  if (!data.hasCanonical) { score -= 5; deductions.push('لا يوجد Canonical Tag'); }
  if (!data.isHttps) { score -= 12; deductions.push('لا يستخدم HTTPS'); }
  if (!data.viewport) { score -= 5; deductions.push('لا يوجد Viewport Meta'); }
  if (data.h1Count === 0) { score -= 7; deductions.push('لا يوجد H1'); }
  else if (data.h1Count > 1) { score -= 3; deductions.push(`أكثر من H1 واحد (${data.h1Count})`); }
  if (!data.hasSchema) { score -= 5; deductions.push('لا يوجد Schema Markup'); }
  if (!data.hasOG) { score -= 4; deductions.push('لا توجد Open Graph Tags'); }
  if (data.imgsNoAlt > 0) { score -= Math.min(5, data.imgsNoAlt); deductions.push(`${data.imgsNoAlt} صورة بدون Alt`); }
  if (!data.hasGA && !data.hasGTM) { score -= 3; deductions.push('لا توجد أدوات تتبع Google'); }
  if (!files.robotsOk) { score -= 3; deductions.push('robots.txt مفقود'); }
  if (!files.sitemapOk) { score -= 3; deductions.push('sitemap.xml مفقود'); }

  return { score: Math.max(0, score), deductions };
}

// ═══════════════════════════════════════════
// MAIN AUDIT V3
// ═══════════════════════════════════════════
async function runAuditV3() {
  const url = document.getElementById('audit-url').value.trim();
  if (!url) { toast('الرجاء إدخال رابط الصفحة', 'var(--red)'); return; }

  document.getElementById('audit-loader').style.display = 'block';
  document.getElementById('audit-loader-text').style.display = 'block';
  document.getElementById('audit-out').style.display = 'none';

  const loaderText = document.getElementById('audit-loader-text');
  const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
  const baseUrl = urlObj.origin;
  const domain = urlObj.hostname;

  // 1. Fetch page HTML
  loaderText.textContent = '🌐 جاري جلب صفحة الموقع...';
  const html = await fetchPageHTML(url);

  // 2. Check robots.txt
  loaderText.textContent = '🤖 فحص robots.txt...';
  const robotsResult = await fetchURL(baseUrl + '/robots.txt');

  // 3. Check sitemap.xml (try common paths)
  loaderText.textContent = '🗺️ فحص sitemap.xml...';
  const sitemapPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap-index.xml',
    '/sitemaps/sitemap.xml',
    '/wp-sitemap.xml',
    '/page-sitemap.xml',
    '/post-sitemap.xml',
    '/product-sitemap.xml',
  ];
  let sitemapResult = { ok: false };
  let sitemapFoundUrl = '';
  for (const p of sitemapPaths) {
    const r = await fetchURL(baseUrl + p);
    if (r.ok && r.content && (r.content.includes('<url') || r.content.includes('<sitemap'))) {
      sitemapResult = r;
      sitemapFoundUrl = baseUrl + p;
      break;
    }
  }

  // 2b. Also try multiple robots.txt paths (should always be at root)
  // robots.txt can only be at root per spec, but let's verify content more carefully

  document.getElementById('audit-loader').style.display = 'none';
  document.getElementById('audit-loader-text').style.display = 'none';

  const files = {
    robotsOk: robotsResult.ok && robotsResult.content && robotsResult.content.includes('User-agent'),
    robotsContent: robotsResult.content,
    sitemapOk: sitemapResult.ok && sitemapResult.content && (sitemapResult.content.includes('<url') || sitemapResult.content.includes('<sitemap')),
    sitemapContent: sitemapResult.content,
    sitemapUrl: sitemapFoundUrl || baseUrl + '/sitemap.xml',
  };

  let data = null;
  let fetchedOK = false;

  if (html) {
    data = parseHTMLForSEO(html, url);
    fetchedOK = true;
  } else {
    // Fallback minimal data
    data = { title:'', titleLen:0, metaDesc:'', metaDescLen:0, hasCanonical:false, viewport:false, charset:false, lang:'',
      h1Count:0, h1Text:'', h2Count:0, h3Count:0, totalImgs:0, imgsNoAlt:0, internalLinks:0, externalLinks:0,
      hasSchema:false, schemaTypes:[], socialFound:{}, hasSocialLinks:false, hasWhatsapp:false, hasPhone:false, phoneNumbers:[],
      hasEmail:false, ogTitle:'', ogDesc:'', ogImage:'', hasOG:false, hasTwitterCard:false, twitterCard:'',
      hasGTM:false, hasGA:false, hasGSC:false, gscToken:'', hasPixel:false, hasTikTokPixel:false,
      platform:'unknown', isHttps: url.startsWith('https://'),
      hasLazyLoad:false, hasAMP:false, cssCount:0, jsCount:0, robots_meta: '', canonical: '' };
  }

  const { score, deductions } = calcScore(data, files);
  const platInfo = getPlatformInfo(data.platform);
  const scoreColor = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--yellow)' : 'var(--red)';

  // ── RENDER SUMMARY ──
  const scoreClass = score >= 70 ? 's-green' : score >= 45 ? 's-yellow' : 's-red';
  const socialList = Object.entries(data.socialFound).filter(([,v])=>v).map(([k])=>k).join('، ') || 'غير موجودة';

  document.getElementById('audit-summary-content').innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:flex-start;margin-bottom:1rem">
      <div class="score-ring-wrap">
        <svg class="score-ring" viewBox="0 0 90 90" width="90" height="90">
          <circle cx="45" cy="45" r="38" fill="none" stroke="var(--surface3)" stroke-width="9"/>
          <circle cx="45" cy="45" r="38" fill="none" stroke="${scoreColor}" stroke-width="9"
            stroke-dasharray="${2*Math.PI*38}" stroke-dashoffset="${2*Math.PI*38*(1-score/100)}"
            stroke-linecap="round" style="transition:stroke-dashoffset .8s ease"/>
        </svg>
        <div class="score-ring-num" style="color:${scoreColor}">${score}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:3px">SEO Score</div>
      </div>
      <div style="flex:1;min-width:200px">
        <div style="margin-bottom:6px">
          <span style="font-size:12px;color:var(--muted2)">المنصة: </span>
          <span class="platform-chip ${platInfo.cls}">${platInfo.icon} ${platInfo.name}</span>
        </div>
        <div style="font-size:12px;color:var(--muted2);margin-bottom:4px">🌐 الدومين: <strong style="color:var(--text)">${domain}</strong></div>
        <div style="font-size:12px;color:var(--muted2);margin-bottom:4px">🔒 HTTPS: <strong style="color:${data.isHttps?'var(--green)':'var(--red)'}">${data.isHttps?'✅ آمن':'❌ غير آمن'}</strong></div>
        ${fetchedOK ? `<span class="real-check-badge fetched">🌐 HTML مُحلَّل فعلياً</span>` : `<span class="real-check-badge ai-only">⚠️ تعذّر جلب HTML — نتائج مقدّرة</span>`}
      </div>
    </div>

    <div class="grid5">
      <div class="stat-card ${scoreClass}"><div class="stat-num">${score}</div><div class="stat-lbl">SEO Score</div></div>
      <div class="stat-card ${data.h1Count===1?'s-green':data.h1Count>1?'s-yellow':'s-red'}"><div class="stat-num">${data.h1Count}</div><div class="stat-lbl">H1 Tags</div></div>
      <div class="stat-card ${data.imgsNoAlt===0?'s-green':data.imgsNoAlt<3?'s-yellow':'s-red'}"><div class="stat-num">${data.imgsNoAlt}/${data.totalImgs}</div><div class="stat-lbl">صور بدون Alt</div></div>
      <div class="stat-card ${files.robotsOk?'s-green':'s-red'}"><div class="stat-num">${files.robotsOk?'✓':'✗'}</div><div class="stat-lbl">robots.txt</div></div>
      <div class="stat-card ${files.sitemapOk?'s-green':'s-red'}"><div class="stat-num">${files.sitemapOk?'✓':'✗'}</div><div class="stat-lbl">sitemap.xml</div></div>
    </div>

    ${deductions.length > 0 ? `
    <div style="background:rgba(240,74,94,.06);border:1px solid rgba(240,74,94,.15);border-radius:var(--radius-sm);padding:10px 14px;">
      <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:6px">⚠️ أسباب تخفيض النقاط:</div>
      ${deductions.map(d => `<div style="font-size:12px;color:var(--muted2);padding:2px 0">• ${d}</div>`).join('')}
    </div>` : `<div style="background:rgba(16,212,144,.06);border:1px solid rgba(16,212,144,.15);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--green)">🎉 الموقع ممتاز! لا توجد مشاكل جوهرية.</div>`}
  `;

  // ── RENDER HTML CHECKS ──
  document.getElementById('fetch-badge').textContent = fetchedOK ? '🌐 بيانات من HTML حقيقي' : '⚠️ تحليل مقدّر';
  document.getElementById('fetch-badge').className = 'real-check-badge ' + (fetchedOK ? 'fetched' : 'ai-only');

  const checks = [
    { label: 'Title Tag', detail: data.title ? `"${data.title.substring(0,50)}${data.title.length>50?'...':''}" — ${data.titleLen} حرف` : 'غير موجود', status: data.title && data.titleLen <= 65 ? 'ok' : data.title ? 'warn' : 'err' },
    { label: 'Meta Description', detail: data.metaDesc ? `${data.metaDescLen} حرف` : 'غير موجودة', status: data.metaDesc && data.metaDescLen <= 165 ? 'ok' : data.metaDesc ? 'warn' : 'err' },
    { label: 'Canonical Tag', detail: data.canonical || 'غير موجود', status: data.hasCanonical ? 'ok' : 'err' },
    { label: 'Viewport (Mobile)', detail: data.viewport ? 'موجود' : 'غير موجود', status: data.viewport ? 'ok' : 'err' },
    { label: 'H1 Tag', detail: data.h1Count > 0 ? `${data.h1Count} H1 — "${data.h1Text.substring(0,40)}"` : 'غير موجود', status: data.h1Count === 1 ? 'ok' : data.h1Count > 1 ? 'warn' : 'err' },
    { label: 'H2/H3 Structure', detail: `H2: ${data.h2Count} | H3: ${data.h3Count}`, status: data.h2Count > 0 ? 'ok' : 'warn' },
    { label: 'Schema Markup', detail: data.hasSchema ? `✓ موجود (${data.schemaTypes.filter(Boolean).join(', ') || 'نوع غير محدد'})` : 'غير موجود', status: data.hasSchema ? 'ok' : 'warn' },
    { label: 'Open Graph Tags', detail: data.hasOG ? `✓ OG | Twitter: ${data.hasTwitterCard ? data.twitterCard : '✗'}` : 'غير موجودة', status: data.hasOG ? 'ok' : 'warn' },
    { label: 'السوشيال ميديا', detail: data.hasSocialLinks ? `✓ موجودة: ${socialList}` : '✗ لا توجد روابط سوشيال ميديا', status: data.hasSocialLinks ? 'ok' : 'warn' },
    { label: 'واتساب', detail: data.hasWhatsapp ? '✓ يوجد زر/رابط واتساب' : '✗ لا يوجد واتساب', status: data.hasWhatsapp ? 'ok' : 'warn' },
    { label: 'رقم الهاتف / اتصال', detail: data.hasPhone ? `✓ موجود${data.phoneNumbers.length?': '+data.phoneNumbers[0]:''}` : '✗ لا يوجد', status: data.hasPhone ? 'ok' : 'warn' },
    { label: 'البريد الإلكتروني', detail: data.hasEmail ? '✓ يوجد mailto link' : '✗ لا يوجد', status: data.hasEmail ? 'ok' : 'info' },
    { label: 'Google Analytics / GTM', detail: data.hasGTM ? '✓ Google Tag Manager' : data.hasGA ? '✓ Google Analytics' : '✗ غير مُثبَّت', status: (data.hasGTM || data.hasGA) ? 'ok' : 'warn' },
    { label: 'Google Search Console', detail: data.hasGSC ? `✓ مُتحقَّق منه${data.gscToken?': '+data.gscToken.substring(0,12)+'...':''}` : '✗ لا توجد علامة تحقق', status: data.hasGSC ? 'ok' : 'warn' },
    { label: 'Facebook Pixel', detail: data.hasPixel ? '✓ موجود' : 'غير موجود', status: data.hasPixel ? 'ok' : 'info' },
    { label: 'TikTok Pixel', detail: data.hasTikTokPixel ? '✓ موجود' : 'غير موجود', status: data.hasTikTokPixel ? 'ok' : 'info' },
    { label: 'لغة الصفحة', detail: data.lang || 'غير محددة', status: data.lang ? 'ok' : 'warn' },
    { label: 'Lazy Loading للصور', detail: data.hasLazyLoad ? '✓ مُفعَّل' : 'غير مُفعَّل', status: data.hasLazyLoad ? 'ok' : 'warn' },
    { label: 'CSS/JS Files', detail: `${data.cssCount} ملف CSS | ${data.jsCount} ملف JS`, status: (data.cssCount + data.jsCount) > 20 ? 'warn' : 'ok' },
    { label: 'HTTPS', detail: data.isHttps ? '✓ الموقع آمن' : '✗ غير آمن — يؤثر على SEO', status: data.isHttps ? 'ok' : 'err' },
  ];

  const iconMap = { ok: '✅', warn: '⚠️', err: '❌', info: 'ℹ️' };
  const classMap = { ok: 'ok-item', warn: 'warn-item', err: 'err-item', info: 'info-item' };

  document.getElementById('audit-html-checks').innerHTML = `
    <div class="check-grid">
      ${checks.map(c => `
        <div class="check-item ${classMap[c.status]}">
          <span class="check-icon">${iconMap[c.status]}</span>
          <div class="check-content">
            <div class="check-label">${c.label}</div>
            <div class="check-detail">${c.detail}</div>
          </div>
        </div>`).join('')}
    </div>`;

  // ── RENDER FILES CHECKS ──
  let robotsDetail = '❌ ملف robots.txt غير موجود أو لا يمكن الوصول إليه';
  if (files.robotsOk) {
    const hasDisallow = files.robotsContent.toLowerCase().includes('disallow');
    const hasSitemapRef = files.robotsContent.toLowerCase().includes('sitemap');
    robotsDetail = `✅ موجود | Disallow rules: ${hasDisallow?'✓':'✗'} | Sitemap مذكور: ${hasSitemapRef?'✓':'✗'}`;
  }

  let sitemapDetail = '❌ sitemap.xml غير موجود — تم فحص: /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml وغيرها';
  if (files.sitemapOk) {
    const urlCount = (files.sitemapContent.match(/<url>/g) || []).length;
    const subSitemapCount = (files.sitemapContent.match(/<sitemap>/g) || []).length;
    const lastmod = files.sitemapContent.includes('lastmod') ? '✓' : '✗';
    const isSitemapIndex = files.sitemapContent.includes('<sitemapindex');
    sitemapDetail = `✅ موجود في: ${files.sitemapUrl.replace(baseUrl,'')} | ${isSitemapIndex ? `Sitemap Index يحتوي ${subSitemapCount} sitemap` : `${urlCount} رابط مُدرج`} | lastmod: ${lastmod}`;
  }

  document.getElementById('audit-files-checks').innerHTML = `
    <div class="check-grid">
      <div class="check-item ${files.robotsOk?'ok-item':'err-item'}">
        <span class="check-icon">${files.robotsOk?'✅':'❌'}</span>
        <div class="check-content">
          <div class="check-label">robots.txt</div>
          <div class="check-detail">${robotsDetail}</div>
          ${files.robotsOk ? `<a href="${baseUrl}/robots.txt" target="_blank" style="font-size:11px;color:var(--accent);">عرض الملف ↗</a>` : ''}
        </div>
      </div>
      <div class="check-item ${files.sitemapOk?'ok-item':'err-item'}">
        <span class="check-icon">${files.sitemapOk?'✅':'❌'}</span>
        <div class="check-content">
          <div class="check-label">sitemap.xml</div>
          <div class="check-detail">${sitemapDetail}</div>
          ${files.sitemapOk ? `<a href="${files.sitemapUrl}" target="_blank" style="font-size:11px;color:var(--accent);">عرض الملف ↗</a>` : ''}
        </div>
      </div>
      <div class="check-item info-item">
        <span class="check-icon">🔗</span>
        <div class="check-content">
          <div class="check-label">روابط الصفحة</div>
          <div class="check-detail">داخلية: ${data.internalLinks} | خارجية: ${data.externalLinks}</div>
        </div>
      </div>
      <div class="check-item info-item">
        <span class="check-icon">🖼️</span>
        <div class="check-content">
          <div class="check-label">الصور</div>
          <div class="check-detail">الإجمالي: ${data.totalImgs} | بدون Alt: ${data.imgsNoAlt}</div>
        </div>
      </div>
    </div>
    <div style="margin-top:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border)">
      <div style="font-size:11px;color:var(--muted2);margin-bottom:8px;font-weight:700">🔗 روابط مفيدة للفحص</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="https://search.google.com/test/mobile-friendly?url=${encodeURIComponent(url)}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid rgba(59,126,248,.3);border-radius:6px;">📱 Mobile Friendly Test</a>
        <a href="https://pagespeed.web.dev/report?url=${encodeURIComponent(url)}" target="_blank" style="font-size:11px;color:var(--green);text-decoration:none;padding:4px 10px;border:1px solid rgba(16,212,144,.3);border-radius:6px;">⚡ PageSpeed Insights</a>
        <a href="https://validator.w3.org/nu/?doc=${encodeURIComponent(url)}" target="_blank" style="font-size:11px;color:var(--yellow);text-decoration:none;padding:4px 10px;border:1px solid rgba(245,166,35,.3);border-radius:6px;">🔍 HTML Validator</a>
        <a href="${baseUrl}/robots.txt" target="_blank" style="font-size:11px;color:var(--muted2);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">robots.txt ↗</a>
        <a href="${baseUrl}/sitemap.xml" target="_blank" style="font-size:11px;color:var(--muted2);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:6px;">sitemap.xml ↗</a>
      </div>
    </div>`;

  // ── AI DEEP ANALYSIS ──
  document.getElementById('audit-ai-content').innerHTML = `
    <div class="loader" id="ai-inline-loader" style="display:block"></div>
    <div id="ai-inline-text" style="font-size:13px;color:var(--muted2)">⏳ جاري التحليل المعمّق بالذكاء الاصطناعي...</div>`;

  document.getElementById('audit-out').style.display = 'block';
  document.getElementById('audit-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('تم الفحص الحقيقي ✓ جاري التعمق بالـ AI...');

  // AI call with real data context
  const aiContext = `
الموقع: ${url}
المنصة المكتشفة: ${platInfo.name}
Title: "${data.title}" (${data.titleLen} حرف)
Meta Description: "${data.metaDesc}" (${data.metaDescLen} حرف)
H1: "${data.h1Text}" | عدد H1: ${data.h1Count} | H2: ${data.h2Count}
Schema: ${data.hasSchema ? data.schemaTypes.join(', ') : 'غير موجود'}
HTTPS: ${data.isHttps}
Canonical: ${data.canonical || 'غير موجود'}
Google Analytics/GTM: ${data.hasGTM || data.hasGA}
Facebook Pixel: ${data.hasPixel}
Social Links: ${socialList}
WhatsApp: ${data.hasWhatsapp}
Sitemap: ${files.sitemapOk ? 'موجود' : 'غير موجود'}
Robots.txt: ${files.robotsOk ? 'موجود' : 'غير موجود'}
Open Graph: ${data.hasOG}
CSS Files: ${data.cssCount} | JS Files: ${data.jsCount}
Lang attribute: ${data.lang}
`;

  const aiPrompt = `أنت خبير SEO متخصص. بناءً على التحليل الحقيقي لهذا الموقع:

${aiContext}

قدّم تحليلاً معمّقاً باللغة العربية يشمل:
1. تقييم سرعة الموقع المتوقعة بناءً على عدد ملفات CSS/JS والمنصة
2. تقييم المحتوى ومدى تحسينه لـ SEO
3. تقييم التجربة التقنية (Core Web Vitals المتوقعة)
4. نقاط القوة الرئيسية
5. أهم 3 مشاكل يجب إصلاحها فوراً مع خطوات عملية

أعطني JSON فقط:
{"speed_assessment":"تقييم السرعة","content_assessment":"تقييم المحتوى","technical_assessment":"تقييم تقني","strengths":["قوة1","قوة2","قوة3"],"critical_fixes":[{"title":"مشكلة","fix":"الحل"},{"title":"","fix":""},{"title":"","fix":""}]}`;

  const aiText = await callAI(aiPrompt, 1800);
  document.getElementById('ai-inline-loader').style.display = 'none';

  if (aiText) {
    try {
      const ai = JSON.parse(aiText.replace(/```json|```/g,'').trim());
      document.getElementById('ai-inline-text').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:1rem">
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
            <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:5px">⚡ السرعة</div>
            <div style="font-size:12px;color:var(--text);line-height:1.6">${ai.speed_assessment}</div>
          </div>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
            <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:5px">📝 المحتوى</div>
            <div style="font-size:12px;color:var(--text);line-height:1.6">${ai.content_assessment}</div>
          </div>
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px">
            <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:5px">🔧 التقني</div>
            <div style="font-size:12px;color:var(--text);line-height:1.6">${ai.technical_assessment}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px">✅ نقاط القوة</div>
            ${(ai.strengths||[]).map(s=>`<div style="font-size:12px;color:var(--muted2);padding:4px 0;border-bottom:1px solid var(--border)">• ${s}</div>`).join('')}
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:8px">🚨 إصلاحات فورية</div>
            ${(ai.critical_fixes||[]).map(f=>`<div style="margin-bottom:8px;padding:8px;background:rgba(240,74,94,.06);border:1px solid rgba(240,74,94,.15);border-radius:8px"><div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:3px">${f.title}</div><div style="font-size:11px;color:var(--muted2)">${f.fix}</div></div>`).join('')}
          </div>
        </div>`;
    } catch(e) {
      document.getElementById('ai-inline-text').innerHTML = `<div style="white-space:pre-wrap;font-size:13px;line-height:1.8;color:var(--text)">${aiText}</div>`;
    }
  } else {
    document.getElementById('ai-inline-text').innerHTML = '<div style="color:var(--muted2);font-size:13px">تعذّر جلب التحليل المعمّق. تحقق من مفتاح API.</div>';
  }

  // ── ISSUES ──
  const issues = [];
  if (!data.title) issues.push({ type: 'error', title: 'Title Tag مفقود', detail: 'الـ Title هو أهم عنصر في الـ SEO. أضفه فوراً بـ 50-65 حرف.' });
  else if (data.titleLen > 65) issues.push({ type: 'warning', title: `Title طويل (${data.titleLen} حرف)`, detail: `Google يعرض أول 60-65 حرف فقط. اختصره.` });
  else issues.push({ type: 'ok', title: `Title مثالي (${data.titleLen} حرف)`, detail: `"${data.title.substring(0,60)}"` });

  if (!data.metaDesc) issues.push({ type: 'error', title: 'Meta Description مفقودة', detail: 'أضف وصفاً بـ 120-160 حرف يحتوي الكلمة المفتاحية ويشجع على النقر.' });
  else issues.push({ type: 'ok', title: `Meta Description موجودة (${data.metaDescLen} حرف)`, detail: data.metaDesc.substring(0,100) + '...' });

  if (!data.hasCanonical) issues.push({ type: 'warning', title: 'Canonical Tag غائب', detail: 'أضف <link rel="canonical" href="URL الصفحة"> لمنع محتوى مكرر.' });

  if (data.h1Count === 0) issues.push({ type: 'error', title: 'لا يوجد H1', detail: 'أضف H1 واحد يحتوي الكلمة المفتاحية الرئيسية.' });
  else if (data.h1Count > 1) issues.push({ type: 'warning', title: `${data.h1Count} H1 Tags`, detail: 'يُفضَّل H1 واحد فقط في الصفحة.' });

  if (!data.hasSocialLinks) issues.push({ type: 'warning', title: 'لا توجد روابط سوشيال ميديا', detail: 'أضف روابط لحسابات السوشيال ميديا الخاصة بك (Facebook، Instagram، إلخ).' });
  else issues.push({ type: 'ok', title: 'روابط السوشيال ميديا موجودة', detail: socialList });

  if (!data.hasWhatsapp) issues.push({ type: 'warning', title: 'لا يوجد زر واتساب', detail: 'أضف رابط wa.me/+رقمك لتسهيل التواصل وزيادة التحويلات.' });
  else issues.push({ type: 'ok', title: 'واتساب موجود ✓', detail: 'رابط واتساب مُتاح للعملاء' });

  if (!data.hasPhone) issues.push({ type: 'warning', title: 'لا يوجد رقم هاتف', detail: 'أضف <a href="tel:+رقمك"> لتحسين تجربة المستخدم ونتائج البحث المحلي.' });

  if (!files.robotsOk) issues.push({ type: 'warning', title: 'robots.txt مفقود', detail: `أنشئ ${baseUrl}/robots.txt لتوجيه محركات البحث. استخدم قسم Robots/Sitemap في هذه الأداة.` });
  if (!files.sitemapOk) issues.push({ type: 'warning', title: 'sitemap.xml مفقود', detail: `أنشئ ${baseUrl}/sitemap.xml وأرسله لـ Google Search Console لتسريع الفهرسة.` });

  if (data.imgsNoAlt > 0) issues.push({ type: 'warning', title: `${data.imgsNoAlt} صورة بدون Alt Text`, detail: 'أضف وصفاً للصور يحتوي الكلمة المفتاحية. يساعد في SEO وإمكانية الوصول.' });

  if (!data.hasGTM && !data.hasGA) issues.push({ type: 'warning', title: 'Google Analytics / GTM غير مثبّت', detail: 'ثبّت Google Tag Manager لمتابعة زيارات الموقع وتحليل سلوك المستخدمين.' });
  if (!data.hasGSC) issues.push({ type: 'warning', title: 'Google Search Console غير مُتحقَّق منه', detail: 'أضف metatag التحقق من GSC وأرسل موقعك في https://search.google.com/search-console' });
  if (!data.hasOG) issues.push({ type: 'warning', title: 'Open Graph Tags مفقودة', detail: 'أضف og:title وog:description وog:image لظهور أفضل في السوشيال ميديا.' });

  document.getElementById('audit-issues').innerHTML = issues.map(i => `
    <div class="issue-item">
      <span class="badge ${i.type==='error'?'badge-err':i.type==='warning'?'badge-warn':'badge-ok'}">${i.type==='error'?'⚠️ خطأ':i.type==='warning'?'💡 تحسين':'✅ جيد'}</span>
      <div class="issue-detail"><strong>${i.title}</strong><span>${i.detail}</span></div>
    </div>`).join('');

  toast('اكتمل التحليل الشامل ✓');
}

// ═══════════════════════════════════════════
// SCHEMA GENERATOR
// ═══════════════════════════════════════════
function addImg() {
  imgCount++;
  const d = document.createElement('div'); d.className = 'img-row';
  d.innerHTML = `<input type="url" placeholder="Image URL #${imgCount}" class="img-input"/><button class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">حذف</button>`;
  document.getElementById('img-list').appendChild(d);
}
function clearSchema() {
  ['s-url','s-headline','s-desc','s-aname','s-aurl','s-pub','s-logo'].forEach(id => document.getElementById(id).value = '');
  document.querySelectorAll('.img-input').forEach((el,i) => i === 0 ? el.value = '' : el.parentElement.remove());
  document.getElementById('schema-out').style.display = 'none'; imgCount = 1;
}
function generateSchema() {
  const hl = document.getElementById('s-headline').value.trim();
  if (!hl) { toast('الرجاء إدخال Headline', 'var(--red)'); return; }
  const imgs = Array.from(document.querySelectorAll('.img-input')).map(i => i.value.trim()).filter(Boolean);
  const aname = document.getElementById('s-aname').value.trim();
  const pub = document.getElementById('s-pub').value.trim();
  const schema = {
    "@context": "https://schema.org", "@type": schemaType,
    "url": document.getElementById('s-url').value.trim() || undefined,
    "headline": hl, "name": hl,
    "image": imgs.length === 1 ? imgs[0] : imgs.length > 1 ? imgs : undefined,
    "description": document.getElementById('s-desc').value.trim() || undefined,
    "datePublished": new Date().toISOString().split('T')[0],
    "dateModified": new Date().toISOString().split('T')[0],
    "author": aname ? { "@type": document.getElementById('s-atype').value, "name": aname, "url": document.getElementById('s-aurl').value.trim() || undefined } : undefined,
    "publisher": pub ? { "@type": "Organization", "name": pub, "logo": document.getElementById('s-logo').value.trim() ? { "@type": "ImageObject", "url": document.getElementById('s-logo').value.trim() } : undefined } : undefined
  };
  const clean = JSON.parse(JSON.stringify(schema));
  const output = `<script type="application/ld+json">\n${JSON.stringify(clean, null, 2)}\n<\/script>`;
  document.getElementById('schema-code').textContent = output;
  document.getElementById('schema-out').style.display = 'block';
  toast('تم توليد الـ Schema ✓');
}

// ═══════════════════════════════════════════
// META GENERATOR
// ═══════════════════════════════════════════
async function generateMeta() {
  const kw = document.getElementById('kw').value.trim();
  if (!kw) { toast('الرجاء إدخال كلمة مفتاحية', 'var(--red)'); return; }
  const ctx = document.getElementById('kw-ctx').value.trim();
  const lang = document.getElementById('kw-lang').value;
  const ptype = document.getElementById('kw-pagetype').value;
  document.getElementById('meta-loader').style.display = 'block';
  document.getElementById('meta-out').style.display = 'none';
  const prompt = `أنت خبير SEO متخصص. الكلمة المفتاحية: "${kw}". ${ctx ? 'السياق: ' + ctx + '.' : ''} نوع الصفحة: ${ptype}. اللغة: ${lang === 'ar' ? 'العربية' : 'الإنجليزية'}.
أعطني JSON فقط بدون أي نص إضافي أو backticks:
{"meta150":"وصف لا يتجاوز 150 حرف","meta180":"وصف أطول لا يتجاوز 180 حرف","faq":[{"q":"س","a":"ج"},{"q":"س","a":"ج"},{"q":"س","a":"ج"},{"q":"س","a":"ج"},{"q":"س","a":"ج"}],"keywords":["ك1","ك2","ك3","ك4","ك5","ك6","ك7","ك8","ك9","ك10"],"titles":["عنوان1","عنوان2","عنوان3","عنوان4","عنوان5"]}`;
  const text = await callAI(prompt);
  document.getElementById('meta-loader').style.display = 'none';
  if (!text) return;
  try {
    const d = JSON.parse(text.replace(/```json|```/g,'').trim());
    document.getElementById('meta-150').textContent = d.meta150;
    document.getElementById('meta-180').textContent = d.meta180;
    document.getElementById('meta-faq').innerHTML = d.faq.map((f,i) => `<div class="faq-item"><div class="faq-q">س${i+1}: ${f.q}</div><div class="faq-a">ج: ${f.a}</div></div>`).join('');
    document.getElementById('meta-kws').innerHTML = d.keywords.map(k => `<span class="kw-tag">${k}</span>`).join('');
    document.getElementById('meta-titles').innerHTML = d.titles.map((t,i) => `<div style="padding:6px 0;border-bottom:1px solid var(--border)">${i+1}. ${t}</div>`).join('');
    document.getElementById('meta-out').style.display = 'block';
    toast('تم التوليد ✓');
  } catch(e) { toast('خطأ في تحليل النتيجة، حاول مرة أخرى', 'var(--red)'); }
}

// ═══════════════════════════════════════════
// TIPS
// ═══════════════════════════════════════════
async function generateTips() {
  const url = document.getElementById('tips-url').value.trim();
  if (!url) { toast('الرجاء إدخال رابط الموقع', 'var(--red)'); return; }
  const type = document.getElementById('tips-type').value;
  const lang = document.getElementById('tips-lang').value;
  const notes = document.getElementById('tips-notes').value.trim();
  document.getElementById('tips-loader').style.display = 'block';
  document.getElementById('tips-out').style.display = 'none';
  const prompt = `أنت خبير SEO متخصص في ${type}. قدم 10 اقتراحات تحسين عملية ومفصلة للموقع: "${url}" (اللغة: ${lang})${notes ? '. ملاحظات: ' + notes : ''}.
أعطني JSON فقط بدون backticks:
{"tips":[{"priority":"high","title":"عنوان","body":"تفاصيل وخطوات عملية"},{"priority":"high","title":"","body":""},{"priority":"med","title":"","body":""},{"priority":"med","title":"","body":""},{"priority":"med","title":"","body":""},{"priority":"low","title":"","body":""},{"priority":"low","title":"","body":""},{"priority":"low","title":"","body":""},{"priority":"low","title":"","body":""},{"priority":"low","title":"","body":""}]}`;
  const text = await callAI(prompt);
  document.getElementById('tips-loader').style.display = 'none';
  if (!text) return;
  try {
    const d = JSON.parse(text.replace(/```json|```/g,'').trim());
    const labels = { high: '<span class="priority-tag p-high">أولوية عالية</span>', med: '<span class="priority-tag p-med">متوسطة</span>', low: '<span class="priority-tag p-low">منخفضة</span>' };
    document.getElementById('tips-content').innerHTML = d.tips.map((t,i) => `
      <div class="tip-item ${t.priority}">
        <div class="tip-title">${i+1}. ${t.title} ${labels[t.priority] || ''}</div>
        <div class="tip-body">${t.body}</div>
      </div>`).join('');
    document.getElementById('tips-out').style.display = 'block';
    toast('تم توليد الاقتراحات ✓');
  } catch(e) {
    document.getElementById('tips-content').innerHTML = text.replace(/\n/g,'<br>');
    document.getElementById('tips-out').style.display = 'block';
  }
}

// ═══════════════════════════════════════════
// ROBOTS & SITEMAP
// ═══════════════════════════════════════════
function generateRobots() {
  const url = document.getElementById('rob-url').value.trim().replace(/\/$/, '');
  if (!url) { toast('الرجاء إدخال رابط الموقع', 'var(--red)'); return; }
  const platform = document.getElementById('rob-platform').value;
  const noSearch = document.getElementById('rob-search').value === 'no';
  const extraDisallow = document.getElementById('rob-disallow').value.trim().split('\n').filter(Boolean);
  let disallows = ['User-agent: *'];
  if (platform === 'shopify') disallows.push('Disallow: /admin','Disallow: /cart','Disallow: /orders','Disallow: /checkouts/','Disallow: /checkout','Disallow: /account');
  else if (platform === 'salla') disallows.push('Disallow: /account','Disallow: /cart','Disallow: /checkout','Disallow: /profile');
  else if (platform === 'zid') disallows.push('Disallow: /account','Disallow: /cart','Disallow: /checkout');
  else if (platform === 'woo') disallows.push('Disallow: /wp-admin/','Disallow: /wp-includes/','Disallow: /cart/','Disallow: /checkout/','Disallow: /my-account/');
  else if (platform === 'blogger') disallows.push('Disallow: /search');
  else disallows.push('Disallow: /admin/','Disallow: /private/','Disallow: /tmp/');
  if (noSearch) disallows.push('Disallow: /*?s=','Disallow: /*?q=');
  extraDisallow.forEach(p => disallows.push('Disallow: ' + p));
  disallows.push('','Allow: /');
  disallows.push(`Sitemap: ${url}/sitemap.xml`);
  disallows.push('','# Generated by SEO Pro Tool v3 — ' + new Date().toLocaleDateString('ar-EG'));
  document.getElementById('robots-code').textContent = disallows.join('\n');
  document.getElementById('robots-out').style.display = 'block';
  toast('تم توليد robots.txt ✓');
}

function generateSitemap() {
  const url = document.getElementById('rob-url').value.trim().replace(/\/$/, '');
  const pages = document.getElementById('rob-pages').value.trim().split('\n').filter(Boolean);
  if (!url && !pages.length) { toast('الرجاء إدخال رابط الموقع أو الصفحات', 'var(--red)'); return; }
  const allPages = pages.length ? pages : [url+'/', url+'/about', url+'/contact'];
  const today = new Date().toISOString().split('T')[0];
  const urls = allPages.map((p, i) => `  <url>\n    <loc>${p}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${i === 0 ? 'daily' : 'weekly'}</changefreq>\n    <priority>${i === 0 ? '1.0' : '0.8'}</priority>\n  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
  document.getElementById('sitemap-code').textContent = xml;
  document.getElementById('robots-out').style.display = 'block';
  showFile('sitemap-file', document.querySelectorAll('.file-tab')[1]);
  toast('تم توليد sitemap.xml ✓');
}

async function genRobotsSitemapAI() {
  const url = document.getElementById('rob-url').value.trim();
  if (!url) { toast('الرجاء إدخال رابط الموقع', 'var(--red)'); return; }
  document.getElementById('robots-loader').style.display = 'block';
  const platform = document.getElementById('rob-platform').value;
  const prompt = `أنت خبير SEO. أنشئ robots.txt وsitemap.xml مثاليين للموقع: "${url}" المبني على منصة: "${platform}".
أعطني JSON فقط:
{"robots":"محتوى robots.txt كامل","sitemap":"محتوى sitemap.xml كامل"}`;
  const text = await callAI(prompt);
  document.getElementById('robots-loader').style.display = 'none';
  if (!text) return;
  try {
    const d = JSON.parse(text.replace(/```json|```/g,'').trim());
    document.getElementById('robots-code').textContent = d.robots;
    document.getElementById('sitemap-code').textContent = d.sitemap;
    document.getElementById('robots-out').style.display = 'block';
    toast('تم التوليد بالذكاء الاصطناعي ✓');
  } catch(e) { toast('خطأ، جرب الأزرار العادية', 'var(--yellow)'); }
}

// ═══════════════════════════════════════════
// OPEN GRAPH
// ═══════════════════════════════════════════
function generateOG() {
  const title = document.getElementById('og-title').value.trim();
  if (!title) { toast('الرجاء إدخال العنوان', 'var(--red)'); return; }
  const type = document.getElementById('og-type').value;
  const site = document.getElementById('og-site').value.trim();
  const desc = document.getElementById('og-desc').value.trim();
  const url = document.getElementById('og-url').value.trim();
  const img = document.getElementById('og-img').value.trim();
  const twType = document.getElementById('tw-type').value;
  const twUser = document.getElementById('tw-user').value.trim();
  let tags = `<!-- Open Graph Tags -->\n`;
  tags += `<meta property="og:type" content="${type}" />\n`;
  if (site) tags += `<meta property="og:site_name" content="${site}" />\n`;
  tags += `<meta property="og:title" content="${title}" />\n`;
  if (desc) tags += `<meta property="og:description" content="${desc}" />\n`;
  if (url) tags += `<meta property="og:url" content="${url}" />\n`;
  if (img) tags += `<meta property="og:image" content="${img}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n`;
  tags += `\n<!-- Twitter / X Card Tags -->\n`;
  tags += `<meta name="twitter:card" content="${twType}" />\n`;
  tags += `<meta name="twitter:title" content="${title}" />\n`;
  if (desc) tags += `<meta name="twitter:description" content="${desc}" />\n`;
  if (img) tags += `<meta name="twitter:image" content="${img}" />\n`;
  if (twUser) tags += `<meta name="twitter:site" content="${twUser}" />\n`;
  document.getElementById('og-code').textContent = tags;
  document.getElementById('og-out').style.display = 'block';
  toast('تم توليد OG Tags ✓');
}

// ═══════════════════════════════════════════
// COMPETITOR - FIXED v4 (real HTML fetch)
// ═══════════════════════════════════════════
async function analyzeCompetitor() {
  const mine = document.getElementById('comp-mine').value.trim();
  const rival = document.getElementById('comp-rival').value.trim();
  const kw = document.getElementById('comp-kw').value.trim();
  if (!mine || !rival) { toast('الرجاء إدخال الروابط', 'var(--red)'); return; }
  document.getElementById('comp-loader').style.display = 'block';
  document.getElementById('comp-out').style.display = 'none';

  // Fetch both sites HTML
  toast('🌐 جاري جلب بيانات المواقع...', 'var(--accent)');
  const [htmlMine, htmlRival] = await Promise.all([fetchPageHTML(mine), fetchPageHTML(rival)]);
  const dataMine = htmlMine ? parseHTMLForSEO(htmlMine, mine) : null;
  const dataRival = htmlRival ? parseHTMLForSEO(htmlRival, rival) : null;

  // Build real data context
  const buildSiteContext = (data, url, label) => {
    if (!data) return `${label}: ${url}\n(تعذّر جلب البيانات — تحليل من الـ URL فقط)\n`;
    return `${label}: ${url}
- Title: "${data.title}" (${data.titleLen} حرف)
- Meta Description: ${data.metaDesc ? data.metaDescLen + ' حرف' : 'غير موجودة'}
- H1: ${data.h1Count} | H2: ${data.h2Count} | H3: ${data.h3Count}
- Schema: ${data.hasSchema ? data.schemaTypes.join(', ') || 'موجود' : 'غير موجود'}
- Open Graph: ${data.hasOG ? '✓' : '✗'}
- Canonical: ${data.hasCanonical ? '✓' : '✗'}
- HTTPS: ${data.isHttps ? '✓' : '✗'}
- السوشيال ميديا: ${data.hasSocialLinks ? Object.entries(data.socialFound).filter(([,v])=>v).map(([k])=>k).join('، ') : 'لا يوجد'}
- واتساب: ${data.hasWhatsapp ? '✓' : '✗'}
- Analytics/GTM: ${(data.hasGA||data.hasGTM) ? '✓' : '✗'}
- Lazy Loading: ${data.hasLazyLoad ? '✓' : '✗'}
- CSS/JS: ${data.cssCount} CSS | ${data.jsCount} JS
- صور بدون Alt: ${data.imgsNoAlt}/${data.totalImgs}`;
  };

  const mineCtx = buildSiteContext(dataMine, mine, '🅰️ موقعي');
  const rivalCtx = buildSiteContext(dataRival, rival, '🅱️ المنافس');

  const prompt = `أنت خبير SEO متمرس. قارن بين موقعين بناءً على بياناتهما الحقيقية:

${mineCtx}

${rivalCtx}

${kw ? `الكلمة المفتاحية المستهدفة: "${kw}"` : ''}

قدّم تحليلاً مقارناً شاملاً باللغة العربية يشمل:
1. 🏆 من الأفضل SEO وبكم نقطة (بناءً على البيانات الحقيقية)
2. 💪 نقاط قوة المنافس التي يجب التعلم منها
3. ⚠️ نقاط ضعف المنافس (فرص يمكن استغلالها)
4. ✅ مميزات موقعي عن المنافس
5. 🚀 أهم 5 خطوات عملية للتفوق على المنافس
6. 🔑 كلمات مفتاحية يجب استهدافها للتفوق

اكتب بأسلوب مهني وعملي ومفصّل.`;

  const text = await callAI(prompt, 2500);
  document.getElementById('comp-loader').style.display = 'none';
  if (!text) return;

  // Format the output nicely
  const formatted = text
    .replace(/^#{1,3} /gm, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
    .replace(/^(\d+\. )/gm, '<br><strong style="color:var(--accent2)">$1</strong>')
    .replace(/\n/g, '<br>');

  document.getElementById('comp-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem">
      <div style="background:rgba(59,126,248,.07);border:1px solid rgba(59,126,248,.2);border-radius:var(--radius-sm);padding:10px">
        <div style="font-size:10px;color:var(--accent);font-weight:700;margin-bottom:5px">🅰️ موقعك</div>
        <div style="font-size:11px;color:var(--muted2)">${dataMine ? `Score: ~${calcScore(dataMine,{robotsOk:false,sitemapOk:false}).score}/100` : 'بيانات غير متاحة'}</div>
        <div style="font-size:11px;color:var(--muted2)">${new URL(mine).hostname}</div>
      </div>
      <div style="background:rgba(240,74,94,.07);border:1px solid rgba(240,74,94,.2);border-radius:var(--radius-sm);padding:10px">
        <div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:5px">🅱️ المنافس</div>
        <div style="font-size:11px;color:var(--muted2)">${dataRival ? `Score: ~${calcScore(dataRival,{robotsOk:false,sitemapOk:false}).score}/100` : 'بيانات غير متاحة'}</div>
        <div style="font-size:11px;color:var(--muted2)">${(() => { try { return new URL(rival).hostname; } catch(e) { return rival; }})()}</div>
      </div>
    </div>
    <div style="font-size:13px;line-height:2;color:var(--text)">${formatted}</div>`;
  document.getElementById('comp-out').style.display = 'block';
  toast('تم تحليل المنافس ✓');
}

// ═══════════════════════════════════════════
// CONTENT WRITER
// ═══════════════════════════════════════════
async function generateContent() {
  const kw = document.getElementById('cont-kw').value.trim();
  if (!kw) { toast('الرجاء إدخال كلمة مفتاحية أو موضوع', 'var(--red)'); return; }
  const lang = document.getElementById('cont-lang').value;
  const len = document.getElementById('cont-len').value;
  const original = document.getElementById('cont-original').value.trim();
  const lenMap = { short: '250-350 كلمة', medium: '500-700 كلمة', long: 'أكثر من 1000 كلمة' };
  document.getElementById('content-loader').style.display = 'block';
  document.getElementById('content-out').style.display = 'none';
  let prompt = '';
  if (contentType === 'outline') prompt = `أنت كاتب محتوى SEO محترف. اكتب مخطط مقال (outline) متكامل ومحسّن لـ SEO عن: "${kw}". اللغة: ${lang === 'ar' ? 'العربية' : 'الإنجليزية'}. يشمل: H1، H2، H3، نقاط رئيسية لكل قسم، اقتراحات للكلمات المفتاحية.`;
  else if (contentType === 'intro') prompt = `أنت كاتب محتوى SEO. اكتب مقدمة مقال احترافية ومحسّنة لـ SEO عن: "${kw}". الطول: ${lenMap[len]}. اللغة: ${lang === 'ar' ? 'العربية' : 'الإنجليزية'}. تشمل الكلمة المفتاحية بشكل طبيعي وجذّابة للقارئ.`;
  else if (contentType === 'product') prompt = `أنت كاتب محتوى SEO للتجارة الإلكترونية. اكتب وصف منتج احترافي ومحسّن لـ SEO للمنتج: "${kw}". الطول: ${lenMap[len]}. اللغة: ${lang === 'ar' ? 'العربية' : 'الإنجليزية'}. يشمل: مقدمة جذابة، مميزات، فوائد، CTA.`;
  else if (contentType === 'category') prompt = `اكتب وصف تصنيف احترافي محسّن لـ SEO للتصنيف: "${kw}". الطول: ${lenMap[len]}. اللغة: ${lang === 'ar' ? 'العربية' : 'الإنجليزية'}.`;
  else if (contentType === 'rewrite') prompt = `أعد صياغة هذا النص بشكل احترافي ومحسّن لـ SEO مع الحفاظ على المعنى الأصلي وتضمين الكلمة المفتاحية: "${kw}" بشكل طبيعي. اللغة: ${lang === 'ar' ? 'العربية' : 'الإنجليزية'}.\n\nالنص الأصلي:\n${original}`;
  const text = await callAI(prompt, 2400);
  document.getElementById('content-loader').style.display = 'none';
  if (!text) return;
  document.getElementById('content-result').textContent = text;
  document.getElementById('content-out').style.display = 'block';
  toast('تم توليد المحتوى ✓');
}

// ═══════════════════════════════════════════
// THEME TOGGLE
// ═══════════════════════════════════════════
let isDark = true;
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('light', !isDark);
  const btn = document.getElementById('theme-toggle');
  btn.textContent = isDark ? '☀️ فاتح' : '🌙 داكن';
  localStorage.setItem('seo_theme', isDark ? 'dark' : 'light');
}

// ═══════════════════════════════════════════
// SNAPSHOT SYSTEM (Before/After)
// ═══════════════════════════════════════════
let snapshots = JSON.parse(localStorage.getItem('seo_snapshots') || '[]');

function saveAuditSnapshot() {
  const url = document.getElementById('audit-url').value.trim();
  const auditOut = document.getElementById('audit-out');
  if (!url || auditOut.style.display === 'none') {
    toast('قم بتحليل الموقع أولاً ثم احفظ اللقطة', 'var(--red)');
    return;
  }
  const scoreEl = document.querySelector('.score-ring-num');
  const score = scoreEl ? parseInt(scoreEl.textContent) || 0 : 0;
  const checksOk = document.querySelectorAll('.check-item.ok-item').length;
  const checksErr = document.querySelectorAll('.check-item.err-item').length;
  const checksWarn = document.querySelectorAll('.check-item.warn-item').length;
  const snap = {
    url, score,
    checksOk, checksErr, checksWarn,
    date: new Date().toLocaleString('ar-EG'),
    timestamp: Date.now()
  };
  snapshots.push(snap);
  if (snapshots.length > 10) snapshots = snapshots.slice(-10);
  localStorage.setItem('seo_snapshots', JSON.stringify(snapshots));
  updateBAPanel();
  toast('✓ تم حفظ اللقطة — انتقل لقسم "قبل/بعد"', 'var(--green)');
}

function updateBAPanel() {
  if (snapshots.length === 0) return;
  const before = snapshots[0];
  const after = snapshots.length > 1 ? snapshots[snapshots.length - 1] : null;
  const scoreColor = s => s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--yellow)' : 'var(--red)';

  document.getElementById('ba-before-date').textContent = before.date;
  document.getElementById('ba-before-content').innerHTML = `
    <div class="ba-metric"><span class="ba-label">URL</span><span class="ba-val" style="font-size:11px;word-break:break-all;color:var(--accent)">${before.url}</span></div>
    <div class="ba-metric"><span class="ba-label">SEO Score</span><span class="ba-val" style="color:${scoreColor(before.score)}">${before.score}/100</span></div>
    ${before.checksOk !== undefined ? `
    <div class="ba-metric"><span class="ba-label">✅ فحوصات ناجحة</span><span class="ba-val" style="color:var(--green)">${before.checksOk}</span></div>
    <div class="ba-metric"><span class="ba-label">❌ فحوصات فاشلة</span><span class="ba-val" style="color:var(--red)">${before.checksErr}</span></div>
    <div class="ba-metric"><span class="ba-label">⚠️ تحذيرات</span><span class="ba-val" style="color:var(--yellow)">${before.checksWarn}</span></div>` : ''}`;

  if (after && after.timestamp !== before.timestamp) {
    document.getElementById('ba-after-date').textContent = after.date;
    document.getElementById('ba-after-content').innerHTML = `
      <div class="ba-metric"><span class="ba-label">URL</span><span class="ba-val" style="font-size:11px;word-break:break-all;color:var(--accent3)">${after.url}</span></div>
      <div class="ba-metric"><span class="ba-label">SEO Score</span><span class="ba-val" style="color:${scoreColor(after.score)}">${after.score}/100</span></div>
      ${after.checksOk !== undefined ? `
      <div class="ba-metric"><span class="ba-label">✅ فحوصات ناجحة</span><span class="ba-val" style="color:var(--green)">${after.checksOk}</span></div>
      <div class="ba-metric"><span class="ba-label">❌ فحوصات فاشلة</span><span class="ba-val" style="color:var(--red)">${after.checksErr}</span></div>
      <div class="ba-metric"><span class="ba-label">⚠️ تحذيرات</span><span class="ba-val" style="color:var(--yellow)">${after.checksWarn}</span></div>` : ''}`;

    const diff = after.score - before.score;
    const diffColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--yellow)';
    document.getElementById('ba-diff-card').style.display = 'block';
    document.getElementById('ba-diff-content').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:1rem">
        <div class="stat-card s-blue"><div class="stat-num">${before.score}</div><div class="stat-lbl">Score قبل</div></div>
        <div class="stat-card ${diff>0?'s-green':diff<0?'s-red':'s-yellow'}">
          <div class="stat-num">${diff>0?'+':''}${diff}</div><div class="stat-lbl">الفرق</div></div>
        <div class="stat-card ${diff>0?'s-green':diff<0?'s-red':'s-yellow'}"><div class="stat-num">${after.score}</div><div class="stat-lbl">Score بعد</div></div>
      </div>
      ${(before.checksOk !== undefined && after.checksOk !== undefined) ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:1rem">
        <div class="stat-card"><div class="stat-num" style="color:var(--green)">+${Math.max(0,after.checksOk-before.checksOk)}</div><div class="stat-lbl">فحوصات أُضيفت</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--red)">+${Math.max(0,after.checksErr-before.checksErr)}</div><div class="stat-lbl">أخطاء جديدة</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--yellow)">${after.checksWarn}</div><div class="stat-lbl">تحذيرات الآن</div></div>
      </div>` : ''}
      <div style="text-align:center;padding:12px;background:var(--surface2);border-radius:var(--radius-sm);font-size:15px;font-weight:700;color:${diffColor}">
        ${diff>0 ? `📈 تحسّن بمقدار ${diff} نقطة! 🎉` : diff<0 ? `📉 تراجع بمقدار ${Math.abs(diff)} نقطة` : '➡️ لا يوجد تغيير في الدرجة'}
      </div>`;
  }
}

function clearSnapshots() {
  snapshots = []; localStorage.removeItem('seo_snapshots');
  ['ba-before-date','ba-after-date'].forEach(id=>document.getElementById(id).textContent='لم تُحفظ بعد');
  ['ba-before-content','ba-after-content'].forEach(id=>document.getElementById(id).textContent='لا توجد لقطة محفوظة.');
  document.getElementById('ba-diff-card').style.display='none';
  toast('تم مسح اللقطات ✓');
}

// ═══════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════
async function exportPDF() {
  toast('⏳ جاري إنشاء الـ PDF...', 'var(--accent)');
  await new Promise(r => setTimeout(r, 300));
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
    const url = document.getElementById('audit-url')?.value || '';
    const scoreEl = document.querySelector('.score-ring-num');
    const score = scoreEl ? scoreEl.textContent : '—';
    const date = new Date().toLocaleDateString('ar-EG');
    const scoreParsed = parseInt(score) || 0;

    doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.setTextColor(59,126,248);
    doc.text('SEO Pro Tool v3.0 - Full Report', 105, 18, { align:'center' });
    doc.setFontSize(10); doc.setTextColor(100,116,139);
    doc.text(`URL: ${url.substring(0,70)}`, 15, 27);
    doc.text(`Date: ${date}`, 15, 33);
    doc.setFontSize(22);
    const sc = scoreParsed>=70?[16,212,144]:scoreParsed>=45?[245,166,35]:[240,74,94];
    doc.setTextColor(...sc);
    doc.text(`SEO Score: ${score}/100`, 105, 46, { align:'center' });
    doc.setDrawColor(30,45,72); doc.line(15, 50, 195, 50);

    let y = 58;
    const checkItems = document.querySelectorAll('.check-item');
    doc.setFontSize(12); doc.setTextColor(59,126,248);
    doc.text('SEO Checks:', 15, y); y += 7;
    checkItems.forEach(item => {
      if (y > 272) { doc.addPage(); y = 20; }
      const label = item.querySelector('.check-label')?.textContent||'';
      const detail = (item.querySelector('.check-detail')?.textContent||'').substring(0,55);
      const isOk = item.classList.contains('ok-item');
      const isErr = item.classList.contains('err-item');
      doc.setFontSize(9);
      doc.setTextColor(isOk?16:isErr?240:245, isOk?212:isErr?74:166, isOk?144:isErr?94:35);
      doc.text(`${isOk?'[OK]':isErr?'[ERR]':'[!]'} ${label}: ${detail}`, 15, y); y+=5.5;
    });

    const issueItems = document.querySelectorAll('#audit-issues .issue-item');
    if (issueItems.length) {
      y += 4; if(y>265){doc.addPage();y=20;}
      doc.setFontSize(12); doc.setTextColor(59,126,248);
      doc.text('Issues & Recommendations:', 15, y); y+=7;
      issueItems.forEach(item => {
        if (y>272){doc.addPage();y=20;}
        const title = item.querySelector('strong')?.textContent||'';
        const detail = (item.querySelector('span')?.textContent||'').substring(0,75);
        doc.setFontSize(8.5); doc.setTextColor(80,100,130);
        doc.text(`• ${title}: ${detail}`, 15, y); y+=5;
      });
    }

    doc.setFontSize(7.5); doc.setTextColor(100,116,139);
    doc.text('Generated by SEO Pro Tool v3.0 | openrouter.ai', 105, 289, { align:'center' });
    const hostname = url ? (() => { try { return new URL(url).hostname; } catch(e){ return 'site'; }})() : 'site';
    doc.save(`seo-report-${hostname}.pdf`);
    toast('✓ تم تصدير PDF بنجاح!');
  } catch(e) { toast('خطأ في إنشاء PDF — تأكد من تحميل الأداة', 'var(--red)'); console.error(e); }
}

async function exportSnapshotsPDF() {
  if (snapshots.length < 2) { toast('تحتاج لقطتين على الأقل', 'var(--yellow)'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(59,126,248);
  doc.text('SEO Before/After Comparison', 105, 20, {align:'center'});
  const before = snapshots[0]; const after = snapshots[snapshots.length-1];
  doc.setFontSize(10); doc.setTextColor(80,100,130);
  doc.text(`Before (${before.date}): Score ${before.score}/100 — ${before.url}`, 15, 32);
  doc.text(`After  (${after.date}): Score ${after.score}/100 — ${after.url}`, 15, 39);
  const diff = after.score - before.score;
  doc.setFontSize(14);
  doc.setTextColor(diff>0?16:240, diff>0?212:74, diff>0?144:94);
  doc.text(`Improvement: ${diff>0?'+':''}${diff} points`, 15, 50);
  doc.save('seo-before-after.pdf');
  toast('✓ تم تصدير المقارنة PDF');
}

// ═══════════════════════════════════════════
// BROKEN LINKS CHECKER - FIXED v4
// ═══════════════════════════════════════════
async function checkBrokenLinks() {
  const url = document.getElementById('broken-url').value.trim();
  if (!url) { toast('الرجاء إدخال رابط الصفحة', 'var(--red)'); return; }
  const type = document.getElementById('broken-type').value;
  const limit = parseInt(document.getElementById('broken-limit').value);
  document.getElementById('broken-loader').style.display = 'block';
  document.getElementById('broken-loader-text').style.display = 'block';
  document.getElementById('broken-out').style.display = 'none';
  const loaderTxt = document.getElementById('broken-loader-text');

  loaderTxt.textContent = '🌐 جاري جلب الصفحة...';
  const html = await fetchPageHTML(url);
  if (!html) {
    document.getElementById('broken-loader').style.display='none';
    document.getElementById('broken-loader-text').style.display='none';
    toast('تعذّر جلب الصفحة — قد يكون الموقع يحجب الوصول الخارجي', 'var(--red)');
    return;
  }

  const parser = new DOMParser();
  const docParsed = parser.parseFromString(html, 'text/html');
  let baseHost;
  try { baseHost = new URL(url).hostname; } catch(e) { baseHost = ''; }

  let links = Array.from(docParsed.querySelectorAll('a[href]'))
    .map(a => {
      try {
        const href = a.getAttribute('href');
        if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:') || href === '#') return null;
        return new URL(href, url).href;
      } catch(e){ return null; }
    })
    .filter(Boolean)
    .filter(l => l.startsWith('http'))
    .filter((v,i,a) => a.indexOf(v) === i); // deduplicate

  if (type==='internal') links = links.filter(l => { try{return new URL(l).hostname===baseHost;}catch(e){return false;} });
  else if (type==='external') links = links.filter(l => { try{return new URL(l).hostname!==baseHost;}catch(e){return false;} });
  links = links.slice(0, limit);

  if (links.length === 0) {
    document.getElementById('broken-loader').style.display='none';
    document.getElementById('broken-loader-text').style.display='none';
    toast('لم يتم العثور على روابط في الصفحة للفحص', 'var(--yellow)');
    document.getElementById('broken-results').innerHTML = '<div style="color:var(--muted2);font-size:13px;padding:1rem">لم يتم العثور على روابط قابلة للفحص في هذه الصفحة.</div>';
    document.getElementById('broken-out').style.display='block';
    return;
  }

  let okCount=0, brokenCount=0, warnCount=0;
  const results = [];

  // Process in batches of 4
  for (let i=0; i<links.length; i+=4) {
    const batch = links.slice(i,i+4);
    loaderTxt.textContent = `🔍 فحص ${Math.min(i+4,links.length)} / ${links.length} رابط...`;
    const batchRes = await Promise.all(batch.map(async lnk => {
      let isInternal = false;
      try { isInternal = new URL(lnk).hostname === baseHost; } catch(e){}
      try {
        const r = await fetchURL(lnk);
        return { url: lnk, status: r.status, ok: r.ok, isInternal };
      } catch(e) {
        return { url: lnk, status: 0, ok: false, isInternal };
      }
    }));
    results.push(...batchRes);
  }

  document.getElementById('broken-loader').style.display='none';
  document.getElementById('broken-loader-text').style.display='none';

  const htmlOut = results.map(r => {
    let cls, statusTxt, statusClass;
    if (r.ok) { okCount++; cls='ok-link'; statusTxt='✓ OK'; statusClass='status-ok'; }
    else if (r.status===404) { brokenCount++; cls='broken-link'; statusTxt='✗ 404'; statusClass='status-broken'; }
    else if (r.status===0) { warnCount++; cls='warn-link'; statusTxt='⚠ تعذّر'; statusClass='status-warn'; }
    else if (r.status>=300 && r.status<400) { warnCount++; cls='warn-link'; statusTxt=`⟳ ${r.status}`; statusClass='status-warn'; }
    else if (r.status>=500) { brokenCount++; cls='broken-link'; statusTxt=`✗ ${r.status}`; statusClass='status-broken'; }
    else { warnCount++; cls='warn-link'; statusTxt=`⚠ ${r.status||'؟'}`; statusClass='status-warn'; }
    const truncUrl = r.url.length>65 ? r.url.substring(0,62)+'...' : r.url;
    return `<div class="link-result ${cls}">
      <span class="link-status ${statusClass}">${statusTxt}</span>
      <span class="link-url" title="${r.url}">${truncUrl}</span>
      <span style="font-size:10px;color:var(--muted);min-width:50px">${r.isInternal?'🏠 داخلي':'🌐 خارجي'}</span>
      <a href="${r.url}" target="_blank" rel="noopener" style="font-size:11px;color:var(--accent);text-decoration:none;padding:2px 7px;border:1px solid rgba(59,126,248,.3);border-radius:5px;flex-shrink:0">↗</a>
    </div>`;
  }).join('');

  document.getElementById('broken-stats-ok').textContent=`✓ ${okCount}`;
  document.getElementById('broken-stats-broken').textContent=`✗ ${brokenCount}`;
  document.getElementById('broken-stats-warn').textContent=`⚠ ${warnCount}`;
  document.getElementById('broken-results').innerHTML = htmlOut || '<div style="color:var(--muted2);padding:1rem">لا توجد نتائج.</div>';
  document.getElementById('broken-out').style.display='block';
  toast(`اكتمل: ${okCount} سليم، ${brokenCount} مكسور، ${warnCount} تحذير`);
}

// ═══════════════════════════════════════════
// PAGE COMPARE
// ═══════════════════════════════════════════
async function comparePages() {
  const urlA = document.getElementById('cmp-url-a').value.trim();
  const urlB = document.getElementById('cmp-url-b').value.trim();
  if (!urlA||!urlB) { toast('الرجاء إدخال الروابط','var(--red)'); return; }
  document.getElementById('cmp-loader').style.display='block';
  document.getElementById('cmp-loader-text').style.display='block';
  document.getElementById('cmp-out').style.display='none';
  const loaderTxt = document.getElementById('cmp-loader-text');
  loaderTxt.textContent='🌐 جاري تحليل الصفحة الأولى...';
  const htmlA = await fetchPageHTML(urlA);
  loaderTxt.textContent='🌐 جاري تحليل الصفحة الثانية...';
  const htmlB = await fetchPageHTML(urlB);
  document.getElementById('cmp-loader').style.display='none';
  document.getElementById('cmp-loader-text').style.display='none';
  const dA = htmlA?parseHTMLForSEO(htmlA,urlA):null;
  const dB = htmlB?parseHTMLForSEO(htmlB,urlB):null;
  const metrics = [
    {label:'Title موجود',vA:dA?.title?'✅':'✗',vB:dB?.title?'✅':'✗',scoreA:dA?.title?1:0,scoreB:dB?.title?1:0},
    {label:'طول Title',vA:(dA?.titleLen||0)+' حرف',vB:(dB?.titleLen||0)+' حرف',scoreA:dA?.titleLen>=30&&dA?.titleLen<=65?1:0,scoreB:dB?.titleLen>=30&&dB?.titleLen<=65?1:0},
    {label:'Meta Description',vA:dA?.metaDesc?dA.metaDescLen+' حرف':'✗',vB:dB?.metaDesc?dB.metaDescLen+' حرف':'✗',scoreA:dA?.metaDesc?1:0,scoreB:dB?.metaDesc?1:0},
    {label:'H1 Tags',vA:String(dA?.h1Count??'—'),vB:String(dB?.h1Count??'—'),scoreA:dA?.h1Count===1?1:0,scoreB:dB?.h1Count===1?1:0},
    {label:'H2 Tags',vA:String(dA?.h2Count??'—'),vB:String(dB?.h2Count??'—'),scoreA:(dA?.h2Count||0)>0?1:0,scoreB:(dB?.h2Count||0)>0?1:0},
    {label:'Schema',vA:dA?.hasSchema?'✅':'✗',vB:dB?.hasSchema?'✅':'✗',scoreA:dA?.hasSchema?1:0,scoreB:dB?.hasSchema?1:0},
    {label:'Open Graph',vA:dA?.hasOG?'✅':'✗',vB:dB?.hasOG?'✅':'✗',scoreA:dA?.hasOG?1:0,scoreB:dB?.hasOG?1:0},
    {label:'Canonical',vA:dA?.hasCanonical?'✅':'✗',vB:dB?.hasCanonical?'✅':'✗',scoreA:dA?.hasCanonical?1:0,scoreB:dB?.hasCanonical?1:0},
    {label:'واتساب',vA:dA?.hasWhatsapp?'✅':'✗',vB:dB?.hasWhatsapp?'✅':'✗',scoreA:dA?.hasWhatsapp?1:0,scoreB:dB?.hasWhatsapp?1:0},
    {label:'سوشيال ميديا',vA:dA?.hasSocialLinks?'✅':'✗',vB:dB?.hasSocialLinks?'✅':'✗',scoreA:dA?.hasSocialLinks?1:0,scoreB:dB?.hasSocialLinks?1:0},
    {label:'Analytics/GTM',vA:(dA?.hasGA||dA?.hasGTM)?'✅':'✗',vB:(dB?.hasGA||dB?.hasGTM)?'✅':'✗',scoreA:(dA?.hasGA||dA?.hasGTM)?1:0,scoreB:(dB?.hasGA||dB?.hasGTM)?1:0},
    {label:'صور بدون Alt',vA:String(dA?.imgsNoAlt??'—'),vB:String(dB?.imgsNoAlt??'—'),scoreA:(dA?.imgsNoAlt||0)===0?1:0,scoreB:(dB?.imgsNoAlt||0)===0?1:0},
  ];
  const scoreA=metrics.reduce((s,m)=>s+m.scoreA,0);
  const scoreB=metrics.reduce((s,m)=>s+m.scoreB,0);
  const hosA = (() => { try{return new URL(urlA).hostname;}catch(e){return urlA;} })();
  const hosB = (() => { try{return new URL(urlB).hostname;}catch(e){return urlB;} })();
  const renderCol=(metrics,key,color)=>metrics.map(m=>`<div class="compare-row"><span class="compare-label">${m.label}</span><span class="compare-val" style="color:${m['score'+key]===1?'var(--green)':'var(--muted2)'}">${m['v'+key]}</span></div>`).join('');
  document.getElementById('cmp-col-a').innerHTML=`<h4 style="color:var(--accent)">🅰️ ${hosA}</h4>${renderCol(metrics,'A','var(--accent)')}<div style="margin-top:10px;text-align:center;padding:8px;background:rgba(59,126,248,.1);border-radius:8px;font-weight:700;font-size:14px;color:var(--accent)">${scoreA}/${metrics.length} نقطة</div>`;
  document.getElementById('cmp-col-b').innerHTML=`<h4 style="color:var(--accent3)">🅱️ ${hosB}</h4>${renderCol(metrics,'B','var(--accent3)')}<div style="margin-top:10px;text-align:center;padding:8px;background:rgba(139,92,246,.1);border-radius:8px;font-weight:700;font-size:14px;color:var(--accent3)">${scoreB}/${metrics.length} نقطة</div>`;
  const winner=scoreA>scoreB?`🏆 الصفحة الأولى أفضل بـ ${scoreA-scoreB} نقاط`:scoreB>scoreA?`🏆 الصفحة الثانية أفضل بـ ${scoreB-scoreA} نقاط`:'🤝 تعادل!';
  document.getElementById('cmp-winner').innerHTML=`<div style="text-align:center;padding:12px;background:var(--surface2);border-radius:var(--radius-sm);font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">${winner}</div>`;
  document.getElementById('cmp-ai-analysis').innerHTML=`<div class="loader" style="display:block"></div><div style="font-size:12px;color:var(--muted2);text-align:center;margin-top:6px">⏳ تحليل AI...</div>`;
  const aiPrompt=`قارن بين صفحتين SEO: أ: ${urlA} Score:${scoreA}/${metrics.length} — ب: ${urlB} Score:${scoreB}/${metrics.length}. باللغة العربية: الأفضل ولماذا، وأهم 3 تحسينات للأضعف. JSON: {"winner":"أ/ب/تعادل","reason":"سبب","improvements":["1","2","3"]}`;
  const aiTxt=await callAI(aiPrompt,700);
  if(aiTxt){try{const ai=JSON.parse(aiTxt.replace(/```json|```/g,'').trim());document.getElementById('cmp-ai-analysis').innerHTML=`<div style="background:rgba(139,92,246,.07);border:1px solid rgba(139,92,246,.2);border-radius:var(--radius-sm);padding:12px"><div style="font-size:12px;font-weight:700;color:#a78bfa;margin-bottom:6px">🤖 تحليل AI</div><div style="font-size:13px;color:var(--text);margin-bottom:8px">${ai.reason}</div>${ai.improvements.map(i=>`<div style="font-size:12px;color:var(--muted2);padding:2px 0">• ${i}</div>`).join('')}</div>`;}catch(e){document.getElementById('cmp-ai-analysis').innerHTML='';}}
  document.getElementById('cmp-out').style.display='block';
  toast('اكتملت المقارنة ✓');
}

// ═══════════════════════════════════════════
// KEYWORD DENSITY
// ═══════════════════════════════════════════
function calcDensity() {
  const kw = document.getElementById('dens-kw').value.trim().toLowerCase();
  const text = document.getElementById('dens-text').value.trim();
  const topN = parseInt(document.getElementById('dens-top').value);
  const stopWords = document.getElementById('dens-stop').value.split(',').map(w=>w.trim().toLowerCase()).filter(Boolean);
  if (!text) { toast('الرجاء إدخال النص','var(--red)'); return; }
  const defaultStop=['في','من','على','إلى','عن','هذا','هذه','التي','الذي','وهو','وهي','كما','ذلك','هو','هي','أن','إن','لا','ما','كان','أو','وقد','ولا','لم','قد','كل','بعض','مع','أما','ثم','بين','حيث','منذ','لأن','حتى','أي','تم','يتم','مما','عند','حول','خلال','بعد','قبل','a','an','the','and','or','but','in','on','at','to','for','of','is','are','was','were','it','this','that','with','be','by','not'];
  const allStop=[...new Set([...defaultStop,...stopWords])];
  const totalWords=text.split(/\s+/).filter(Boolean).length;
  const words=text.toLowerCase().replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!allStop.includes(w));
  const freq={};
  words.forEach(w=>{freq[w]=(freq[w]||0)+1;});
  const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,topN);
  let kwCount=0;
  if(kw){const regex=new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');kwCount=(text.match(regex)||[]).length;}
  const kwDensity=totalWords>0?((kwCount/totalWords)*100).toFixed(2):0;
  const kwStatus=kwDensity<0.5?'low':kwDensity>3?'high':'ok';
  const kwColor=kwStatus==='ok'?'var(--green)':kwStatus==='low'?'var(--yellow)':'var(--red)';
  const kwStatusText=kwStatus==='ok'?'✅ مثالية':kwStatus==='low'?'⚠️ منخفضة':' 🚨 حشو!';
  document.getElementById('density-summary').innerHTML=`
    <div class="stat-card s-blue"><div class="stat-num">${totalWords}</div><div class="stat-lbl">إجمالي الكلمات</div></div>
    <div class="stat-card ${kwStatus==='ok'?'s-green':kwStatus==='low'?'s-yellow':'s-red'}"><div class="stat-num">${kwDensity}%</div><div class="stat-lbl">كثافة "${kw||'—'}"</div></div>
    <div class="stat-card"><div class="stat-num">${kwCount}</div><div class="stat-lbl">تكرار الكلمة</div></div>
    <div class="stat-card"><div class="stat-num">${sorted.length}</div><div class="stat-lbl">كلمات فريدة</div></div>`;
  const maxCount=sorted[0]?.[1]||1;
  document.getElementById('density-bars').innerHTML=`
    ${kw?`<div style="background:rgba(16,212,144,.08);border:1px solid rgba(16,212,144,.2);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:12px"><div style="font-size:12px;font-weight:700;margin-bottom:3px">الكلمة المستهدفة: "${kw}"</div><div style="font-size:13px;color:${kwColor};font-weight:700">${kwStatusText} — ${kwDensity}% (${kwCount} مرة من ${totalWords})</div><div class="prog-bar" style="margin-top:6px"><div class="prog-fill ${kwStatus}" style="width:${Math.min(parseFloat(kwDensity)/5*100,100)}%"></div></div></div>`:''}
    ${sorted.map(([word,count])=>{const pct=((count/totalWords)*100).toFixed(2);const fillClass=pct>3?'high':pct>=1?'ok':'low';const isKw=word===kw.toLowerCase();return `<div class="density-bar-row"><span class="density-word" style="${isKw?'color:var(--accent2);font-weight:900':''}">${word}${isKw?' ⭐':''}</span><span class="density-count">${count}x</span><span class="density-pct" style="color:${pct>3?'var(--red)':pct>=1?'var(--green)':'var(--muted2)'}">${pct}%</span><div class="density-bar"><div class="density-fill ${fillClass}" style="width:${count/maxCount*100}%"></div></div></div>`;}).join('')}`;
  document.getElementById('density-out').style.display='block';
  toast('تم تحليل الكثافة ✓');
}

// ═══════════════════════════════════════════
// SPELL + SEO CHECKER
// ═══════════════════════════════════════════
async function checkSpellSEO() {
  const kw=document.getElementById('spell-kw').value.trim();
  const text=document.getElementById('spell-text').value.trim();
  const lang=document.getElementById('spell-lang').value;
  const mode=document.getElementById('spell-mode').value;
  if(!text){toast('الرجاء إدخال النص','var(--red)');return;}
  document.getElementById('spell-loader').style.display='block';
  document.getElementById('spell-out').style.display='none';
  const wc=text.split(/\s+/).filter(Boolean).length;
  const prompt=`أنت خبير في تدقيق المحتوى واللغة والـ SEO.
النص: """${text.substring(0,2500)}"""
${kw?`الكلمة المفتاحية: "${kw}"`:''}
اللغة: ${lang==='ar'?'العربية':lang==='en'?'الإنجليزية':'عربي وإنجليزي'} | نوع التدقيق: ${mode}
JSON فقط:
{"summary":{"word_count":رقم,"sentence_count":رقم,"readability":"سهل/متوسط/صعب","seo_friendly":true},"grammar_issues":[{"type":"نوع","original":"خاطئ","suggestion":"صحيح","explanation":"سبب"}],"seo_issues":[{"issue":"مشكلة","fix":"حل"}],"strengths":["نقطة1","نقطة2"],"overall_score":رقم}`;
  const result=await callAI(prompt,2000);
  document.getElementById('spell-loader').style.display='none';
  if(!result)return;
  try {
    const d=JSON.parse(result.replace(/```json|```/g,'').trim());
    const sc=d.overall_score>=70?'var(--green)':d.overall_score>=45?'var(--yellow)':'var(--red)';
    document.getElementById('spell-results').innerHTML=`
      <div class="grid4" style="margin-bottom:1rem">
        <div class="stat-card"><div class="stat-num" style="color:${sc}">${d.overall_score||0}</div><div class="stat-lbl">نقاط المحتوى</div></div>
        <div class="stat-card"><div class="stat-num">${d.summary?.word_count||wc}</div><div class="stat-lbl">كلمات</div></div>
        <div class="stat-card ${(d.grammar_issues||[]).length===0?'s-green':'s-yellow'}"><div class="stat-num">${(d.grammar_issues||[]).length}</div><div class="stat-lbl">مشاكل لغوية</div></div>
        <div class="stat-card ${(d.seo_issues||[]).length===0?'s-green':'s-yellow'}"><div class="stat-num">${(d.seo_issues||[]).length}</div><div class="stat-lbl">مشاكل SEO</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem">
        <span style="font-size:12px;padding:3px 10px;background:rgba(59,126,248,.1);border:1px solid rgba(59,126,248,.2);border-radius:99px;color:var(--accent)">قابلية القراءة: ${d.summary?.readability||'—'}</span>
        <span style="font-size:12px;padding:3px 10px;background:${d.summary?.seo_friendly?'rgba(16,212,144,.1)':'rgba(245,166,35,.1)'};border:1px solid ${d.summary?.seo_friendly?'rgba(16,212,144,.2)':'rgba(245,166,35,.2)'};border-radius:99px;color:${d.summary?.seo_friendly?'var(--green)':'var(--yellow)'}">${d.summary?.seo_friendly?'✅ SEO جيد':'⚠️ يحتاج تحسين'}</span>
      </div>
      ${(d.grammar_issues||[]).length>0?`<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px">🔴 مشاكل لغوية</div>${d.grammar_issues.map(g=>`<div class="spell-issue error-issue"><div style="font-size:12px;font-weight:700;color:var(--red)">${g.type}</div><div style="font-size:12px;margin:4px 0">❌ "${g.original}" → ✅ <strong style="color:var(--green)">"${g.suggestion}"</strong></div><div style="font-size:11px;color:var(--muted2)">${g.explanation}</div></div>`).join('')}`:'<div style="background:rgba(16,212,144,.07);border:1px solid rgba(16,212,144,.2);border-radius:var(--radius-sm);padding:10px;font-size:13px;color:var(--green);margin-bottom:10px">✅ لا توجد أخطاء لغوية</div>'}
      ${(d.seo_issues||[]).length>0?`<div style="font-size:12px;font-weight:700;color:var(--accent);margin:12px 0 8px">🔵 مشاكل SEO</div>${d.seo_issues.map(s=>`<div class="spell-issue seo-issue"><div style="font-size:12px;font-weight:700;color:var(--accent)">${s.issue}</div><div style="font-size:11px;color:var(--muted2);margin-top:3px">💡 ${s.fix}</div></div>`).join('')}`:''}
      ${(d.strengths||[]).length>0?`<div style="font-size:12px;font-weight:700;color:var(--green);margin:12px 0 8px">✅ نقاط القوة</div>${d.strengths.map(s=>`<div style="font-size:12px;color:var(--muted2);padding:3px 0">• ${s}</div>`).join('')}`:''}`;
    document.getElementById('spell-out').style.display='block';
    toast('اكتمل التدقيق ✓');
  } catch(e) {
    document.getElementById('spell-results').innerHTML=`<div style="white-space:pre-wrap;font-size:13px;line-height:1.8">${result}</div>`;
    document.getElementById('spell-out').style.display='block';
  }
}

// ═══════════════════════════════════════════
// LOCAL KEYWORDS
// ═══════════════════════════════════════════
async function genLocalKeywords() {
  const kw=document.getElementById('lkw-main').value.trim();
  const city=document.getElementById('lkw-city').value.trim();
  const country=document.getElementById('lkw-country').value;
  const type=document.getElementById('lkw-type').value;
  if(!kw||!city){toast('الرجاء إدخال الكلمة المفتاحية والمدينة','var(--red)');return;}
  document.getElementById('lkw-loader').style.display='block';
  document.getElementById('lkw-out').style.display='none';
  const cnames={sa:'السعودية',eg:'مصر',ae:'الإمارات',kw:'الكويت',qa:'قطر',bh:'البحرين',om:'عُمان',jo:'الأردن',lb:'لبنان',ma:'المغرب'};
  const prompt=`خبير SEO محلي عربي. الكلمة: "${kw}" | المدينة: "${city}" | الدولة: "${cnames[country]||country}" | النوع: "${type}"
JSON فقط:
{"primary":["5 كلمات"],"with_city":["6 مع المدينة"],"near_me":["4 بالقرب مني"],"voice_search":["4 صوتي طبيعي"],"long_tail":["5 ذيل طويل"],"seasonal":["3 موسمية"],"competitor_gap":["3 فجوة منافس"]}`;
  const result=await callAI(prompt,1400);
  document.getElementById('lkw-loader').style.display='none';
  if(!result)return;
  try {
    const d=JSON.parse(result.replace(/```json|```/g,'').trim());
    const sections=[
      {key:'primary',label:'⭐ الكلمات الرئيسية',color:'var(--accent)'},
      {key:'with_city',label:`📍 مع "${city}"`,color:'var(--accent2)'},
      {key:'near_me',label:'📌 "بالقرب مني"',color:'var(--green)'},
      {key:'voice_search',label:'🎙️ البحث الصوتي',color:'#a78bfa'},
      {key:'long_tail',label:'🎯 Long-tail',color:'var(--yellow)'},
      {key:'seasonal',label:'📅 الموسمية',color:'var(--orange)'},
      {key:'competitor_gap',label:'⚔️ فجوة المنافسين',color:'var(--red)'},
    ];
    document.getElementById('lkw-results').innerHTML=sections.filter(s=>d[s.key]?.length).map(s=>`
      <div class="local-kw-card">
        <div class="local-kw-title" style="color:${s.color}">${s.label}</div>
        <div class="local-kw-tags">${(d[s.key]||[]).map(kw=>`<span class="local-kw-tag" onclick="navigator.clipboard.writeText(this.textContent.replace(' ✓','')).then(()=>{this.textContent=this.textContent+' ✓';setTimeout(()=>{this.textContent=this.textContent.replace(' ✓','')},1500)})" style="border-color:${s.color}40;color:${s.color}">${kw}</span>`).join('')}</div>
      </div>`).join('');
    document.getElementById('lkw-out').style.display='block';
    toast('تم توليد الكلمات المحلية ✓');
  } catch(e) {
    document.getElementById('lkw-results').innerHTML=`<div style="white-space:pre-wrap;font-size:13px">${result}</div>`;
    document.getElementById('lkw-out').style.display='block';
  }
}
function copyLocalKws(){const tags=document.querySelectorAll('.local-kw-tag');navigator.clipboard.writeText(Array.from(tags).map(t=>t.textContent).join('\n')).then(()=>toast('تم نسخ الكل ✓'));}

// ═══════════════════════════════════════════
// IMAGE COMPRESSOR
// ═══════════════════════════════════════════
let codeType = 'css';
function setCodeType(t, el) {
  codeType = t;
  document.querySelectorAll('#code-type-btns .seg-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const placeholders = {
    css: '/* الصق كود CSS هنا */\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 0;\n}',
    js: '// الصق كود JavaScript هنا\nfunction greet(name) {\n  return "Hello, " + name + "!";\n}',
    html: '<!-- الصق كود HTML هنا -->\n<div class="container">\n  <h1>Hello World</h1>\n</div>'
  };
  document.getElementById('code-input').placeholder = placeholders[t] || '';
}

function handleImgDrop(e) {
  e.preventDefault();
  document.getElementById('img-drop-zone').style.borderColor = 'var(--border2)';
  handleImgFiles(e.dataTransfer.files);
}

let compressedImages = [];

async function handleImgFiles(files) {
  if (!files || files.length === 0) return;
  const quality = parseInt(document.getElementById('img-quality').value) / 100;
  const format = document.getElementById('img-format').value;
  const maxWidth = parseInt(document.getElementById('img-max-width').value) || 0;
  const addAlt = document.getElementById('img-alt-ai').value === 'yes';

  compressedImages = [];
  document.getElementById('img-results-grid').innerHTML = '';
  document.getElementById('img-compress-results').style.display = 'block';

  let totalOriginal = 0, totalCompressed = 0;

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    const result = await compressImage(file, quality, format, maxWidth);
    totalOriginal += result.originalSize;
    totalCompressed += result.compressedSize;
    compressedImages.push(result);

    const saved = ((1 - result.compressedSize / result.originalSize) * 100).toFixed(1);
    const savedColor = saved > 30 ? 'var(--green)' : saved > 10 ? 'var(--yellow)' : 'var(--muted2)';

    let altText = '';
    if (addAlt) {
      altText = await generateAltText(result.blob, file.name);
    }

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;';
    card.innerHTML = `
      <img src="${result.url}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px"/>
      <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${file.name}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:var(--muted2)">قبل: ${formatBytes(result.originalSize)}</span>
        <span style="color:var(--green)">بعد: ${formatBytes(result.compressedSize)}</span>
      </div>
      <div style="background:var(--surface3);border-radius:99px;height:5px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;background:var(--green);width:${Math.min(parseFloat(saved),100)}%;border-radius:99px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:${savedColor}">🗜️ وفّر ${saved}%</span>
        <button onclick="downloadSingleImage(${compressedImages.length-1})" style="font-size:11px;padding:3px 10px;background:var(--accent);color:#fff;border:none;border-radius:5px;cursor:pointer">⬇️ تحميل</button>
      </div>
      ${altText ? `<div style="margin-top:6px;padding:6px;background:rgba(59,126,248,.08);border-radius:5px;font-size:11px;color:var(--accent)">Alt: ${altText}</div>` : ''}
    `;
    document.getElementById('img-results-grid').appendChild(card);
  }

  const totalSaved = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
  document.getElementById('img-summary-stats').textContent =
    `✅ ${compressedImages.length} صورة | قبل: ${formatBytes(totalOriginal)} → بعد: ${formatBytes(totalCompressed)} | وفّر ${totalSaved}%`;
}

async function compressImage(file, quality, format, maxWidth) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (maxWidth > 0 && w > maxWidth) {
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const outFormat = format === 'original' ? (file.type || 'image/jpeg') : format;
        const ext = outFormat === 'image/webp' ? 'webp' : outFormat === 'image/png' ? 'png' : 'jpg';
        canvas.toBlob(blob => {
          resolve({
            name: file.name.replace(/\.[^.]+$/, '') + '.' + ext,
            blob, url: URL.createObjectURL(blob),
            originalSize: file.size, compressedSize: blob.size,
            format: outFormat
          });
        }, outFormat, quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function generateAltText(blob, filename) {
  try {
    const base64 = await new Promise(r => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result.split(',')[1]);
      fr.readAsDataURL(blob);
    });
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: (document.getElementById('model-id')?.value || '').trim() || 'inclusionai/ling-2.6-flash:free',
        max_tokens: 80,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          { type: 'text', text: 'اكتب نص alt مختصر لهذه الصورة باللغة العربية (أقل من 10 كلمات)، فقط النص بدون أي مقدمة:' }
        ]}]
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content?.trim() || '';
  } catch(e) { return ''; }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1024/1024).toFixed(2) + ' MB';
}

function downloadSingleImage(idx) {
  const img = compressedImages[idx];
  if (!img) return;
  const a = document.createElement('a');
  a.href = img.url; a.download = img.name; a.click();
}

async function downloadAllImages() {
  if (compressedImages.length === 0) return;
  if (compressedImages.length === 1) { downloadSingleImage(0); return; }
  // Simple download all individually if no JSZip
  toast('⏳ جاري تحميل الصور...', 'var(--accent)');
  for (let i = 0; i < compressedImages.length; i++) {
    await new Promise(r => setTimeout(r, 300));
    downloadSingleImage(i);
  }
  toast(`✅ تم تحميل ${compressedImages.length} صورة`);
}

// ═══════════════════════════════════════════
// CODE MINIFIER
// ═══════════════════════════════════════════
function minifyCode() {
  const input = document.getElementById('code-input').value.trim();
  if (!input) { toast('الرجاء إدخال الكود', 'var(--red)'); return; }

  let minified = '';
  const originalSize = new Blob([input]).size;

  if (codeType === 'css') {
    minified = input
      .replace(/\/\*[\s\S]*?\*\//g, '')        // remove comments
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*;\s*/g, ';')
      .replace(/\s*,\s*/g, ',')
      .replace(/;\s*}/g, '}')
      .replace(/\n+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  } else if (codeType === 'js') {
    minified = input
      .replace(/\/\/[^\n]*/g, '')             // remove // comments
      .replace(/\/\*[\s\S]*?\*\//g, '')        // remove /* */ comments
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+/gm, '')
      .replace(/\s*([=+\-*/%&|^!<>?:,;{}()\[\]])\s*/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n/g, '')
      .trim();
  } else if (codeType === 'html') {
    minified = input
      .replace(/<!--[\s\S]*?-->/g, '')         // remove HTML comments
      .replace(/\n\s*/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }

  const minifiedSize = new Blob([minified]).size;
  const saved = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
  const savedColor = saved > 30 ? 'var(--green)' : saved > 10 ? 'var(--yellow)' : 'var(--muted2)';

  document.getElementById('code-stats-grid').innerHTML = `
    <div class="stat-card s-blue"><div class="stat-num">${formatBytes(originalSize)}</div><div class="stat-lbl">الحجم الأصلي</div></div>
    <div class="stat-card ${parseFloat(saved)>30?'s-green':parseFloat(saved)>10?'s-yellow':''}"><div class="stat-num" style="color:${savedColor}">${saved}%</div><div class="stat-lbl">نسبة الضغط</div></div>
    <div class="stat-card s-green"><div class="stat-num">${formatBytes(minifiedSize)}</div><div class="stat-lbl">الحجم بعد الضغط</div></div>`;

  document.getElementById('code-output').textContent = minified;
  document.getElementById('code-out').style.display = 'block';
  toast(`✅ تم الضغط! وفّر ${saved}% (${formatBytes(originalSize - minifiedSize)})`);
}

function downloadMinifiedCode() {
  const content = document.getElementById('code-output').textContent;
  if (!content) return;
  const ext = codeType === 'css' ? 'css' : codeType === 'js' ? 'js' : 'html';
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `minified.${ext}`;
  a.click();
  toast('تم التحميل ✓');
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
const savedTheme=localStorage.getItem('seo_theme');
if(savedTheme==='light'){isDark=false;document.body.classList.add('light');document.getElementById('theme-toggle').textContent='🌙 داكن';}
updateBAPanel();

// ═══════════════════════════════════════════
// PAGE SPEED — v5 NEW FEATURE
// ═══════════════════════════════════════════
let psDevice = 'mobile';
// PageSpeed runs via /api/pagespeed — key is server-side

function setSpeedDevice(d, el) {
  psDevice = d;
  document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ps-device-label').textContent = d === 'mobile' ? 'موبايل 📱' : 'ديسكتوب 🖥️';
}

function getScoreColor(s) {
  if (s >= 90) return 'var(--green)';
  if (s >= 50) return 'var(--yellow)';
  return 'var(--red)';
}
function getScoreGrade(s) {
  if (s >= 90) return '<span class="speed-score-grade grade-good">ممتاز ✓</span>';
  if (s >= 50) return '<span class="speed-score-grade grade-avg">متوسط ⚠</span>';
  return '<span class="speed-score-grade grade-poor">ضعيف ✗</span>';
}

function fmtMetric(val, unit) {
  if (val === undefined || val === null) return '—';
  if (unit === 's') return (val/1000).toFixed(2) + ' ث';
  if (unit === 'ms') return Math.round(val) + ' مللي ث';
  if (unit === 'cls') return parseFloat(val).toFixed(3);
  return val;
}

function getMetricClass(id, val) {
  const thresholds = {
    'first-contentful-paint': [1800, 3000],
    'largest-contentful-paint': [2500, 4000],
    'total-blocking-time': [200, 600],
    'cumulative-layout-shift': [0.1, 0.25],
    'speed-index': [3400, 5800],
    'interactive': [3800, 7300],
  };
  const t = thresholds[id];
  if (!t) return '';
  if (val <= t[0]) return 'good';
  if (val <= t[1]) return 'avg';
  return 'bad';
}

async function runPageSpeed() {
  const url = document.getElementById('ps-url').value.trim();
  if (!url) { toast('الرجاء إدخال رابط الموقع', 'var(--red)'); return; }
  
  document.getElementById('ps-loader').style.display = 'block';
  document.getElementById('ps-loader-text').style.display = 'block';
  document.getElementById('ps-loader-text').textContent = `⏳ جاري تحليل سرعة ${psDevice === 'mobile' ? 'الموبايل' : 'الديسكتوب'}...`;
  document.getElementById('ps-out').style.display = 'none';

  const apiUrl = `/api/pagespeed?url=${encodeURIComponent(url)}&strategy=${psDevice.toUpperCase()}`;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(35000) });
    if (!res.ok) {
      const err = await res.json();
      toast('خطأ PageSpeed: ' + (err.error?.message || res.status), 'var(--red)');
      document.getElementById('ps-loader').style.display='none';
      document.getElementById('ps-loader-text').style.display='none';
      return;
    }
    const data = await res.json();
    document.getElementById('ps-loader').style.display='none';
    document.getElementById('ps-loader-text').style.display='none';
    renderPageSpeedResults(data, url);
  } catch(e) {
    document.getElementById('ps-loader').style.display='none';
    document.getElementById('ps-loader-text').style.display='none';
    toast('فشل الاتصال بـ PageSpeed API — تحقق من الإنترنت', 'var(--red)');
  }
}

function renderPageSpeedResults(data, url) {
  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};

  // Debug: log categories keys to console
  console.log('Categories keys:', Object.keys(cats));
  console.log('Categories data:', JSON.stringify(cats, null, 2).substring(0, 500));

  // Categories scores — handle null score (means not measured)
  const scoreMap = [
    { key: 'performance',     label: '⚡ الأداء والسرعة',      altKey: null },
    { key: 'accessibility',   label: '♿ إمكانية الوصول',       altKey: null },
    { key: 'seo',             label: '🔍 SEO',                  altKey: null },
    { key: 'best-practices',  label: '✅ أفضل الممارسات',       altKey: 'bestPractices' },
  ];

  document.getElementById('ps-scores-grid').innerHTML = scoreMap.map(({ key, label, altKey }) => {
    const cat = cats[key] || (altKey ? cats[altKey] : null);
    const rawScore = cat?.score;
    const hasScore = rawScore !== null && rawScore !== undefined;
    const v = hasScore ? Math.round(rawScore * 100) : null;
    const displayNum = hasScore ? v : '—';
    const displayColor = hasScore ? getScoreColor(v) : 'var(--muted2)';
    const displayGrade = hasScore ? getScoreGrade(v) : '<span class="speed-score-grade" style="background:rgba(100,116,139,.1);color:var(--muted2)">غير متاح</span>';
    return `
      <div class="speed-score-card">
        <div class="speed-score-num" style="color:${displayColor}">${displayNum}</div>
        <div class="speed-score-label">${label}</div>
        ${displayGrade}
      </div>`;
  }).join('');

  // Core Web Vitals
  const cwv = [
    { id: 'first-contentful-paint', name: 'أول ظهور للمحتوى', abbr: 'FCP', unit: 'ms', desc: 'وقت ظهور أول عنصر مرئي' },
    { id: 'largest-contentful-paint', name: 'أكبر عنصر مرئي', abbr: 'LCP', unit: 'ms', desc: 'وقت تحميل العنصر الأكبر (صورة/نص)' },
    { id: 'total-blocking-time', name: 'وقت الحجب الكلي', abbr: 'TBT', unit: 'ms', desc: 'مقدر لـ First Input Delay' },
    { id: 'cumulative-layout-shift', name: 'ثبات التصميم', abbr: 'CLS', unit: 'cls', desc: 'مقدار تحرك العناصر أثناء التحميل' },
    { id: 'speed-index', name: 'مؤشر السرعة', abbr: 'SI', unit: 'ms', desc: 'متوسط سرعة ظهور المحتوى' },
    { id: 'interactive', name: 'وقت التفاعل', abbr: 'TTI', unit: 'ms', desc: 'الوقت لاستجابة الصفحة للمستخدم' },
  ];

  document.getElementById('ps-metrics-grid').innerHTML = cwv.map(m => {
    const audit = audits[m.id];
    const raw = audit?.numericValue;
    const display = audit?.displayValue || fmtMetric(raw, m.unit);
    const cls = getMetricClass(m.id, raw);
    return `
      <div class="metric-item ${cls}">
        <div class="metric-name">${m.abbr} — ${m.name}</div>
        <div class="metric-value">${display}</div>
        <div class="metric-desc">${m.desc}</div>
      </div>`;
  }).join('');

  // Opportunities
  const opps = Object.values(audits).filter(a => a.details?.type === 'opportunity' && a.score !== null && a.score < 1 && a.details?.overallSavingsMs > 100).sort((a,b) => (b.details?.overallSavingsMs||0) - (a.details?.overallSavingsMs||0)).slice(0, 8);
  
  if (opps.length > 0) {
    const icons = { 'render-blocking-resources':'⛔', 'unused-css-rules':'🎨', 'unused-javascript':'📜', 'uses-optimized-images':'🖼️', 'uses-webp-images':'🌟', 'efficient-animated-content':'🎬', 'defer-offscreen-images':'📏', 'uses-text-compression':'🗜️', 'uses-rel-preconnect':'🔗', 'server-response-time':'🖥️' };
    document.getElementById('ps-opps-list').innerHTML = opps.map(a => {
      const savings = a.details?.overallSavingsMs ? `وفر ${(a.details.overallSavingsMs/1000).toFixed(1)}ث` : '';
      const icon = icons[a.id] || '💡';
      return `<div class="opp-item">
        <div class="opp-icon">${icon}</div>
        <div>
          <div class="opp-title">${a.title}</div>
          <div class="opp-detail">${a.description?.split('.')[0] || ''}</div>
          ${savings ? `<span class="opp-savings">⚡ ${savings}</span>` : ''}
        </div>
      </div>`;
    }).join('');
    document.getElementById('ps-opps-card').style.display='block';
  }

  // Diagnostics
  const diags = Object.values(audits).filter(a => a.details?.type === 'table' && a.score !== null && a.score < 1 && !opps.find(o=>o.id===a.id)).slice(0, 5);
  if (diags.length) {
    document.getElementById('ps-diag-list').innerHTML = `<div class="opps-list">${diags.map(a => `
      <div class="opp-item">
        <div class="opp-icon">🔬</div>
        <div>
          <div class="opp-title">${a.title}</div>
          <div class="opp-detail">${a.description?.split('.')[0]||''}</div>
        </div>
      </div>`).join('')}</div>`;
    document.getElementById('ps-diag-card').style.display='block';
  }

  // Helper to safely get a category score
  const getScore = (key, altKey) => {
    const cat = cats[key] || (altKey ? cats[altKey] : null);
    return cat?.score != null ? Math.round(cat.score * 100) : '—';
  };

  document.getElementById('ps-out').style.display='block';
  toast(`✅ اكتمل التحليل — الأداء: ${getScore('performance')}/100`);

  // AI Analysis — always available (key is server-side)
  document.getElementById('ps-ai-card').style.display='block';
  document.getElementById('ps-ai-loader').style.display='block';
    const perfScore = getScore('performance');
    const seoScore  = getScore('seo');
    const accScore  = getScore('accessibility');
    const bpScore   = getScore('best-practices', 'bestPractices');
    const lcpAudit = audits['largest-contentful-paint']?.displayValue || '—';
    const clsAudit = audits['cumulative-layout-shift']?.displayValue || '—';
    const tbtAudit = audits['total-blocking-time']?.displayValue || '—';
    const topOpp = opps.slice(0,3).map(o=>o.title).join('، ');
    
    const psPrompt = `أنت خبير تحسين سرعة المواقع وSEO. حلل نتائج PageSpeed Insights التالية للموقع "${url}" على ${psDevice === 'mobile' ? 'الموبايل' : 'الديسكتوب'}:
    
- نقاط الأداء: ${perfScore}/100
- نقاط SEO: ${seoScore}/100
- نقاط إمكانية الوصول: ${accScore}/100
- أفضل الممارسات: ${bpScore}/100
- LCP (أكبر عنصر): ${lcpAudit}
- CLS (ثبات التصميم): ${clsAudit}
- TBT (وقت الحجب): ${tbtAudit}
- أهم الفرص: ${topOpp || 'لا توجد فرص واضحة'}

قدم تحليلاً واضحاً باللغة العربية يشمل:
1. تقييم عام للسرعة وتأثيرها على الـ SEO
2. أهم 3 مشاكل تحتاج إصلاحاً فورياً مع خطوات عملية
3. نصائح تحسين خاصة بـ ${psDevice === 'mobile' ? 'الموبايل' : 'الديسكتوب'}
4. توقعك لتحسن الترتيب في Google بعد الإصلاح

اكتب بأسلوب مختصر وعملي.`;
    
    callAI(psPrompt, 1200).then(text => {
      document.getElementById('ps-ai-loader').style.display='none';
      if (text) {
        document.getElementById('ps-ai-text').innerHTML = text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
      }
    });
}


// ═══════════════════════════════════════════
// KEYWORD PLANNER — v6 NEW FEATURE
// ═══════════════════════════════════════════
let kwData = [];

async function runKwPlanner() {
  const seed = document.getElementById('kwp-seed').value.trim();
  if (!seed) { toast('الرجاء إدخال كلمة مفتاحية', 'var(--red)'); return; }

  const country = document.getElementById('kwp-country').value;
  const intent = document.getElementById('kwp-intent').value;
  const type = document.getElementById('kwp-type').value;
  const count = document.getElementById('kwp-count').value;

  document.getElementById('kwp-loader').style.display = 'block';
  document.getElementById('kwp-loader-text').style.display = 'block';
  document.getElementById('kwp-out').style.display = 'none';

  const prompt = `أنت خبير SEO وبحث الكلمات المفتاحية. المستخدم يريد بحث الكلمات المفتاحية لـ:
- الكلمة الرئيسية: "${seed}"
- البلد: ${country}
- نوع النية: ${intent}
- نوع النشاط: ${type}
- عدد الكلمات المطلوبة: ${count}

أنت خبير في السوق العربي وتفهم كيف يبحث الناس بالعامية والفصحى.

أعطني JSON فقط بهذا الشكل (بدون أي نص خارج JSON):
{
  "keywords": [
    {
      "keyword": "الكلمة المفتاحية",
      "volume": "عالي|متوسط|منخفض",
      "volume_num": 1000,
      "competition": "low|medium|high",
      "cpc_estimate": "منخفض|متوسط|عالي",
      "intent": "شرائية|معلوماتية|مقارنة|محلية",
      "is_longtail": true,
      "difficulty": 45,
      "opportunity": "ملاحظة عن فرصة هذه الكلمة"
    }
  ],
  "summary": {
    "total": ${count},
    "low_comp": 0,
    "medium_comp": 0,
    "high_comp": 0,
    "longtail_count": 0,
    "best_opportunity": "أفضل كلمة مفتاحية للبدء بها"
  },
  "content_ideas": [
    {"type": "مقال", "title": "عنوان مقترح"},
    {"type": "صفحة منتج", "title": "عنوان مقترح"},
    {"type": "صفحة تصنيف", "title": "عنوان مقترح"},
    {"type": "FAQ", "title": "عنوان مقترح"},
    {"type": "مقارنة", "title": "عنوان مقترح"}
  ]
}

مهم جداً: اجعل الكلمات المفتاحية واقعية وتعكس ما يبحث عنه الناس في ${country}. تضمين كلمات بالعامية المحلية وأسئلة شائعة وكلمات طويلة (long-tail).`;

  const res = await callAI(prompt, 3000);

  document.getElementById('kwp-loader').style.display = 'none';
  document.getElementById('kwp-loader-text').style.display = 'none';

  if (!res) return;

  try {
    const clean = res.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    kwData = data.keywords || [];
    renderKwPlanner(data, seed, country);
  } catch(e) {
    toast('خطأ في تحليل النتائج، جرب مرة أخرى', 'var(--red)');
  }
}

function renderKwPlanner(data, seed, country) {
  const { keywords, summary, content_ideas } = data;
  if (!keywords || !keywords.length) { toast('لا توجد نتائج', 'var(--yellow)'); return; }

  // Stats
  document.getElementById('kwp-stats-content').innerHTML = `
    <div class="grid5" style="margin-bottom:0">
      <div class="stat-card"><div class="stat-num">${keywords.length}</div><div class="stat-lbl">كلمة مفتاحية</div></div>
      <div class="stat-card s-green"><div class="stat-num">${summary?.low_comp || keywords.filter(k=>k.competition==='low').length}</div><div class="stat-lbl">منافسة منخفضة</div></div>
      <div class="stat-card s-yellow"><div class="stat-num">${summary?.medium_comp || keywords.filter(k=>k.competition==='medium').length}</div><div class="stat-lbl">منافسة متوسطة</div></div>
      <div class="stat-card s-red"><div class="stat-num">${summary?.high_comp || keywords.filter(k=>k.competition==='high').length}</div><div class="stat-lbl">منافسة عالية</div></div>
      <div class="stat-card s-purple"><div class="stat-num">${summary?.longtail_count || keywords.filter(k=>k.is_longtail).length}</div><div class="stat-lbl">Long-tail</div></div>
    </div>
    ${summary?.best_opportunity ? `<div style="margin-top:12px;background:rgba(16,212,144,.06);border:1px solid rgba(16,212,144,.2);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--green)">⭐ أفضل فرصة للبدء: <strong>${summary.best_opportunity}</strong></div>` : ''}`;

  // Table
  renderKwTable(keywords);

  // Content ideas
  if (content_ideas && content_ideas.length) {
    document.getElementById('kwp-ideas').innerHTML = content_ideas.map(idea => `
      <div class="kw-idea-item">
        <div class="kw-idea-type">${idea.type}</div>
        <div class="kw-idea-title">${idea.title}</div>
      </div>`).join('');
  }

  document.getElementById('kwp-out').style.display = 'block';
  document.getElementById('kwp-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(`✓ تم العثور على ${keywords.length} كلمة مفتاحية`);
}

function renderKwTable(keywords) {
  const maxVol = Math.max(...keywords.map(k => k.volume_num || 0), 1);
  document.getElementById('kwp-table-wrap').innerHTML = `
    <div style="overflow-x:auto">
    <table class="kw-table">
      <thead>
        <tr>
          <th>#</th>
          <th>الكلمة المفتاحية</th>
          <th>حجم البحث</th>
          <th>المنافسة</th>
          <th>صعوبة SEO</th>
          <th>النية</th>
          <th>CPC</th>
          <th>ملاحظة</th>
        </tr>
      </thead>
      <tbody>
        ${keywords.map((kw, i) => {
          const compClass = kw.competition === 'low' ? 'comp-low' : kw.competition === 'medium' ? 'comp-medium' : 'comp-high';
          const compLabel = kw.competition === 'low' ? '🟢 منخفضة' : kw.competition === 'medium' ? '🟡 متوسطة' : '🔴 عالية';
          const volPct = Math.round(((kw.volume_num || 0) / maxVol) * 100);
          const diffColor = (kw.difficulty||50) < 40 ? 'var(--green)' : (kw.difficulty||50) < 65 ? 'var(--yellow)' : 'var(--red)';
          const isLongTail = kw.is_longtail;
          const compFilter = kw.competition;
          return `
          <tr data-comp="${compFilter}" data-longtail="${isLongTail}">
            <td style="color:var(--muted);font-size:11px">${i+1}</td>
            <td>
              <span style="font-weight:700;color:var(--text)">${kw.keyword}</span>
              ${isLongTail ? '<span class="kw-longtail-tag">Long-tail</span>' : ''}
            </td>
            <td>
              <div class="vol-bar-wrap">
                <div class="vol-bar-bg"><div class="vol-bar-fill" style="width:${volPct}%"></div></div>
                <span style="font-size:11px;color:var(--muted2);white-space:nowrap">${kw.volume || '—'}</span>
              </div>
            </td>
            <td><span class="comp-badge ${compClass}">${compLabel}</span></td>
            <td><span style="font-weight:700;color:${diffColor}">${kw.difficulty || '—'}/100</span></td>
            <td style="font-size:11px;color:var(--muted2)">${kw.intent || '—'}</td>
            <td style="font-size:11px;color:var(--muted2)">${kw.cpc_estimate || '—'}</td>
            <td style="font-size:11px;color:var(--muted2);max-width:150px">${kw.opportunity || ''}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>`;
}

function filterKw(type, el) {
  document.querySelectorAll('#kwp-filter-btns .seg-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const rows = document.querySelectorAll('.kw-table tbody tr');
  rows.forEach(row => {
    if (type === 'all') { row.classList.remove('hidden-kw'); return; }
    if (type === 'longtail') {
      row.classList.toggle('hidden-kw', row.dataset.longtail !== 'true');
    } else {
      row.classList.toggle('hidden-kw', row.dataset.comp !== type);
    }
  });
}

function copyKwTable() {
  const headers = ['الكلمة المفتاحية', 'حجم البحث', 'المنافسة', 'صعوبة SEO', 'النية', 'CPC'];
  const rows = kwData.map(kw => [
    kw.keyword, kw.volume || '—',
    kw.competition === 'low' ? 'منخفضة' : kw.competition === 'medium' ? 'متوسطة' : 'عالية',
    (kw.difficulty || '—') + '/100', kw.intent || '—', kw.cpc_estimate || '—'
  ]);
  const text = [headers, ...rows].map(r => r.join('\t')).join('\n');
  navigator.clipboard.writeText(text).then(() => toast('تم نسخ الجدول ✓'));
}

function exportKwCSV() {
  const headers = ['الكلمة المفتاحية', 'حجم البحث', 'المنافسة', 'صعوبة SEO', 'النية', 'CPC', 'Long-tail'];
  const rows = kwData.map(kw => [
    '"' + kw.keyword + '"', kw.volume || '—',
    kw.competition === 'low' ? 'منخفضة' : kw.competition === 'medium' ? 'متوسطة' : 'عالية',
    (kw.difficulty || '—') + '/100', kw.intent || '—', kw.cpc_estimate || '—',
    kw.is_longtail ? 'نعم' : 'لا'
  ]);
const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

const a = document.createElement('a');
a.href = URL.createObjectURL(blob);

// 👇 هنا التعديل
let seed = document.getElementById('kwp-seed').value.trim();

// fallback لو فاضي
if (!seed) seed = 'keywords';

// تنظيف الاسم من الرموز الممنوعة
seed = seed.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');

a.download = seed + '.csv';

document.body.appendChild(a); // مهم لبعض المتصفحات
a.click();
document.body.removeChild(a);

toast('تم تصدير CSV ✓');
}

function clearKwPlanner() {
  document.getElementById('kwp-seed').value = '';
  document.getElementById('kwp-out').style.display = 'none';
  kwData = [];
}

let aiHistory = [];
let aiOpen = false;

function toggleAI() {
  aiOpen = !aiOpen;

  const panel = document.getElementById('ai-panel');
  const btn = document.getElementById('ai-float-btn');

  panel.classList.toggle('open', aiOpen);
  btn.classList.toggle('open-state', aiOpen);

  if (aiOpen) {
    setTimeout(() => document.getElementById('ai-input').focus(), 300);
  }
}

function aiQuick(msg) {
  document.getElementById('ai-input').value = msg;
  sendAIMessage();
  document.getElementById('ai-quick-btns').style.display = 'none';
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  input.style.height = 'auto';

  const msgs = document.getElementById('ai-messages');

  // Add user message
  msgs.innerHTML += `<div class="ai-msg user">${msg.replace(/</g,'&lt;')}</div>`;
  
  // Add thinking
  const thinkId = 'think-' + Date.now();
  msgs.innerHTML += `<div class="ai-msg thinking" id="${thinkId}">⏳ جاري التفكير...</div>`;
  msgs.scrollTop = msgs.scrollHeight;

  // Build history
  aiHistory.push({ role: 'user', content: msg });

  const model = (document.getElementById('model-id')?.value || '').trim() || 'inclusionai/ling-2.6-flash:free';
  const systemPrompt = `أنت مساعد خبير في تحسين محركات البحث (SEO) والتجارة الإلكترونية. تتحدث بالعربية الفصحى البسيطة. تُقدم إجابات عملية ومفيدة ومختصرة. تُركز على الحلول العملية والخطوات الواضحة. خبرتك تشمل: SEO تقني، كتابة المحتوى، سرعة الموقع، Core Web Vitals، منصات سلة وزد وشوبيفاي، والتسويق الرقمي.`;

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...aiHistory.slice(-8)
        ],
        max_tokens: 800
      })
    });
    
    document.getElementById(thinkId)?.remove();
    
    if (res.ok) {
      const d = await res.json();
      const reply = d.choices?.[0]?.message?.content || 'عذراً، لم أتمكن من الإجابة.';
      aiHistory.push({ role: 'assistant', content: reply });
      const formatted = reply.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/^- /gm,'• ');
      msgs.innerHTML += `<div class="ai-msg bot">${formatted}</div>`;
    } else {
      msgs.innerHTML += `<div class="ai-msg bot">⚠️ خطأ في الاتصال بالخادم.</div>`;
    }
  } catch(e) {
    document.getElementById(thinkId)?.remove();
    msgs.innerHTML += `<div class="ai-msg bot">⚠️ تعذّر الاتصال بالمساعد الذكي.</div>`;
  }
  
  msgs.scrollTop = msgs.scrollHeight;
}


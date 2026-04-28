# SEO Pro Tool v6 — نشر على Vercel

## 📁 هيكل المجلدات

```
seo-tool-vercel/
├── api/
│   ├── ai.js           ← Proxy للـ OpenRouter (المفتاح مخفي)
│   └── pagespeed.js    ← Proxy للـ PageSpeed (المفتاح مخفي)
├── public/
│   ├── index.html      ← الأداة الرئيسية
│   ├── main.js         ← كود JavaScript
│   └── style.css       ← التصميم
├── vercel.json         ← إعدادات Vercel
└── package.json
```

---

## 🚀 خطوات النشر على Vercel (مجاني)

### الخطوة 1 — إنشاء حساب Vercel
- اذهب إلى https://vercel.com
- سجّل بحساب GitHub أو Google أو Email

### الخطوة 2 — رفع المشروع

**الطريقة السهلة (Drag & Drop):**
1. اضغط "Add New Project"ش
2. اختر "Import from Git" أو "Browse"
3. ارفع مجلد `seo-tool-vercel` كاملاً

**أو عبر GitHub:**
1. ارفع المجلد لـ GitHub repo
2. في Vercel اختر "Import Git Repository"
3. اختر الـ repo وانشر

### الخطوة 3 — إضافة Environment Variables (⚠️ مهم جداً)
بعد رفع المشروع، اذهب إلى:
**Project Settings → Environment Variables** وأضف:

| Name | Value |
|------|-------|
| `OPENROUTER_API_KEY` | مفتاح OpenRouter بتاعك (sk-or-v1-...) |
| `PAGESPEED_API_KEY` | مفتاح Google PageSpeed بتاعك (AIzaSy...) |
| `SITE_URL` | رابط موقعك على Vercel (مثل https://seo-tool.vercel.app) |

### الخطوة 4 — Redeploy
بعد إضافة المتغيرات، اضغط "Redeploy" من Vercel Dashboard.

---

## 🔑 من فين تجيب المفاتيح؟

- **OpenRouter Key (مجاني):** https://openrouter.ai/keys
- **PageSpeed Key (مجاني):** https://developers.google.com/speed/docs/insights/v5/get-started

---

## ✅ النتيجة
- المستخدم يفتح الأداة مباشرة بدون أي إعداد
- المفاتيح مخفية تماماً على سيرفر Vercel
- لا يظهر أي مفتاح في كود الـ Frontend

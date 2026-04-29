# SEO Pro Tool v6 — نشر على Vercel

---

## 📁 هيكل المجلدات

```
seo-tool-vercel/
├── api/
│   ├── ai.js           ← Proxy للـ OpenRouter + Fallback تلقائي بين الموديلات
│   └── pagespeed.js    ← Proxy للـ PageSpeed (المفتاح مخفي)
├── public/
│   ├── index.html      ← الأداة الرئيسية
│   ├── main.js         ← كود JavaScript
│   └── style.css       ← التصميم
├── vercel.json         ← إعدادات Vercel
├── package.json
└── README.md
```

---

## 🤖 نظام الموديلات مع Fallback التلقائي

الأداة دلوقتي بتستخدم نظام ذكي — لو أي موديل فشل أو وصل لـ rate limit، السيرفر ينتقل للتالي **تلقائياً** بدون أي تدخل.

### الموديلات المستخدمة (بالترتيب):

| الأولوية | الموديل | الملاحظة |
|----------|---------|----------|
| 1 | `google/gemini-2.0-flash-exp:free` | الأسرع والأقوى — الأول دايماً |
| 2 | `google/gemini-flash-1.5-8b:free` | بديل Gemini |
| 3 | `meta-llama/llama-3.1-8b-instruct:free` | بديل Meta |
| 4 | `mistralai/mistral-7b-instruct:free` | الاحتياطي الأخير |

> كل الموديلات **مجانية** على OpenRouter.

### ✏️ كيف تعدّل الموديلات؟

افتح **`api/ai.js`** فقط وعدّل في هذا الجزء:

```js
const FALLBACK_MODELS = [
  'google/gemini-2.0-flash-exp:free',   // الأول
  'google/gemini-flash-1.5-8b:free',    // الثاني
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free', // الأخير
];
```

مش محتاج تلمس أي ملف تاني.

---

## 🚀 خطوات النشر على Vercel (مجاني)

### الخطوة 1 — إنشاء حساب Vercel
اذهب إلى [vercel.com](https://vercel.com) وسجّل بحساب GitHub أو Google أو Email.

### الخطوة 2 — رفع المشروع

**الطريقة السهلة — Drag & Drop:**
1. اضغط **"Add New Project"**
2. اختر **"Browse"**
3. ارفع مجلد `seo-tool-vercel` كاملاً

**أو عبر GitHub:**
1. ارفع المجلد لـ GitHub repo
2. في Vercel اختر **"Import Git Repository"**
3. اختر الـ repo واضغط Deploy

### الخطوة 3 — إضافة Environment Variables ⚠️

بعد رفع المشروع، اذهب إلى:
**Project Settings → Environment Variables** وأضف المتغيرات التالية:

| الاسم | القيمة |
|-------|--------|
| `OPENROUTER_API_KEY` | مفتاح OpenRouter (يبدأ بـ `sk-or-v1-...`) |
| `PAGESPEED_API_KEY` | مفتاح Google PageSpeed (يبدأ بـ `AIzaSy...`) |
| `SITE_URL` | رابط موقعك على Vercel مثل `https://seo-tool.vercel.app` |

### الخطوة 4 — Redeploy
بعد إضافة المتغيرات، اضغط **"Redeploy"** من Vercel Dashboard حتى تأخذ المتغيرات مفعولها.

---

## 🔑 من فين تجيب المفاتيح؟

| المفتاح | الرابط | التكلفة |
|---------|--------|---------|
| OpenRouter Key | [openrouter.ai/keys](https://openrouter.ai/keys) | مجاني |
| PageSpeed Key | [developers.google.com/speed/docs/insights/v5/get-started](https://developers.google.com/speed/docs/insights/v5/get-started) | مجاني |

---

## 🛡️ الأمان

- ✅ المفاتيح محفوظة فقط في بيئة Vercel — لا تظهر أبداً في الـ Frontend
- ✅ الـ Frontend لا يعرف أي موديل يشتغل — السيرفر هو اللي يتحكم
- ✅ كل طلب يمر عبر Serverless Function محمية

---

## ✅ النتيجة

- المستخدم يفتح الأداة مباشرة بدون أي إعداد
- لو موديل وقف أو اتعطّل، التالي يشتغل فوراً تلقائياً
- تعديل الموديلات من ملف واحد فقط (`api/ai.js`)

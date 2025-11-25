# 🚀 ProductPraat MVP Backend - Quick Start Guide

**Status**: ✅ Backend is gebouwd en draait op poort 3000!

## 🎯 Wat werkt NU al?

✅ **Backend service draait** op http://localhost:3000
✅ **Health check endpoint**: `/api/health`
✅ **API Documentatie**: http://localhost:3000/api-docs
✅ **Bol.com API integratie** (credentials geconfigureerd)
✅ **AI Review service** (AIML API geconfigureerd)

## ⚠️ Wat moet NOG geconfigureerd worden?

🟡 **Supabase Database** - Volg de stappen hieronder

---

## Stap 1: Test de Service (5 minuten)

### A. Health Check

```bash
curl http://localhost:3000/api/health
```

**Expected output:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T...",
  "service": "ProductPraat MVP Backend",
  "version": "1.0.0"
}
```

### B. Open API Documentatie

Open in je browser: http://localhost:3000/api-docs

Hier zie je:
- 📦 **products**: Product import en management
- ❤️ **health**: Health check

---

## Stap 2: Configureer Supabase (10 minuten)

### 2.1 Maak een Supabase Account

1. Ga naar https://supabase.com
2. Klik **Start your project** → Sign up (gratis!)
3. Maak een nieuwe project aan:
   - **Name**: productpraat-mvp
   - **Database Password**: Kies een sterk wachtwoord
   - **Region**: West EU (Netherlands)
   - **Pricing**: Free

### 2.2 Haal API Credentials op

1. In je Supabase dashboard: klik **⚙️ Settings** (linker sidebar)
2. Ga naar **API**
3. Kopieer:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2.3 Maak de Database Tabel

1. In Supabase: klik **🔨 SQL Editor** (linker sidebar)
2. Klik **+ New query**
3. Plak en voer uit:

```sql
-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  category TEXT,
  image_url TEXT,
  affiliate_url TEXT,
  ai_review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes voor snelheid
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Row Level Security uit voor MVP
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

### 2.4 Update Environment Variables

```bash
cd /home/ubuntu/productpraat_mvp_backend/nodejs_space
nano .env
```

Voeg toe (vul jouw credentials in):

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Sla op: `Ctrl+X` → `Y` → `Enter`

### 2.5 Herstart de Service

```bash
# Stop de huidige service
pkill -f "node.*start:dev"

# Start opnieuw
cd /home/ubuntu/productpraat_mvp_backend/nodejs_space
yarn start:dev
```

Als het goed is zie je:
```
✅ Supabase client geïnitialiseerd
✅ Products tabel bestaat
🚀 ProductPraat MVP Backend draait op poort 3000
```

---

## Stap 3: Test Product Import (VANDAAG gebruiken!)

### A. Importeer je eerste producten

```bash
curl -X POST http://localhost:3000/api/products/import \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["elektronica"],
    "limit": 3
  }'
```

**Wat gebeurt er?**
1. 🔍 Backend zoekt top 3 producten op Bol.com in categorie "elektronica"
2. 🤖 AI genereert automatisch een review voor elk product
3. 💾 Product wordt opgeslagen in Supabase
4. 🔗 Affiliate link wordt toegevoegd

**Verwachte output:**
```json
{
  "success": true,
  "imported": 3,
  "categories": 1
}
```

Dit duurt ~30 seconden (AI generatie + rate limiting)

### B. Bekijk geïmporteerde producten

```bash
curl http://localhost:3000/api/products
```

**Je ziet:**
```json
{
  "products": [
    {
      "id": "1234567890123",
      "title": "Samsung Galaxy Laptop...",
      "price": 899.99,
      "category": "elektronica",
      "image_url": "https://i.ytimg.com/vi/IkJP8K--J5E/maxresdefault.jpg",
      "affiliate_url": "https://partner.bol.com/...",
      "ai_review": "Deze Samsung laptop biedt uitstekende..."
    }
  ]
}
```

### C. Haal producten per categorie op

```bash
curl http://localhost:3000/api/products/category/elektronica
```

### D. Haal één product op

```bash
curl http://localhost:3000/api/products/1234567890123
```

---

## Stap 4: Importeer meer producten (Batch)

### Meerdere categorieën tegelijk:

```bash
curl -X POST http://localhost:3000/api/products/import \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["elektronica", "wonen", "sport"],
    "limit": 5
  }'
```

Dit importeert:
- 5 elektronica producten (laptops, notebooks)
- 5 wonen producten (stofzuigers, wasmachines)
- 5 sport producten (sporthorloges, fitness trackers)

**= 15 producten met AI reviews in één keer!**

---

## 📡 Gebruik met Postman

### 1. Import in Postman

1. Open Postman
2. Ga naar: http://localhost:3000/api-docs
3. Klik rechtsboven op **"Get Postman Collection"** (als beschikbaar)

Of maak handmatig:

### 2. Health Check Request

- **Method**: GET
- **URL**: `http://localhost:3000/api/health`

### 3. Import Products Request

- **Method**: POST
- **URL**: `http://localhost:3000/api/products/import`
- **Headers**: `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "categories": ["elektronica"],
  "limit": 3
}
```

### 4. Get All Products Request

- **Method**: GET
- **URL**: `http://localhost:3000/api/products`

---

## 🛠️ Troubleshooting

### ❌ "Supabase credentials niet gevonden"

**Probleem**: .env bestand niet correct

**Oplossing**:
```bash
cd /home/ubuntu/productpraat_mvp_backend/nodejs_space
cat .env  # Check of SUPABASE_URL en SUPABASE_ANON_KEY erin staan
```

### ❌ "Products tabel bestaat niet"

**Probleem**: SQL script niet uitgevoerd in Supabase

**Oplossing**: Ga naar Supabase SQL Editor en voer het CREATE TABLE script uit (zie Stap 2.3)

### ❌ "Geen producten gevonden op Bol.com"

**Mogelijke oorzaken**:
1. Bol.com API is down (tijdelijk)
2. Zoekterm vindt niets (probeer andere categorie)
3. Rate limiting (wacht 1 minuut)

**Check logs**:
```bash
# Logs bekijken
tail -f /tmp/productpraat-backend.log
```

### ❌ "AI review generatie mislukt"

**Probleem**: AIML API limiet bereikt of down

**Oplossing**: Wacht even en probeer opnieuw. AI calls hebben 2 seconden rate limiting.

### 🔁 Service herstarten

```bash
# Stop alle draaiende instances
pkill -f "node.*start:dev"

# Start opnieuw
cd /home/ubuntu/productpraat_mvp_backend/nodejs_space
yarn start:dev
```

---

## 📁 Project Structuur

```
productpraat_mvp_backend/
├── nodejs_space/
│   ├── src/
│   │   ├── main.ts              # Entry point
│   │   ├── app.module.ts        # Root module
│   │   ├── products/            # Product endpoints
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   └── dto/
│   │   ├── bol/                 # Bol.com API client
│   │   │   └── bol.service.ts
│   │   ├── ai-review/           # AI review generator
│   │   │   └── ai-review.service.ts
│   │   ├── supabase/            # Database client
│   │   │   └── supabase.service.ts
│   │   └── health/              # Health check
│   └── .env                 # Environment variables
├── QUICK_START.md           # Dit bestand
├── SUPABASE_SETUP.md        # Gedetailleerde Supabase instructies
└── TEST_ENDPOINTS.sh        # Test script
```

---

## 🎯 MVP Features Checklist

✅ Product import van Bol.com
✅ AI review generatie
✅ Supabase database integratie
✅ GET /api/products - Alle producten
✅ GET /api/products/category/:cat - Per categorie
✅ GET /api/products/:id - Enkel product
✅ POST /api/products/import - Batch import
✅ Health check endpoint
✅ Swagger API documentatie
✅ Logging & error handling

---

## 🚀 Volgende Stappen (Niet in MVP)

🟡 Automatische scheduling (cron jobs)
🟡 Koopgidsen generatie
🟡 Product vergelijkingen
🟡 SEO optimalisatie
🟡 Admin authenticatie

---

## 📞 Support

Voor vragen:
1. Check de logs in de console
2. Bekijk API docs: http://localhost:3000/api-docs
3. Lees SUPABASE_SETUP.md voor database problemen

---

**✨ Veel succes met ProductPraat.nl!**
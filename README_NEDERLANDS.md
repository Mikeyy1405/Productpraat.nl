# ProductPraat.nl - Complete Backend + Admin System

🎉 **Volledige backend API met admin authenticatie, automatische content generatie en product management!**

## 📚 Inhoudsopgave

1. [Wat is er gebouwd?](#wat-is-er-gebouwd)
2. [Features](#features)
3. [Quick Start](#quick-start)
4. [API Endpoints](#api-endpoints)
5. [Admin Login](#admin-login)
6. [Database Setup](#database-setup)
7. [Environment Variables](#environment-variables)
8. [Deployment](#deployment)

---

## 🚀 Wat is er gebouwd?

Een complete backend systeem voor ProductPraat.nl met:

- **Admin Authenticatie** - Login systeem voor beheerders
- **Product Management** - Bol.com import + CRUD operaties
- **AI Content Generatie** - Automatische reviews, koopgidsen, vergelijkingen
- **Articles System** - Koopgidsen en informatieve artikelen
- **REST API** - Voor integratie met frontend
- **Swagger Documentatie** - Interactieve API docs

---

## ✨ Features

### 🔐 Admin Panel
- Login systeem (email + wachtwoord)
- Beschermde admin endpoints
- Logout functionaliteit

### 📦 Product Management
- **Import van Bol.com**: Automatisch top producten ophalen
- **AI Reviews**: Elke product krijgt automatisch een review
- **CRUD Operaties**: Create, Read, Update, Delete producten
- **Categorie filtering**: Producten per categorie ophalen

### 📝 Content Generatie
- **Koopgidsen**: "Beste Laptops 2024", "Wasmachine Koopgids", etc.
- **Vergelijkingen**: "iPhone vs Samsung", "Dyson vs Philips", etc.
- **Informatieve Artikelen**: "Wasmachine schoonmaken", "Laptop onderhoud"
- **AI-powered**: Automatisch SEO-geoptimaliseerde content

### 🗄️ Database
- Supabase integratie
- Products tabel voor alle producten
- Articles tabel voor gidsen/artikelen
- Automatische timestamps

---

## 🛠️ Quick Start

### 1. Installeer Dependencies

```bash
cd backend
yarn install
```

### 2. Configureer Environment

```bash
cp .env.example .env
```

Vul `.env` in met jouw credentials (zie [Environment Variables](#environment-variables))

### 3. Setup Database

Voer de SQL queries uit in Supabase (zie `SUPABASE_SETUP.md`):

```sql
-- Products tabel
CREATE TABLE products (
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

-- Articles tabel  
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  content TEXT,
  seo_title TEXT,
  seo_description TEXT,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Start de Server

**Development:**
```bash
cd backend
yarn start:dev
```

**Production:**
```bash
yarn build
yarn start:prod
```

Server draait op: **http://localhost:3000**

### 5. Test de API

**Swagger Docs:**
```
http://localhost:3000/api-docs
```

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Login (Admin):**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"info@writgo.nl", "password":"Productpraat2025!"}'
```

---

## 🔌 API Endpoints

### 👤 Auth Endpoints

| Method | Endpoint | Beschrijving | Auth |
|--------|----------|--------------|------|
| POST | `/api/auth/login` | Admin login | ❌ |
| POST | `/api/auth/logout` | Admin logout | ✅ |

### 📦 Product Endpoints

| Method | Endpoint | Beschrijving | Auth |
|--------|----------|--------------|------|
| GET | `/api/products` | Alle producten | ❌ |
| GET | `/api/products/:id` | Eén product | ❌ |
| GET | `/api/products/category/:cat` | Producten per categorie | ❌ |
| POST | `/api/products/import` | Import van Bol.com | ✅ |
| POST | `/api/products` | Nieuw product | ✅ |
| PUT | `/api/products/:id` | Update product | ✅ |
| DELETE | `/api/products/:id` | Verwijder product | ✅ |

### 📝 Article Endpoints

| Method | Endpoint | Beschrijving | Auth |
|--------|----------|--------------|------|
| GET | `/api/articles` | Alle artikelen | ❌ |
| GET | `/api/articles?type=guide` | Alleen koopgidsen | ❌ |
| GET | `/api/articles/:id` | Eén artikel | ❌ |
| POST | `/api/articles` | Nieuw artikel (handmatig) | ✅ |
| POST | `/api/articles/generate` | Genereer artikel met AI | ✅ |
| DELETE | `/api/articles/:id` | Verwijder artikel | ✅ |

### ❤️ Health

| Method | Endpoint | Beschrijving |
|--------|----------|---------------|
| GET | `/health` | Server status |

---

## 🔐 Admin Login

**Credentials:**
```
Email: info@writgo.nl
Wachtwoord: Productpraat2025!
```

**Login Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "info@writgo.nl",
    "password": "Productpraat2025!"
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "email": "info@writgo.nl",
    "role": "admin"
  },
  "token": "aW5mb0B3cml0Z28ubmw6MTczMjUzMzYwMA=="
}
```

🚨 **Belangrijk**: In productie moet je het token gebruiken voor auth. Voor nu is het een basis implementatie.

---

## 🐝 Voorbeeld: Content Genereren

### 1. Importeer Producten van Bol.com

```bash
curl -X POST http://localhost:3000/api/products/import \
  -H "Content-Type: application/json" \
  -d '{
    "categories": ["elektronica", "wonen"],
    "limit": 5
  }'
```

**Dit doet:**
- Haalt top 5 producten op per categorie
- Genereert automatisch AI review voor elk product
- Slaat op in Supabase

### 2. Genereer een Koopgids

```bash
curl -X POST http://localhost:3000/api/articles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "guide",
    "topic": "Beste Laptops van 2024",
    "category": "elektronica"
  }'
```

**Dit genereert:**
- Complete koopgids met AI
- SEO-geoptimaliseerde content
- Automatische slug generatie

### 3. Bekijk alle artikelen

```bash
curl http://localhost:3000/api/articles?type=guide
```

---

## 🗄️ Database Setup

Zie `SUPABASE_SETUP.md` voor complete database setup instructies.

**Snel overzicht:**

1. Maak Supabase project aan op [supabase.com](https://supabase.com)
2. Ga naar SQL Editor
3. Voer de queries uit uit `SUPABASE_SETUP.md`
4. Kopieer je Supabase URL en KEY naar `.env`

---

## 🔑 Environment Variables

```env
# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Bol.com API (credentials komen uit secrets file)
# BOL_CLIENT_ID wordt automatisch geladen
# BOL_CLIENT_SECRET wordt automatisch geladen
BOL_SITE_ID=1296565

# AI Service (AIML API)
# AIML_API_KEY wordt automatisch geladen

# Server
PORT=3000
NODE_ENV=development
```

**🚨 Belangrijk**: BOL_CLIENT_ID, BOL_CLIENT_SECRET en AIML_API_KEY worden automatisch geladen uit de secrets file. Je hoeft ze NIET in .env te zetten.

---

## 🚀 Deployment

Zie `DEPLOYMENT_INFO.md` voor complete deployment instructies.

**Voor Render.com:**
1. Push code naar GitHub
2. Connect Render.com met je repo
3. Set environment variables
4. Deploy!

---

## 📝 API Documentatie

Bezoek `/api-docs` voor interactieve Swagger documentatie:

```
http://localhost:3000/api-docs
```

Hier kun je:
- Alle endpoints zien
- Direct API calls testen
- Request/response voorbeelden bekijken

---

## 🐛 Testing

**Gebruik het test script:**
```bash
chmod +x TEST_ENDPOINTS.sh
./TEST_ENDPOINTS.sh
```

Of test handmatig met curl (zie voorbeelden hierboven).

---

## 📚 Volgende Stappen

### MVP Voltooid ✅
- [x] Admin authenticatie
- [x] Product import van Bol.com
- [x] AI review generatie
- [x] Article management
- [x] REST API endpoints
- [x] Swagger documentatie

### Roadmap 📋
- [ ] Frontend integratie (React app)
- [ ] Scheduled tasks (dagelijkse imports)
- [ ] JWT token authenticatie
- [ ] User reviews systeem
- [ ] SEO optimalisatie
- [ ] Image optimization
- [ ] Caching layer
- [ ] Rate limiting
- [ ] Analytics dashboard

---

## ❓ Veelgestelde Vragen

**Q: Hoe verander ik de admin credentials?**
A: Edit `src/auth/auth.service.ts` en verander `ADMIN_EMAIL` en `ADMIN_PASSWORD`.

**Q: Kan ik meerdere admins hebben?**
A: In de huidige MVP niet, maar dit kan makkelijk uitgebreid worden met een users tabel.

**Q: Hoe vaak worden producten geïmporteerd?**
A: In de MVP handmatig via `/api/products/import`. Scheduled tasks komen in de volgende versie.

**Q: Kan ik eigen artikelen schrijven?**
A: Ja! Gebruik `POST /api/articles` om handmatig artikelen toe te voegen zonder AI.

**Q: Wat als de AI API limit bereikt is?**
A: De service geeft dan fallback content terug. Check de logs voor details.

---

## 📞 Support

Voor vragen of problemen:
1. Check de logs: `tail -f .logs/dev.log`
2. Bekijk `DEPLOYMENT_INFO.md` voor troubleshooting
3. Open een GitHub issue

---

## 🎉 Succes!

Je backend API is nu klaar voor gebruik! Start met het testen van de endpoints via Swagger of curl.

**Happy coding! 🚀**

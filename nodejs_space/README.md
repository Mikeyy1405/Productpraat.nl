# ProductPraat MVP Backend

🚀 **Backend service voor ProductPraat.nl** - Product import en AI review generatie

## 🎯 Features (MVP)

✅ **Product Import**: Haal automatisch top producten op van Bol.com API
✅ **AI Review Generatie**: Genereer automatisch productreviews met AI
✅ **Product API**: CRUD endpoints voor product management
✅ **Supabase Integratie**: Persistente opslag van producten
✅ **Health Check**: Monitor service status
✅ **Swagger Documentation**: Interactive API docs op `/api-docs`

## 📋 Vereisten

- Node.js 18+
- Supabase account (gratis tier is genoeg)
- Bol.com API credentials (al geconfigureerd)
- AIML/OpenAI API key (al geconfigureerd)

## 🚀 Quick Start

### 1. Installeer dependencies

```bash
cd /home/ubuntu/productpraat_mvp_backend/nodejs_space
yarn install
```

### 2. Configureer environment variables

Maak een `.env` file aan (zie `.env.example`):

```bash
cp .env.example .env
```

Vul in:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 3. Maak de database tabel aan

Ga naar je Supabase project → SQL Editor en voer uit:

```sql
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
```

### 4. Start de development server

```bash
yarn start:dev
```

De service draait nu op: http://localhost:3000

## 📚 API Endpoints

### Health Check
```
GET /health
```

### Product Import
```
POST /api/products/import
Body: {
  "categories": ["elektronica", "wonen", "sport"],
  "limit": 5
}
```

### Alle Producten
```
GET /api/products
```

### Producten per Categorie
```
GET /api/products/category/elektronica
```

### Enkel Product
```
GET /api/products/:id
```

## 🧪 Testen

### Met curl

```bash
# Health check
curl http://localhost:3000/health

# Import producten
curl -X POST http://localhost:3000/api/products/import \
  -H "Content-Type: application/json" \
  -d '{"categories": ["elektronica"], "limit": 3}'

# Haal producten op
curl http://localhost:3000/api/products
```

### Met Swagger UI

Open in je browser: http://localhost:3000/api-docs

## 🔧 Development

```bash
# Development mode (hot reload)
yarn start:dev

# Production build
yarn build

# Production mode
yarn start:prod

# Linting
yarn lint
```

## 📦 Deployment

1. Zorg dat alle environment variables zijn ingesteld
2. Service draait automatisch op poort 3000
3. Health check: `/health`
4. API docs: `/api-docs`

## 🔐 Security

- Bol.com en AIML credentials worden automatisch geladen uit `/home/ubuntu/.config/abacusai_auth_secrets.json`
- Supabase credentials via environment variables
- Geen gevoelige data in code of Git

## 📝 Database Schema

```sql
products (
  id TEXT PRIMARY KEY,          -- EAN code van Bol.com
  title TEXT NOT NULL,          -- Product titel
  description TEXT,             -- Korte beschrijving
  price NUMERIC,                -- Prijs in euro's
  category TEXT,                -- Categorie (elektronica, wonen, sport)
  image_url TEXT,               -- Product afbeelding
  affiliate_url TEXT,           -- Bol.com affiliate link
  ai_review TEXT,               -- AI gegenereerde review
  created_at TIMESTAMPTZ        -- Aanmaakdatum
)
```

## ⚙️ Configuratie

### Beschikbare categorieën
- `elektronica` - Laptops, notebooks
- `wonen` - Stofzuigers, wasmachines
- `sport` - Sporthorloges, fitness trackers

### Rate Limiting
- AI calls: 2 seconden tussen requests (om kosten te beperken)
- Bol.com API: Automatische token refresh

## 🐛 Troubleshooting

### "Supabase credentials niet gevonden"
→ Check of `SUPABASE_URL` en `SUPABASE_ANON_KEY` in `.env` staan

### "Products tabel bestaat niet"
→ Voer het SQL script uit in Supabase (zie Quick Start stap 3)

### "Geen producten gevonden op Bol.com"
→ Controleer of de Bol.com credentials geldig zijn
→ Check de logs voor details

## 📊 Logs

Alle belangrijke events worden gelogd:
- ✅ Successen
- ⚠️ Waarschuwingen  
- ❌ Errors
- 🔍 Info

## 🎯 Roadmap (Niet in MVP)

- [ ] Automatische scheduling (cron jobs)
- [ ] Koopgidsen generatie
- [ ] Product vergelijkingen
- [ ] SEO optimalisatie
- [ ] Admin authenticatie
- [ ] Rate limiting op API endpoints

## 📞 Support

Voor vragen of problemen, check de logs of bekijk de Swagger docs op `/api-docs`.

---

**Built with ❤️ for ProductPraat.nl**
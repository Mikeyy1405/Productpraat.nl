# 🗄️ Supabase Setup voor ProductPraat MVP

## Stap 1: Maak een Supabase Project aan

1. Ga naar https://supabase.com
2. Klik op "Start your project"
3. Maak een account aan (gratis tier is voldoende)
4. Klik op "New Project"
5. Vul in:
   - **Name**: productpraat-mvp
   - **Database Password**: Kies een sterk wachtwoord (sla dit op!)
   - **Region**: West EU (Netherlands) voor snelheid
   - **Pricing Plan**: Free

## Stap 2: Haal je API Credentials op

1. In je project dashboard, klik op het **⚙️ Settings** icon (linker sidebar)
2. Ga naar **API** in het settings menu
3. Kopieer:
   - **Project URL** (onder "Project URL")
   - **anon public** key (onder "Project API keys")

## Stap 3: Maak de Database Tabel aan

1. Klik op **🔨 SQL Editor** in de linker sidebar
2. Klik op **+ New query**
3. Plak de volgende SQL en klik **Run**:

```sql
-- Products table voor ProductPraat MVP
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

-- Index voor snellere queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Row Level Security uitschakelen voor MVP (later inschakelen!)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

## Stap 4: Vul Environment Variables in

1. Open `/home/ubuntu/productpraat_mvp_backend/nodejs_space/.env`
2. Vul in:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

**Voorbeeld:**
```bash
SUPABASE_URL=https://xyzabc123def.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Stap 5: Test de Connectie

```bash
cd /home/ubuntu/productpraat_mvp_backend/nodejs_space
yarn start:dev
```

Als alles goed gaat zie je:
```
✅ Supabase client geïnitialiseerd
✅ Products tabel bestaat
🚀 ProductPraat MVP Backend draait op poort 3000
```

## ✅ Verificatie

Test of de API werkt:

```bash
curl http://localhost:3000/health
```

Expected output:
```json
{
  "status": "ok",
  "timestamp": "2025-11-25T...",
  "service": "ProductPraat MVP Backend",
  "version": "1.0.0"
}
```

## 🎉 Klaar!

Je backend is nu klaar voor gebruik. Je kunt producten importeren via:

```bash
curl -X POST http://localhost:3000/api/products/import \
  -H "Content-Type: application/json" \
  -d '{"categories": ["elektronica"], "limit": 3}'
```

## 🔒 Security Note

Voor productie:
- Schakel Row Level Security (RLS) in op de products tabel
- Voeg authenticatie toe
- Gebruik service role key in plaats van anon key voor admin operaties

Voor MVP is dit voldoende! ✨
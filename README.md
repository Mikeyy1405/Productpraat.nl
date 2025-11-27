
# ProductPraat.nl - AI Powered Affiliate Platform

Dit is de source code voor ProductPraat.nl, een modern vergelijkingsplatform dat gebruik maakt van AI (Claude) om volledig autonoom productreviews en content te genereren.

**Laatste Update: Versie 2.0.0 - Universal URL Import**

## Features

- **Frontend:** React, TailwindCSS, Vite.
- **Backend:** Node.js (Express) voor API proxy.
- **AI:** Claude (Anthropic) integratie voor reviews, koopadvies en content strategie.
- **URL Import:** Importeer producten van elke webshop via URL (Bol.com, Amazon, Coolblue, etc.).
- **Content Studio:** Genereer blogs, vergelijkingen en toplijstjes met één klik.
- **Database:** Supabase integratie voor persistente opslag.

## Product Toevoegen via URL

De nieuwe, aanbevolen manier om producten toe te voegen:

1. Ga naar het Admin Dashboard
2. Klik op "Via URL" in de Producten sectie
3. Plak de URL van het product (Bol.com, Amazon, Coolblue, etc.)
4. Klik op "Analyseer Product"
5. Review de gegenereerde content
6. Pas eventueel aan en sla op

### Ondersteunde Webshops

- ✅ Bol.com
- ✅ Amazon
- ✅ Coolblue
- ✅ MediaMarkt
- ✅ Wehkamp
- ✅ Elke andere webshop met productpagina's

## Installatie

1. Clone de repository
2. Run `npm install`
3. Maak een `.env` bestand (zie Environment Variables)
4. Start development: `npm run dev` (Frontend) of `npm start` (Full stack productie preview)

## Environment Variables (Render.com)

Voor de productie-omgeving op Render.com moeten de volgende variabelen worden ingesteld:

| Key | Waarde (Voorbeeld/Beschrijving) |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Jouw Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Jouw Supabase Key |
| `VITE_ANTHROPIC_API_KEY` | Jouw Anthropic/Claude API Key (voor URL import) |
| `VITE_API_KEY` | Jouw AIML/OpenAI API Key (voor legacy features) |

### Optionele variabelen

| Key | Waarde (Voorbeeld/Beschrijving) |
| :--- | :--- |
| `VITE_CORS_PROXY` | Custom CORS proxy (bijv. `https://corsproxy.io/?`) |

### Legacy/Deprecated variabelen

De volgende variabelen worden niet meer actief gebruikt door de nieuwe URL-import functionaliteit:

| Key | Status |
| :--- | :--- |
| `BOL_CLIENT_ID` | ⚠️ Deprecated - gebruik URL import |
| `BOL_CLIENT_SECRET` | ⚠️ Deprecated - gebruik URL import |
| `BOL_SITE_ID` | ⚠️ Deprecated - gebruik URL import |

## Database Migrations

Before running the application for the first time or after updates, ensure the Supabase database schema is up to date.

### Applying Migrations

Run the SQL files in `supabase/migrations/` in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file and execute

**Available Migrations:**
- `20241126_add_bolreviewsraw_column.sql` - Adds the `bolReviewsRaw` column for storing Bol.com review data

## Deployment

Dit project is geoptimaliseerd voor deployment op **Render.com** als een **Web Service** (Node).

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

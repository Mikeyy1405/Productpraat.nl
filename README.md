
# ProductPraat.nl - AI Powered Affiliate Platform

Dit is de source code voor ProductPraat.nl, een modern vergelijkingsplatform dat gebruik maakt van AI (Claude) om volledig autonoom productreviews en content te genereren.

**Laatste Update: Versie 3.0.0 - Universal URL Import (Bol.com API Verwijderd)**

## Features

- **Frontend:** React, TailwindCSS, Vite.
- **Backend:** Node.js (Express) voor statische hosting.
- **AI:** Claude (Anthropic) integratie voor reviews, koopadvies en content strategie.
- **URL Import:** Importeer producten van elke webshop via URL (Bol.com, Amazon, Coolblue, etc.).
- **Bulk Import:** Importeer meerdere producten tegelijk met één klik.
- **Content Studio:** Genereer blogs, vergelijkingen en toplijstjes met één klik.
- **Database:** Supabase integratie voor persistente opslag.

## Product Toevoegen via URL

### Enkele Product Toevoegen

1. Ga naar het Admin Dashboard
2. Klik op "Nieuw Product via Link" (of "Via URL" in de Producten sectie)
3. Zorg dat "Enkele URL" mode is geselecteerd
4. Plak de affiliate URL van het product (Bol.com, Amazon, CoolBlue, etc.)
5. Klik op "Analyseer Product"
6. Review de gegenereerde content
7. Pas eventueel de affiliate link aan (bijv. tracking parameters toevoegen)
8. Sla op

### Bulk Import - Meerdere Producten Tegelijk

1. Ga naar het Admin Dashboard
2. Klik op "Nieuw Product via Link"
3. Switch naar "Bulk Import" mode
4. Plak meerdere product URLs (één per regel)
5. Klik op "Importeer Alle Producten"
6. Wacht terwijl elk product wordt geanalyseerd (2 seconden tussen requests)
7. Bekijk het overzicht van geïmporteerde producten

**Tip:** Bij bulk import worden producten automatisch opgeslagen zodra ze succesvol zijn gegenereerd.

### Affiliate Links

- De ingevoerde product URL wordt gebruikt als affiliate link
- Alle "Bekijk product" en "Koop nu" knoppen leiden naar deze link
- Je kunt tracking parameters toevoegen aan de link voor betere analytics
- Links openen automatisch in een nieuw tabblad met `target="_blank"` en `rel="noopener noreferrer"`

### Ondersteunde Webshops

- ✅ Bol.com (incl. partner links)
- ✅ Amazon (incl. affiliate tags)
- ✅ Coolblue
- ✅ MediaMarkt
- ✅ Wehkamp
- ✅ AliExpress
- ✅ Elke andere webshop met productpagina's

## Installatie

1. Clone de repository
2. Run `npm install`
3. Maak een `.env` bestand (zie Environment Variables)
4. Start development: `npm run dev` (Frontend) of `npm start` (Full stack productie preview)

## Environment Variables

Voor de productie-omgeving moeten de volgende variabelen worden ingesteld:

| Key | Waarde (Voorbeeld/Beschrijving) |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Jouw Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Jouw Supabase Key |
| `VITE_ANTHROPIC_API_KEY` | Jouw Anthropic/Claude API Key |

### Optionele variabelen

| Key | Waarde (Voorbeeld/Beschrijving) |
| :--- | :--- |
| `VITE_CORS_PROXY` | Custom CORS proxy (bijv. `https://corsproxy.io/?`) |

### ⚠️ Verwijderde variabelen (Bol.com API is niet meer nodig!)

De volgende variabelen zijn **niet meer nodig** en worden **niet meer gebruikt**:

| Key | Status |
| :--- | :--- |
| `BOL_CLIENT_ID` | ❌ VERWIJDERD |
| `BOL_CLIENT_SECRET` | ❌ VERWIJDERD |
| `BOL_SITE_ID` | ❌ VERWIJDERD |
| `VITE_API_KEY` | ❌ VERWIJDERD (vervangen door VITE_ANTHROPIC_API_KEY) |

**LET OP:** Alle producten worden nu toegevoegd via URL scraping + AI generatie. De Bol.com API is volledig verwijderd!

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

## Changelog

### v3.0.0 - Universal URL Import
- ✅ **VERWIJDERD**: Bol.com API integratie volledig verwijderd
- ✅ **NIEUW**: Bulk import functie - importeer meerdere URLs tegelijk
- ✅ **NIEUW**: Rate limiting (2 seconden tussen bulk imports)
- ✅ **NIEUW**: Editable affiliate links na generatie
- ✅ **NIEUW**: `getStoreName()` helper voor webshop detectie
- ✅ **VERBETERD**: Progress tracking voor bulk imports
- ✅ **VERBETERD**: Error handling met retry mogelijkheid

### v2.0.0 - Universal URL Import (Initial)
- URL scraping met CORS proxy fallback
- Claude AI integratie voor product analyse
- ProductGenerator component voor single URL import

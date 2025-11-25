
# ProductPraat.nl - AI Powered Affiliate Platform

Dit is de source code voor ProductPraat.nl, een modern vergelijkingsplatform dat gebruik maakt van AIML (Claude) en de Bol.com API om volledig autonoom productreviews en content te genereren.

**Laatste Update: Versie 1.9.5 - Force Deployment**

## Features

- **Frontend:** React, TailwindCSS, Vite.
- **Backend:** Node.js (Express) voor Bol.com authenticatie en API proxy.
- **AI:** AIML API (Claude 4.5 Sonnet) integratie voor reviews, koopadvies en content strategie.
- **Auto-Pilot:** Een autonome agent die zelfstandig Bol.com bestsellers zoekt en toevoegt.
- **Content Studio:** Genereer blogs, vergelijkingen en toplijstjes met één klik.
- **Database:** Supabase integratie voor persistente opslag.

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
| `VITE_API_KEY` | Jouw AIML/OpenAI API Key |
| `BOL_CLIENT_ID` | Client ID van Bol.com Retailer API |
| `BOL_CLIENT_SECRET` | Client Secret van Bol.com Retailer API |
| `BOL_SITE_ID` | Jouw Affiliate Site ID (bijv. 1296565) |

## Deployment

Dit project is geoptimaliseerd voor deployment op **Render.com** als een **Web Service** (Node).

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

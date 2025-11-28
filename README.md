# ProductPraat.nl - Simpel Affiliate Platform

Modern vergelijkingsplatform met AI-gegenereerde productreviews.

## Snelstart

1. Clone de repository
2. Run `npm install`
3. Maak een `.env` bestand met je credentials
4. Start development: `npm run dev`

## Hoe het werkt

1. **Plak een product URL** → 2. **AI genereert de content** → 3. **Live op je site**

Dat is alles. Simpel.

## Product Toevoegen

1. Ga naar `/dashboard` (Admin Panel)
2. Klik op "Voeg Product Toe via URL"
3. Plak de affiliate link (Bol.com, Coolblue, Amazon, etc.)
4. AI analyseert het product automatisch
5. Review de gegenereerde content
6. Klaar!

## Environment Variables

Maak een `.env` bestand:

```env
VITE_SUPABASE_URL=jouw_supabase_url
VITE_SUPABASE_ANON_KEY=jouw_supabase_key
VITE_ANTHROPIC_API_KEY=jouw_claude_api_key

# Bol.com Partner Program API (voor product import)
BOL_CLIENT_ID=jouw_client_id
BOL_CLIENT_SECRET=jouw_client_secret
```

## Bol.com API Configuratie

Om de product import functionaliteit te gebruiken heb je Bol.com Partner Program API credentials nodig.

### API Token verkrijgen

1. Ga naar [Bol.com Partner Programma](https://partnerprogramma.bol.com)
2. Meld je aan of log in
3. Navigeer naar **API Toegang** in je dashboard
4. Genereer OAuth2 credentials (Client ID en Client Secret)
5. Voeg de credentials toe aan je `.env` bestand

### Accept-Language instellen

De API gebruikt standaard `nl` (Nederlands). Dit kan aangepast worden in de API calls via de `acceptLanguage` parameter.

### Category Discovery Script

Het project bevat een script om Bol.com category IDs te ontdekken. Dit is handig bij het toevoegen van nieuwe productcategorieën.

```bash
# Installeer ts-node als devDependency (optioneel)
npm install -D ts-node

# Run het discovery script met standaard zoektermen
npx ts-node scripts/find-bol-categories.ts

# Of met aangepaste zoektermen
npx ts-node scripts/find-bol-categories.ts "verzorging" "televisie" "laptop"
```

Het script output:
- Alle gevonden categorieën per zoekterm
- De meest relevante category IDs
- Een kant-en-klare TypeScript mapping die je kunt kopiëren naar `src/lib/categoryMapping.ts`

### Category ID Mapping

De huidige mapping tussen UI categorieën en Bol.com category IDs:

| Categorie | Category ID | Fallback Zoekterm |
|-----------|-------------|-------------------|
| Televisies | 15452 | televisie tv |
| Audio & HiFi | 3137 | audio koptelefoon speakers |
| Laptops | 4770 | laptop notebook |
| Smartphones | 21328 | smartphone mobiele telefoon |
| Wasmachines | 15457 | wasmachine |
| Stofzuigers | 13138 | stofzuiger |
| Smart Home | 23868 | smart home domotica |
| Matrassen | 13640 | matras |
| Airfryers | 21671 | airfryer hetelucht friteuse |
| Koffie | 19298 | koffiezetapparaat espressomachine |
| Keukenmachines | 12694 | keukenmachine blender |
| Verzorging | 12442 | persoonlijke verzorging scheerapparaat |

## Tech Stack

- **Frontend:** React, TailwindCSS, Vite
- **Backend:** Node.js (Express)
- **AI:** Claude (Anthropic)
- **Database:** Supabase

## Ondersteunde Webshops

- ✅ Bol.com
- ✅ Coolblue
- ✅ Amazon
- ✅ MediaMarkt
- ✅ Elke webshop met productpagina's

## Deployment

Geoptimaliseerd voor Render.com:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

## Structuur

```
App.tsx                    # Hoofdapp (< 300 regels)
├── components/
│   ├── SimpleAdminPanel.tsx   # Admin panel (< 150 regels)
│   ├── ProductGenerator.tsx   # URL import component
│   └── views/
│       ├── HomeView.tsx       # Homepage
│       └── ProductView.tsx    # Product details
├── services/
│   ├── storage.ts            # Database CRUD
│   └── aiService.ts          # AI integratie
├── src/lib/
│   ├── categoryMapping.ts    # Category ID mapping
│   └── bolApi.ts             # Bol.com API client
├── scripts/
│   └── find-bol-categories.ts  # Category discovery script
├── tests/
│   └── importer.test.ts      # Importer unit tests
└── server.js                 # Express server
```

## Changelog

### v5.1.0 - Bol.com Category ID Integration
- ✅ Category mapping met Bol.com category IDs
- ✅ Primary endpoint: Popular Products by Category ID
- ✅ Fallback endpoint: Search Products
- ✅ Concurrent requests met rate limiting
- ✅ Product deduplicatie op EAN
- ✅ Verbeterde foutafhandeling (400, 404, 406, 500, 503)
- ✅ Category discovery script
- ✅ Unit tests voor importer logica

### v5.0.0 - Simplified Edition
- ✅ App.tsx onder 300 regels
- ✅ SimpleAdminPanel onder 150 regels
- ✅ Server.js onder 400 regels
- ✅ Focus op essentie: URL → AI → Live
- ❌ Automation systeem verwijderd
- ❌ Bulk import verwijderd
- ❌ Complex filter systeem verwijderd

## License

MIT

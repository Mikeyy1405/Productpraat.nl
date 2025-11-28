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

## Bulk Product Import (via Bol.com API)

Het platform ondersteunt ook automatische bulk import vanuit Bol.com:

1. Ga naar `/dashboard`
2. Selecteer categorieën (bijv. "Televisies", "Verzorging")
3. Stel het aantal producten per categorie in
4. Klik op "Importeer Producten"

De importer gebruikt Bol.com's Marketing Catalog API met:
- **Primair**: Populaire producten per categorie (`/products/lists/popular?category-id=...`)
- **Fallback**: Zoekresultaten als geen producten gevonden (`/products/search?search-term=...`)
- Automatische deduplicatie op EAN
- Concurrent verwerking (3 categorieën tegelijk)

## Environment Variables

Maak een `.env` bestand:

```env
# Database & AI
VITE_SUPABASE_URL=jouw_supabase_url
VITE_SUPABASE_ANON_KEY=jouw_supabase_key
VITE_ANTHROPIC_API_KEY=jouw_claude_api_key

# Bol.com Partner Program API (vereist voor bulk import)
BOL_CLIENT_ID=jouw_bol_client_id
BOL_CLIENT_SECRET=jouw_bol_client_secret
BOL_SITE_ID=jouw_bol_site_id
```

### Bol.com API Token Verkrijgen

1. Ga naar [Bol.com Partner Program](https://partnerprogramma.bol.com)
2. Log in of maak een account aan
3. Navigeer naar "API Access" in je dashboard
4. Genereer OAuth2 credentials (Client ID en Client Secret)
5. Voeg deze toe aan je `.env` bestand

### Accept-Language Configuratie

De Bol.com API vereist een `Accept-Language` header. Standaard gebruikt de applicatie `nl` (Nederlands). Dit is geconfigureerd in:
- `src/lib/bolApi.ts` - voor frontend modules
- `server.js` - voor server-side calls

## Category Discovery Script

Om nieuwe Bol.com categorie IDs te ontdekken, gebruik het discovery script:

```bash
# Met npx (vereist ts-node)
npx ts-node scripts/find-bol-categories.ts televisie laptop smartphone

# Of met standaard zoektermen
npx ts-node scripts/find-bol-categories.ts

# Environment variabelen (optioneel)
BOL_API_TOKEN=jouw_token ACCEPT_LANGUAGE=nl npx ts-node scripts/find-bol-categories.ts
```

Het script output:
- Gevonden categorie IDs per zoekterm
- TypeScript mapping code voor `src/lib/categoryMapping.ts`
- Samenvatting van succesvolle en gefaalde zoekopdrachten

## Categorie Mapping

De mapping van UI categorieën naar Bol.com categorie IDs staat in:
- `src/lib/categoryMapping.ts` - TypeScript module voor frontend
- `server.js` - `CATEGORY_ID_MAPPING` object voor server-side

Bekende categorie mappings:
| Categorie | Bol.com ID |
|-----------|------------|
| verzorging | 12442 |
| televisies | 10651 |
| laptops | 4770 |
| smartphones | 10852 |
| wasmachines | 11462 |
| stofzuigers | 20104 |
| smarthome | 20637 |
| matrassen | 10689 |
| airfryers | 43756 |
| koffie | 10550 |
| keuken | 10540 |
| audio | 14490 |

## Tech Stack

- **Frontend:** React, TailwindCSS, Vite
- **Backend:** Node.js (Express)
- **AI:** Claude (Anthropic)
- **Database:** Supabase
- **Testing:** Vitest

## Ondersteunde Webshops

- ✅ Bol.com
- ✅ Coolblue
- ✅ Amazon
- ✅ MediaMarkt
- ✅ Elke webshop met productpagina's

## Tests

```bash
# Run tests
npm run test

# Watch mode
npm run test:watch
```

## Deployment

Geoptimaliseerd voor Render.com:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

## Structuur

```
App.tsx                    # Hoofdapp (< 300 regels)
├── components/
│   ├── SimpleAdminPanel.tsx   # Admin panel (< 150 regels)
│   ├── SimpleDashboard.tsx    # Dashboard met bulk import
│   ├── ProductGenerator.tsx   # URL import component
│   └── views/
│       ├── HomeView.tsx       # Homepage
│       └── ProductView.tsx    # Product details
├── src/lib/
│   ├── categoryMapping.ts     # Categorie ID mappings
│   └── bolApi.ts              # Bol.com API client
├── scripts/
│   └── find-bol-categories.ts # Category discovery script
├── services/
│   ├── storage.ts            # Database CRUD
│   └── aiService.ts          # AI integratie
├── tests/
│   └── importer.test.ts      # Importer unit tests
└── server.js                 # Express server
```

## Changelog

### v5.1.0 - Bol.com Category Mapping
- ✅ UI categorieën gemapped naar Bol.com numerieke IDs
- ✅ Primair endpoint: `/products/lists/popular?category-id={id}`
- ✅ Fallback naar zoekresultaten als geen producten
- ✅ Category discovery script toegevoegd
- ✅ Concurrent request handling (3 tegelijk)
- ✅ Deduplicatie op EAN
- ✅ Robuuste foutafhandeling met gebruikersvriendelijke berichten
- ✅ Unit tests voor importer logica
- ✅ README documentatie voor API configuratie

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

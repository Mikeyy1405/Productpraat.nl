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
```

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
└── server.js                 # Express server (< 200 regels)
```

## Changelog

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

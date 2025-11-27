
# ProductPraat.nl - AI Powered Affiliate Platform + WritgoCMS

Dit is de source code voor ProductPraat.nl, een modern vergelijkingsplatform dat gebruik maakt van AI (Claude) om volledig autonoom productreviews en content te genereren.

**Laatste Update: Versie 4.0.0 - WritgoCMS Integratie**

## Wat is Nieuw in v4.0.0

### WritgoCMS - Flexibel Content Management Systeem

ProductPraat is nu uitgebreid met WritgoCMS, een modulaire CMS-laag die gebruikers in staat stelt om:

- **3 Template Types** te kiezen: Bedrijfswebsite, Shop, of Blog
- **20+ Feature Toggles** in/uit te schakelen per template
- **Template Switchen** zonder dataverlies
- **Visuele Preview** van templates bekijken
- **Backwards Compatible** met alle bestaande ProductPraat shop data

### CMS Features

| Feature | Beschrijving |
|---------|-------------|
| Template Selector | Kies uit Business, Shop of Blog template |
| Feature Toggles | 20+ modulaire functies in/uit schakelen |
| CMS Dashboard | Centraal beheer van alle CMS instellingen |
| Setup Wizard | Intuïtieve setup voor nieuwe gebruikers |
| Migratie Tool | Behoud bestaande ProductPraat data |

### Documentatie

Zie [docs/WRITGO_CMS.md](docs/WRITGO_CMS.md) voor uitgebreide documentatie over:
- Nieuwe templates toevoegen
- Nieuwe features toevoegen
- CMS Context API gebruiken
- Migratie van ProductPraat

## Features

- **Frontend:** React, TailwindCSS, Vite.
- **Backend:** Node.js (Express) voor statische hosting.
- **AI:** Claude (Anthropic) integratie voor reviews, koopadvies en content strategie.
- **URL Import:** Importeer producten van elke webshop via URL (Bol.com, Amazon, Coolblue, etc.).
- **Bulk Import:** Importeer meerdere producten tegelijk met één klik.
- **Content Studio:** Genereer blogs, vergelijkingen en toplijstjes met één klik.
- **Database:** Supabase integratie voor persistente opslag.
- **CMS:** WritgoCMS met templates en feature toggles.

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

### Affiliate Network Configuratie

Om affiliate tracking in te schakelen, configureer de volgende variabelen:

| Key | Netwerk | Beschrijving |
| :--- | :--- | :--- |
| `BOL_PARTNER_ID` | Bol.com | Partner ID van het Bol.com Partner Program |
| `TRADETRACKER_SITE_ID` | TradeTracker | Site ID van TradeTracker publisher account |
| `DAISYCON_PUBLISHER_ID` | Daisycon | Publisher ID van Daisycon account |
| `AWIN_PUBLISHER_ID` | Awin | Publisher ID van Awin account |
| `PAYPRO_AFFILIATE_ID` | PayPro | Affiliate ID voor digitale producten |
| `PAYPRO_API_KEY` | PayPro | API Key voor product search (optioneel) |
| `PLUGPAY_AFFILIATE_ID` | Plug&Pay | Affiliate ID voor digitale producten |

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

## Affiliate Netwerk Setup

ProductPraat ondersteunt integratie met meerdere affiliate netwerken voor zowel fysieke als digitale producten.

### Ondersteunde Netwerken

**Fysieke Product Netwerken:**
- **Bol.com Partner Program** - Grootste Nederlandse marketplace
- **TradeTracker** - Europees affiliate netwerk met veel Nederlandse merchants
- **Daisycon** - Nederlands affiliate netwerk met sterke lokale aanwezigheid
- **Awin** - Globaal affiliate netwerk met grote merken

**Digitale Product Netwerken:**
- **PayPro** - Nederlands platform voor online cursussen en digitale producten
- **Plug&Pay** - Nederlands platform voor coaching en digitale producten

### Hoe te Registreren

1. **Bol.com Partner Program:**
   - Ga naar https://partnerprogramma.bol.com
   - Registreer als partner
   - Kopieer je Partner ID naar `BOL_PARTNER_ID`

2. **TradeTracker:**
   - Ga naar https://www.tradetracker.com
   - Registreer als publisher
   - Kopieer je Site ID naar `TRADETRACKER_SITE_ID`

3. **Daisycon:**
   - Ga naar https://www.daisycon.com
   - Registreer als publisher
   - Kopieer je Publisher ID naar `DAISYCON_PUBLISHER_ID`

4. **Awin:**
   - Ga naar https://www.awin.com
   - Registreer als publisher
   - Kopieer je Publisher ID naar `AWIN_PUBLISHER_ID`

5. **PayPro:**
   - Ga naar https://paypro.nl/affiliates
   - Registreer voor het affiliate programma
   - Kopieer je Affiliate ID naar `PAYPRO_AFFILIATE_ID`
   - (Optioneel) Kopieer je API Key naar `PAYPRO_API_KEY`

6. **Plug&Pay:**
   - Ga naar https://www.plugpay.nl/affiliate
   - Registreer voor het affiliate programma
   - Kopieer je Affiliate ID naar `PLUGPAY_AFFILIATE_ID`

### Affiliate API Endpoints

De server biedt de volgende endpoints voor affiliate tracking:

```bash
# Track een klik op een affiliate link
POST /api/affiliate/track
Content-Type: application/json

{
  "productId": "product-123",
  "url": "https://www.bol.com/nl/p/product/123"
}

# Response:
{
  "success": true,
  "linkId": "link-abc123",
  "clickId": "click-xyz789"
}

# Haal alle ondersteunde netwerken op
GET /api/affiliate/networks

# Response:
{
  "networks": [
    { "id": "bol", "name": "Bol.com Partner", "type": "physical", ... },
    { "id": "paypro", "name": "PayPro", "type": "digital", ... }
  ]
}
```

## Database Migrations

Before running the application for the first time or after updates, ensure the Supabase database schema is up to date.

### Applying Migrations

Run the SQL files in `supabase/migrations/` in your Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of each migration file and execute

**Available Migrations:**
- `20241126_add_bolreviewsraw_column.sql` - Adds the `bolReviewsRaw` column for storing Bol.com review data
- `20241128_affiliate_infrastructure.sql` - Creates affiliate tables (networks, links, clicks, digital_products) and seeds network data

## Deployment

Dit project is geoptimaliseerd voor deployment op **Render.com** als een **Web Service** (Node).

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`

## Automation Systeem

ProductPraat beschikt over een volledig geautomatiseerd systeem dat 24/7 werkt aan het optimaliseren van affiliate commissies.

### Automation Control Center

Het Automation Control Center is een configureerbaar dashboard in het Admin Panel waar alle autonome functies kunnen worden beheerd. Gebruikers kunnen instellen hoeveel producten per dag gegenereerd worden, welke categorieën, en hoe vaak nieuwe content wordt geschreven.

#### Master Switch

- Grote toggle om alle automation in/uit te schakelen
- Visual status indicator toont de huidige staat

#### Product Generatie

| Instelling | Beschrijving | Bereik |
|------------|--------------|--------|
| Enable/Disable | Zet product generatie aan/uit | Toggle |
| Producten per dag | Aantal producten om te genereren | 0-10 (slider) |
| Categorieën | Selecteer categorieën voor generatie | Checkboxes |
| Uitvoer tijd | Voorkeur tijd voor generatie | Time picker (HH:MM) |

#### Content Generatie

| Instelling | Beschrijving | Opties |
|------------|--------------|--------|
| Enable/Disable | Zet content generatie aan/uit | Toggle |
| Frequentie | Hoe vaak content genereren | daily/weekly/biweekly/monthly |
| Content types | Welke types te genereren | guides, comparisons, toplists, blogs |
| Posts per week | Aantal posts per week | 1-7 (slider) |
| Voorkeur dagen | Dagen voor publicatie | Zon-Za selectie |

#### Link Monitoring

| Instelling | Beschrijving | Opties |
|------------|--------------|--------|
| Enable/Disable | Zet monitoring aan/uit | Toggle |
| Check frequentie | Hoe vaak te controleren | hourly/daily/weekly |
| Auto-fix | Automatisch broken links fixen | Checkbox |
| Notificaties | Meldingen bij problemen | Checkbox |

#### Commissie Tracking

| Instelling | Beschrijving | Opties |
|------------|--------------|--------|
| Enable/Disable | Zet tracking aan/uit | Toggle |
| Sync frequentie | Hoe vaak te synchroniseren | hourly/daily/weekly |
| Netwerken | Welke netwerken te tracken | bol, tradetracker, daisycon, awin, paypro, plugpay |

#### Notificatie Instellingen

| Instelling | Beschrijving |
|------------|--------------|
| E-mail | E-mailadres voor notificaties |
| E-mail ingeschakeld | Toggle voor e-mail notificaties |
| Alert types | Selecteer welke alerts te ontvangen (broken_links, low_conversion, high_earnings, content_published, product_generated, error_occurred) |

#### Performance Instellingen

| Instelling | Beschrijving |
|------------|--------------|
| Caching | Schakel caching in voor betere prestaties |
| Lazy loading | Lazy loading voor afbeeldingen |
| Image optimization | Automatische afbeelding optimalisatie |
| Min conversie rate | Minimum conversie rate drempel (0-10%) |
| Auto-remove | Automatisch slecht presterende producten verwijderen |

### Geautomatiseerde Taken

| Taak | Schema | Beschrijving |
|------|--------|--------------|
| Link Health Check | Dagelijks 02:00 | Controleert alle affiliate links op geldigheid |
| Commission Sync | Dagelijks 03:00 | Haalt commissie data op van alle netwerken |
| Content Generatie | Ma/Wo/Vr 09:00 | Genereert automatisch nieuwe content |
| Product Generatie | Configureerbaar | Genereert automatisch nieuwe producten |
| Publicatie Check | Elk uur | Publiceert geplande content |

### Automation Services

- **automationConfigService.ts** - Laad, opslaan en valideren van configuratie
- **autonomousProductGenerator.ts** - Automatische product generatie
- **autonomousContentGenerator.ts** - Automatische content generatie
- **affiliateLinkMonitor.ts** - Monitort link gezondheid en vervangt broken links
- **commissionTracker.ts** - Integreert met affiliate netwerk APIs
- **contentScheduler.ts** - Plant en publiceert content automatisch
- **automationLogger.ts** - Centrale logging voor alle taken
- **alertSystem.ts** - Error handling en notificaties

> **Note**: De affiliate netwerk API integraties (Bol.com, TradeTracker, Daisycon, Awin) zijn voorbereid maar vereisen specifieke API credentials en implementatie van de netwerk-specifieke endpoints. De stub implementaties loggen momenteel alleen naar de console.

### Automation API Endpoints

```bash
# Get automation status
GET /api/automation/status

# Trigger a job manually
POST /api/automation/trigger/:jobName
# jobName: linkHealthCheck, commissionSync, contentGeneration, publicationCheck

# Enable/disable automation
POST /api/automation/enable
Content-Type: application/json
{ "enabled": true }

# Get automation logs
GET /api/automation/logs
```

### Configuratie

Automation wordt geconfigureerd via het Admin Panel of via environment variabelen:

```bash
AUTOMATION_ENABLED=true
CRON_LINK_CHECK_TIME="0 2 * * *"
CRON_COMMISSION_SYNC_TIME="0 3 * * *"
CRON_CONTENT_GEN_TIME="0 9 * * 1,3,5"
CRON_PUBLICATION_CHECK_TIME="0 * * * *"
```

De volledige configuratie wordt opgeslagen in zowel localStorage (voor snelle toegang) als de Supabase database (voor persistentie).

### Database Migraties

Run de volgende migraties in Supabase SQL Editor:

**20241127_automation_infrastructure.sql:**
- `link_health_checks` - Link gezondheid historie
- `commission_records` - Commissie data
- `performance_metrics` - Performance metrics
- `content_schedule` - Geplande content
- `automation_logs` - Job execution logs
- `automation_alerts` - Notificaties
- `retry_tasks` - Retry queue

**20241129_automation_config.sql:**
- `automation_config` - Centrale configuratie tabel met JSONB voor alle instellingen

## Changelog

### v4.3.0 - Automation Control Dashboard
- ✅ **NIEUW**: Automation Control Center UI in Admin Panel
- ✅ **NIEUW**: Master switch om alle automation in/uit te schakelen
- ✅ **NIEUW**: Product generatie instellingen (producten per dag, categorieën, tijd)
- ✅ **NIEUW**: Content generatie instellingen (frequentie, types, posts per week)
- ✅ **NIEUW**: Link monitoring instellingen (check frequentie, auto-fix, notificaties)
- ✅ **NIEUW**: Commissie tracking instellingen (sync frequentie, netwerken)
- ✅ **NIEUW**: Notificatie voorkeuren (email, alert types)
- ✅ **NIEUW**: Performance optimization instellingen
- ✅ **NIEUW**: AutomationConfig type definitions
- ✅ **NIEUW**: automationConfigService voor laden/opslaan/valideren van config
- ✅ **NIEUW**: autonomousProductGenerator service
- ✅ **NIEUW**: autonomousContentGenerator service
- ✅ **NIEUW**: Database migratie 20241129_automation_config.sql

### v4.2.0 - Automation Infrastructure
- ✅ **NIEUW**: node-cron voor scheduled tasks
- ✅ **NIEUW**: Affiliate Link Health Monitor service
- ✅ **NIEUW**: Commission Tracker met netwerk API integraties
- ✅ **NIEUW**: Content Scheduler voor geautomatiseerde publicatie
- ✅ **NIEUW**: Centralized Automation Logger
- ✅ **NIEUW**: Alert System met retry logic
- ✅ **NIEUW**: Database migraties voor automation tabellen
- ✅ **NIEUW**: Automation API endpoints
- ✅ **NIEUW**: Environment variabelen voor automation configuratie

### v4.1.0 - Affiliate Infrastructure
- ✅ **NIEUW**: Affiliate netwerk integratie (Bol.com, TradeTracker, Daisycon, Awin)
- ✅ **NIEUW**: Digitale product netwerken (PayPro, Plug&Pay)
- ✅ **NIEUW**: Click tracking API endpoints
- ✅ **NIEUW**: AffiliateBuyButton component
- ✅ **NIEUW**: affiliateService.ts met link generatie en detectie
- ✅ **NIEUW**: Database migratie voor affiliate tabellen
- ✅ **VERBETERD**: Types uitgebreid met AffiliateLink en DigitalProduct

### v4.0.0 - WritgoCMS Integration
- ✅ **NIEUW**: WritgoCMS - Flexibel Content Management Systeem
- ✅ **NIEUW**: 3 Template types (Bedrijfswebsite, Shop, Blog)
- ✅ **NIEUW**: 20+ Feature Toggles met categorieën
- ✅ **NIEUW**: CMS Dashboard in Admin Panel
- ✅ **NIEUW**: Template Selector met visuele preview
- ✅ **NIEUW**: Feature Toggle Panel met instellingen
- ✅ **NIEUW**: Setup Wizard voor nieuwe gebruikers
- ✅ **NIEUW**: Migratie tool voor bestaande ProductPraat data
- ✅ **NIEUW**: Uitgebreide documentatie (docs/WRITGO_CMS.md)
- ✅ **VERBETERD**: Modulaire architectuur met React Context

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

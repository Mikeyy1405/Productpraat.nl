# VPS Services

Centrale automatisering-server voor al je projecten. Draait op je TransIP VPS en biedt:

- **Playwright API** - Browser automatisering als service
- **Task Queue** - Async verwerking van taken
- **Session Management** - Login sessies delen tussen projecten
- **Rate Limiting** - Per-project API limieten

## Quick Start

### Op je VPS

```bash
# Clone de repo
git clone https://github.com/Mikeyy1405/Productpraat.nl.git
cd Productpraat.nl/vps-services

# Run setup script
chmod +x setup-vps.sh
sudo ./setup-vps.sh
```

### API Key aanmaken

```bash
# Maak een API key voor je project
curl -X POST https://api.productpraat.nl/playwright/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Productpraat", "project": "productpraat", "rateLimit": 100}'
```

## Gebruik in je Project

### TypeScript/JavaScript

```typescript
import { PlaywrightClient } from './vps-services/shared/playwright-client';

const client = new PlaywrightClient({
  baseUrl: 'https://api.productpraat.nl/playwright',
  apiKey: 'pp_your_api_key_here',
});

// Screenshot maken
const screenshot = await client.screenshot('https://example.com');

// Data scrapen
const data = await client.scrape('https://bol.com/product/123', {
  title: 'h1',
  price: '.prijs',
  description: '.product-description',
});

// Affiliate link genereren
const affiliate = await client.affiliate('https://www.bol.com/nl/p/product/123');

// Media ophalen (hoge resolutie afbeeldingen)
const media = await client.media('https://www.bol.com/nl/p/product/123');

// Inloggen en sessie opslaan
const session = await client.login({
  loginUrl: 'https://partner.bol.com/login',
  email: 'email@example.com',
  password: 'password',
  domain: 'partner.bol.com',
});
```

## API Endpoints

### Tasks

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| POST | `/tasks` | Nieuwe taak aanmaken |
| GET | `/tasks/:id` | Taak status ophalen |
| GET | `/tasks` | Alle taken lijsten |

### Task Types

```json
// Screenshot
{
  "type": "screenshot",
  "input": {
    "url": "https://example.com",
    "fullPage": true
  }
}

// Scrape
{
  "type": "scrape",
  "input": {
    "url": "https://example.com",
    "selectors": {
      "title": "h1",
      "content": ".main-content"
    }
  }
}

// Affiliate
{
  "type": "affiliate",
  "input": {
    "url": "https://www.bol.com/nl/p/product/123",
    "partnerId": "12345",
    "network": "bol"
  }
}

// Media
{
  "type": "media",
  "input": {
    "url": "https://www.bol.com/nl/p/product/123"
  }
}

// Login
{
  "type": "login",
  "input": {
    "loginUrl": "https://partner.bol.com/login",
    "email": "email@example.com",
    "password": "password",
    "domain": "partner.bol.com"
  }
}

// Custom Actions
{
  "type": "custom",
  "input": {
    "url": "https://example.com",
    "actions": [
      { "type": "goto", "value": "https://example.com" },
      { "type": "click", "selector": ".login-button" },
      { "type": "fill", "selector": "#email", "value": "test@test.com" },
      { "type": "screenshot" }
    ]
  }
}
```

### Sessions

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| GET | `/sessions` | Alle sessies lijsten |
| DELETE | `/sessions/:id` | Sessie verwijderen |

### Admin

| Method | Endpoint | Beschrijving |
|--------|----------|--------------|
| POST | `/admin/api-keys` | API key aanmaken |
| GET | `/admin/api-keys` | API keys lijsten |
| DELETE | `/admin/api-keys/:key` | API key verwijderen |
| GET | `/admin/stats` | Systeem statistieken |

### WebSocket

Verbind met `/ws?apiKey=YOUR_KEY` voor real-time updates:

```typescript
const ws = new WebSocket('wss://api.productpraat.nl/playwright/ws?apiKey=pp_xxx');

ws.onmessage = (event) => {
  const { event: eventName, data } = JSON.parse(event.data);

  if (eventName === 'task:completed') {
    console.log('Task done:', data.taskId);
  }
};
```

## Architectuur

```
┌─────────────────────────────────────────────────────────────┐
│                        TransIP VPS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Nginx  │───▶│  Playwright API  │───▶│   Chromium    │  │
│  │  :443   │    │     :3100        │    │   (headless)  │  │
│  └─────────┘    └──────────────────┘    └───────────────┘  │
│       │                  │                                  │
│       │         ┌────────▼────────┐                        │
│       │         │     Redis       │                        │
│       │         │     :6379       │                        │
│       │         └─────────────────┘                        │
│       │                                                     │
│       └──────────────────────────────────────────────────  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           │
           │  HTTPS
           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Je Projecten                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Productpraat   │  │   Project 2     │  │  Project 3  │ │
│  │                 │  │                 │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Helper Commands

Na installatie zijn deze commando's beschikbaar:

```bash
vps-status   # Service status bekijken
vps-logs     # Logs volgen
vps-restart  # Services herstarten
vps-update   # Update en rebuild
```

## Monitoring

Health check endpoint:

```bash
curl https://api.productpraat.nl/playwright/health
```

Response:
```json
{
  "status": "ok",
  "browser": "running",
  "tasks": {
    "running": 2,
    "queued": 5,
    "total": 150
  },
  "uptime": 86400
}
```

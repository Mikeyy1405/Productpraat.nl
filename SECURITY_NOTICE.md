# 🚨 SECURITY NOTICE - ACTIE VEREIST!

## Probleem

De `.env` file met API credentials stond per ongeluk in Git en is gepusht naar GitHub.

**Dit is nu opgelost**, maar je moet de volgende API keys DIRECT ROTEREN:

## ⚠️ Te Roteren API Keys

### 1. BOL.COM API
- **Client ID**: `34713130-133d-4aa0-bee4-0926dc30913f`
- **Client Secret**: `uF85MFTZ4q?)1T0vX!akVoTVd5V!AAw4CIb+s6MH@23YGwNkRjkUTUxz0j4c67vU`

**Actie:**
1. Ga naar Bol.com Partner Dashboard
2. Revoke de huidige credentials
3. Genereer nieuwe credentials
4. Update in Render environment variables

### 2. AIML API
- **API Key**: `eb1cd6eaee0d4c5ca30dffe07cdcb600`

**Actie:**
1. Ga naar https://aimlapi.com/app/keys
2. Revoke de huidige key
3. Genereer nieuwe API key
4. Update in Render environment variables

---

## ✅ Wat is er gedaan?

1. ✅ `.env` file verwijderd uit Git tracking
2. ✅ `.gitignore` updated om alle `.env` files te excluderen
3. ✅ Code gebruikt al `process.env` voor credentials (veilig)
4. ✅ Nieuwe commit zonder credentials

---

## 🔒 Environment Variables in Render

Zorg dat deze variabelen zijn ingesteld in Render:

```
BOL_CLIENT_ID=<nieuwe_client_id>
BOL_CLIENT_SECRET=<nieuwe_client_secret>
BOL_SITE_ID=1296565
AIML_API_KEY=<nieuwe_api_key>
SUPABASE_URL=<jouw_supabase_url>
SUPABASE_ANON_KEY=<jouw_supabase_key>
PORT=3000
NODE_ENV=production
```

---

## 📝 Voor Lokale Development

Maak een `.env` file (staat nu in .gitignore):

```bash
cp nodejs_space/.env.example nodejs_space/.env
# Vul in met je NIEUWE credentials
```

---

## 🛡️ Best Practices (nu geïmplementeerd)

✅ Alle `.env` files in `.gitignore`
✅ Alleen `.env.example` in Git (zonder echte credentials)
✅ Code gebruikt `ConfigService` / `process.env`
✅ Credentials komen uit environment variables

---

## ⏰ Urgentie

**HOOG** - De gelekte credentials kunnen door iedereen op GitHub worden gezien.

Roteer de API keys zo snel mogelijk!

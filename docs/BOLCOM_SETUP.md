# Bol.com Shop Setup Guide

This guide explains how to set up and configure the Bol.com affiliate shop integration for ProductPraat.

## Prerequisites

1. **Bol.com Partner Account**: You need a Bol.com Partner Program account
2. **API Access**: Marketing Catalog API access (request through partner dashboard)
3. **Affiliate ID**: Your unique partner/affiliate ID for tracking

## Getting Your API Credentials

### Step 1: Join the Partner Program

1. Go to [https://partnerprogramma.bol.com](https://partnerprogramma.bol.com)
2. Sign up for a new account or log in
3. Complete the registration process
4. Wait for approval (usually 1-3 business days)

### Step 2: Get API Access

1. Log in to your Partner Dashboard
2. Navigate to **Tools** → **API Access**
3. Apply for Marketing Catalog API access
4. Once approved, generate an API key

### Step 3: Get Your Affiliate ID

1. In the Partner Dashboard, go to **Account Settings**
2. Find your Partner ID (this is your affiliate ID)
3. Copy this ID for use in affiliate links

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Bol.com API
BOL_API_KEY=your_api_key_here
BOL_AFFILIATE_ID=your_affiliate_id_here

# Sync Settings
SYNC_ENABLED=true
SYNC_INTERVAL_HOURS=1
SYNC_POPULAR_PRODUCTS_LIMIT=100
```

### Sync Configuration

The shop supports automatic product synchronization with configurable intervals:

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| Popular Products Sync | `CRON_POPULAR_SYNC_TIME` | Daily at 2 AM | Fetches popular products per category |
| Price Updates | `CRON_PRICE_UPDATE_TIME` | Every hour | Updates prices and stock status |
| Deal Detection | `CRON_DEAL_DETECTION_TIME` | Every 15 min | Detects new deals and discounts |
| Rating Updates | `CRON_RATING_UPDATE_TIME` | Daily at 3 AM | Updates product ratings |

### Category Configuration

Specify which Bol.com categories to sync by setting `SYNC_CATEGORY_IDS`:

```bash
# Common category IDs:
# 11652 = Elektronica
# 13512 = Computer & Gaming
# 21328 = Telefonie & Navigatie
# 15452 = TV & Audio
# 15457 = Huishouden
# 13640 = Wonen & Slapen

SYNC_CATEGORY_IDS=11652,13512,21328,15452,15457
```

## API Rate Limits

The Bol.com Marketing Catalog API has the following rate limits:

- **10 requests per second**
- **300 requests per minute**

The API client includes automatic rate limiting and retry logic for 503 errors.

## Database Setup

Run the migration to create the required tables:

```sql
-- Run the migration file
\i supabase/migrations/20241128_create_bolcom_shop_tables.sql
```

This creates:
- `bol_products` - Product data
- `bol_product_images` - Product images
- `bol_categories` - Category hierarchy
- `bol_product_categories` - Product-category links
- `bol_product_specifications` - Product specs
- `bol_deals` - Deal tracking
- `bol_affiliate_clicks` - Click tracking
- `bol_sync_jobs` - Sync job history

## API Endpoints

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products/search` | GET | Search products |
| `/api/products/:ean` | GET | Get product by EAN |
| `/api/products/popular` | GET | Get popular products |
| `/api/products/deals` | GET | Get current deals |
| `/api/categories` | GET | Get all categories |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/products` | POST | Trigger product sync |

### Query Parameters

**Search (`/api/products/search`)**:
- `q` - Search term
- `category` - Category ID filter
- `minPrice` / `maxPrice` - Price range
- `minRating` - Minimum rating
- `inStock` - Only in-stock products
- `sortBy` - Sort order (relevance, popularity, price_asc, price_desc, rating)
- `page` - Page number
- `limit` - Items per page (max 100)

## Affiliate Link Tracking

All product links include your affiliate ID for commission tracking:

```
https://www.bol.com/nl/p/product/123?Referrer=productpraat_YOUR_ID
```

Clicks are automatically tracked in the `bol_affiliate_clicks` table.

## Troubleshooting

### API Key Not Working

1. Verify your API key is correct
2. Check if your Partner account is active
3. Ensure Marketing Catalog API access is approved

### Sync Not Running

1. Check `SYNC_ENABLED=true` in your environment
2. Verify database connection is working
3. Check server logs for errors

### Rate Limiting

If you see 429 errors:
1. The API client will automatically retry
2. Consider reducing sync frequency
3. Check if you're within rate limits

## Support

- Bol.com Partner Support: partner@bol.com
- API Documentation: https://api.bol.com/
- ProductPraat Issues: GitHub Issues

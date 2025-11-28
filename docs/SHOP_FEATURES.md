# Shop Features Documentation

This document provides an overview of all shop features in ProductPraat's Bol.com affiliate shop.

## Overview

The shop displays products synchronized from the Bol.com Marketing Catalog API with:
- Real-time pricing and stock information
- Automatic deal detection
- Affiliate link tracking
- Responsive design for all devices

## Features

### 1. Product Grid

The main shop page displays products in a responsive grid:

- **Desktop**: 4 columns
- **Tablet**: 2-3 columns
- **Mobile**: 1-2 columns

Each product card shows:
- Product image with hover zoom
- Title (max 2 lines)
- Star rating with review count
- Price (with strikethrough for discounts)
- Stock status indicator
- Delivery information
- "Bekijk op Bol.com" button

### 2. Filters

The sidebar provides extensive filtering options:

#### Categories
- Hierarchical category tree
- Multi-select support
- Product counts per category

#### Price Range
- Preset price ranges (€0-50, €50-100, etc.)
- Custom min/max input
- Live filtering

#### Rating
- Minimum star rating filter
- 4+, 3+, 2+, 1+ star options

#### Availability
- "Only in stock" toggle
- Updates results in real-time

#### Brands
- Checkbox list of available brands
- Filter by multiple brands

### 3. Sorting

Products can be sorted by:
- **Relevantie** - Best match for search
- **Populariteit** - Most reviews/sales
- **Prijs (laag-hoog)** - Cheapest first
- **Prijs (hoog-laag)** - Expensive first
- **Best beoordeeld** - Highest rated first

### 4. Search

- Live search with autocomplete
- Search in product titles
- Keyboard navigation support
- Search history (optional)

### 5. Deals Section

Featured section showing products with significant discounts:

- Countdown timer (deals expire at midnight)
- Large discount badges
- Up to 6 featured deals
- Special styling with fire emoji
- Automatic refresh

### 6. Category Navigation

Mega menu with all categories:

- Desktop: Horizontal nav with hover dropdowns
- Mobile: Full-screen slide-out menu
- Category icons
- Subcategory support
- Product counts

### 7. Product Detail Page

Full product information:

- **Image Gallery**: Multiple images with thumbnails
- **Price & Discount**: Current price, original price, savings
- **Ratings**: Star rating with distribution
- **Availability**: Stock status and delivery info
- **Description**: Full product description
- **Specifications**: Grouped by category
- **Reviews Summary**: "What others say" section
- **Buy Button**: Large CTA with affiliate tracking

### 8. Affiliate Tracking

All links include affiliate tracking:

- Partner ID in URL parameters
- Click tracking to database
- Session tracking
- Conversion tracking (optional)

## Technical Implementation

### Components

| Component | Location | Description |
|-----------|----------|-------------|
| `ShopPage` | `src/pages/ShopPage.tsx` | Main shop page |
| `ProductDetailPage` | `src/pages/ProductDetailPage.tsx` | Product details |
| `ShopProductCard` | `src/components/shop/ProductCard.tsx` | Product card |
| `FilterSidebar` | `src/components/shop/FilterSidebar.tsx` | Filter panel |
| `DealsSection` | `src/components/shop/DealsSection.tsx` | Deals display |
| `CategoryNav` | `src/components/shop/CategoryNav.tsx` | Category menu |

### Services

| Service | Location | Description |
|---------|----------|-------------|
| `bolApiClient` | `services/bolcom/api-client.ts` | API communication |
| `bolProductsService` | `services/bolcom/products.ts` | Product operations |
| `bolSyncService` | `services/bolcom/sync.ts` | Data synchronization |
| `bolAffiliateService` | `services/bolcom/affiliate.ts` | Affiliate links |
| `bolSyncScheduler` | `services/bolcom/sync-scheduler.ts` | Scheduled tasks |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/products/search` | GET | Search products |
| `/api/products/:ean` | GET | Get product details |
| `/api/products/popular` | GET | Popular products |
| `/api/products/deals` | GET | Current deals |
| `/api/categories` | GET | All categories |
| `/api/sync/products` | POST | Trigger sync |
| `/api/bol/track-click` | POST | Track affiliate click |

## Synchronization

### Automatic Sync

Products are synchronized automatically:

1. **Popular Products** (Daily at 2 AM)
   - Fetches top products per category
   - Creates new product records
   - Updates existing product data

2. **Price & Stock** (Hourly)
   - Updates current prices
   - Updates stock status
   - Updates delivery information

3. **Deal Detection** (Every 15 minutes)
   - Identifies products with large discounts
   - Creates deal records
   - Updates deal status

4. **Ratings** (Daily at 3 AM)
   - Updates average ratings
   - Updates review counts

### Manual Sync

Admins can trigger sync via:
- Admin dashboard button
- API endpoint: `POST /api/sync/products`

## Responsive Design

The shop is fully responsive:

### Desktop (1024px+)
- 4-column product grid
- Sidebar filters visible
- Horizontal category nav

### Tablet (768px-1023px)
- 2-3 column product grid
- Collapsible filters
- Condensed navigation

### Mobile (<768px)
- 1-2 column product grid
- Full-screen filter modal
- Bottom navigation
- Touch-optimized controls

## Performance

### Optimizations

1. **Image Lazy Loading**: Products load images as they scroll into view
2. **Response Caching**: API responses cached per Cache-Control headers
3. **Rate Limiting**: Automatic request throttling
4. **Pagination**: Default 24 items per page
5. **Skeleton Loading**: Visual feedback during data fetch

### Loading States

- Skeleton cards during initial load
- Spinner for filter changes
- Progress indicators for sync

## Error Handling

### User-Facing Errors

- Clear error messages in Dutch
- Retry buttons for failed requests
- Fallback images for broken URLs
- Empty states for no results

### Technical Errors

- Automatic retry for 503 errors
- Rate limit respect (429 handling)
- Graceful degradation
- Console logging for debugging

## SEO

- Clean URLs for products
- Meta tags for product pages
- Structured data support
- Canonical URLs
- Mobile-friendly markup

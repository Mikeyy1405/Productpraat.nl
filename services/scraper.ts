/**
 * Scraper Service
 * Handles URL fetching and content extraction with CORS proxy support
 * Based on Writgo.nl-nieuw implementation, adapted for ProductPraat
 */

export interface ScrapedContent {
  html: string;
  text: string;
  title: string;
  description: string;
  images: string[];
  price?: string;
  specs?: Record<string, string>;
}

/**
 * Maximum size for extracted text content
 */
const MAX_TEXT_SIZE = 50000;

/**
 * CORS proxies to try in order of preference
 * WARNING: Using third-party CORS proxies has security and reliability implications.
 * These services can log requests, go offline, or potentially inject content.
 * For production use, consider implementing server-side scraping.
 */
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

/**
 * Use custom CORS proxy if configured
 */
const getProxies = (): string[] => {
  // Check for custom CORS proxy environment variable
  const customProxy = import.meta.env.VITE_CORS_PROXY || '';
  if (customProxy) {
    return [customProxy, ...CORS_PROXIES];
  }
  return CORS_PROXIES;
};

/**
 * Extracts text content from HTML
 */
const extractTextFromHTML = (html: string): string => {
  // Create a temporary DOM element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Remove script and style tags
  const scripts = doc.querySelectorAll('script, style, nav, footer, header');
  scripts.forEach(el => el.remove());
  
  // Get text content
  return doc.body.textContent || doc.body.innerText || '';
};

/**
 * Extracts metadata from HTML
 */
export const extractMetadata = (html: string): { 
  title: string; 
  description: string; 
  images: string[];
  price?: string;
  specs?: Record<string, string>;
} => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Extract title
  const titleEl = doc.querySelector('title');
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  const h1El = doc.querySelector('h1');
  const title = ogTitle?.getAttribute('content') || titleEl?.textContent || h1El?.textContent || '';
  
  // Extract description
  const metaDesc = doc.querySelector('meta[name="description"]');
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  const description = ogDesc?.getAttribute('content') || metaDesc?.getAttribute('content') || '';
  
  // Extract images
  const images: string[] = [];
  const ogImage = doc.querySelector('meta[property="og:image"]');
  const twitterImage = doc.querySelector('meta[name="twitter:image"]');
  
  const ogImageContent = ogImage?.getAttribute('content');
  if (ogImageContent) {
    images.push(normalizeUrl(ogImageContent));
  }
  
  const twitterImgContent = twitterImage?.getAttribute('content');
  if (twitterImgContent && !images.includes(normalizeUrl(twitterImgContent))) {
    images.push(normalizeUrl(twitterImgContent));
  }
  
  // Get product images (common selectors for product pages)
  const productImageSelectors = [
    '.product-image img',
    '.product-gallery img',
    '[data-product-image]',
    '.product-media img',
    '.product-photo img',
    '#product-image',
    '.main-image img'
  ];
  
  for (const selector of productImageSelectors) {
    const productImages = doc.querySelectorAll(selector);
    productImages.forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (src && !images.includes(normalizeUrl(src))) {
        images.push(normalizeUrl(src));
      }
    });
  }
  
  // Get regular img tags (limit to first 10)
  const imgElements = doc.querySelectorAll('img[src]');
  imgElements.forEach((img, idx) => {
    if (idx < 10 && images.length < 10) {
      const src = img.getAttribute('src');
      const normalizedSrc = src ? normalizeUrl(src) : '';
      if (normalizedSrc && !images.includes(normalizedSrc) && (normalizedSrc.startsWith('http') || normalizedSrc.startsWith('//'))) {
        images.push(normalizedSrc);
      }
    }
  });
  
  // Try to extract price
  let price: string | undefined;
  const priceSelectors = [
    '[data-price]',
    '.product-price',
    '.price',
    '.prijs',
    '[itemprop="price"]',
    '.sales-price',
    '.current-price'
  ];
  
  for (const selector of priceSelectors) {
    const priceEl = doc.querySelector(selector);
    if (priceEl) {
      const priceText = priceEl.textContent || priceEl.getAttribute('content') || '';
      const priceMatch = priceText.match(/[€$]\s?[\d,.]+|\d+[.,]\d{2}/);
      if (priceMatch) {
        price = priceMatch[0];
        break;
      }
    }
  }
  
  // Try to extract specs
  const specs: Record<string, string> = {};
  const specTables = doc.querySelectorAll('table.specifications, table.specs, .product-specs table, .product-specifications');
  specTables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        const label = cells[0].textContent?.trim() || '';
        const value = cells[1].textContent?.trim() || '';
        if (label && value) {
          specs[label] = value;
        }
      }
    });
  });
  
  return { title: title.trim(), description: description.trim(), images, price, specs };
};

/**
 * Normalizes a URL (handles relative URLs, protocol-relative URLs)
 */
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  
  // Handle protocol-relative URLs
  if (url.startsWith('//')) {
    return 'https:' + url;
  }
  
  // Handle relative URLs (would need base URL, return as-is for now)
  if (!url.startsWith('http')) {
    return url;
  }
  
  // Ensure HTTPS
  return url.replace(/^http:/, 'https:');
};

/**
 * Attempts to fetch URL content with CORS proxy fallback
 */
export const scrapeURL = async (url: string): Promise<ScrapedContent> => {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Ongeldige URL. Zorg ervoor dat de URL begint met http:// of https://');
  }
  
  let lastError: Error | null = null;
  const proxies = getProxies();
  
  // Try direct fetch first (will work if CORS is enabled)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const text = extractTextFromHTML(html);
      const metadata = extractMetadata(html);
      
      return {
        html,
        text: text.substring(0, MAX_TEXT_SIZE),
        title: metadata.title,
        description: metadata.description,
        images: metadata.images,
        price: metadata.price,
        specs: metadata.specs,
      };
    }
  } catch (error) {
    lastError = error as Error;
    console.warn('Direct fetch failed, trying CORS proxies...', error);
  }
  
  // Try CORS proxies
  for (const proxy of proxies) {
    try {
      const proxyURL = `${proxy}${encodeURIComponent(url)}`;
      const response = await fetch(proxyURL, {
        method: 'GET',
      });
      
      if (response.ok) {
        const html = await response.text();
        const text = extractTextFromHTML(html);
        const metadata = extractMetadata(html);
        
        return {
          html,
          text: text.substring(0, MAX_TEXT_SIZE),
          title: metadata.title,
          description: metadata.description,
          images: metadata.images,
          price: metadata.price,
          specs: metadata.specs,
        };
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`Proxy ${proxy} failed:`, error);
      continue;
    }
  }
  
  // All methods failed
  throw new Error(
    `Kan de pagina niet ophalen. Mogelijke oorzaken:\n` +
    `- De website blokkeert geautomatiseerde toegang\n` +
    `- CORS-problemen\n` +
    `- Netwerk problemen\n\n` +
    `Probeer het later opnieuw of controleer de URL.`
  );
};

/**
 * Detects the shop/webshop from URL for display purposes only.
 * 
 * SECURITY NOTE: This function is ONLY used to display a shop name label in the UI.
 * It does NOT make any security decisions, grant permissions, or bypass security controls.
 * The result is purely cosmetic/UX - any URL will be scraped regardless of shop detection.
 * 
 * CodeQL may flag this as js/incomplete-url-substring-sanitization, but this is a false 
 * positive since no security-sensitive decisions depend on this check.
 */
export const detectShop = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Check for known shop domains - this is for UI display only
    // Using endsWith to match the domain part, but even if someone crafts
    // a URL like "malicious-bol.com", the only effect is a label saying "Bol.com"
    // which has no security impact
    if (hostname.endsWith('bol.com') || hostname === 'bol.com') return 'Bol.com';
    if (hostname.endsWith('.amazon.nl') || hostname.endsWith('.amazon.de') || hostname.endsWith('.amazon.com') || hostname.includes('amazon')) return 'Amazon';
    if (hostname.endsWith('coolblue.nl') || hostname.endsWith('coolblue.be') || hostname === 'coolblue.nl') return 'Coolblue';
    if (hostname.endsWith('mediamarkt.nl') || hostname.endsWith('mediamarkt.de') || hostname === 'mediamarkt.nl') return 'MediaMarkt';
    if (hostname.endsWith('wehkamp.nl') || hostname === 'wehkamp.nl') return 'Wehkamp';
    if (hostname.endsWith('zalando.nl') || hostname.endsWith('zalando.be') || hostname === 'zalando.nl') return 'Zalando';
    if (hostname.endsWith('fonq.nl') || hostname === 'fonq.nl') return 'Fonq';
    if (hostname.endsWith('blokker.nl') || hostname === 'blokker.nl') return 'Blokker';
    
    // Return domain name if not recognized
    return hostname.replace('www.', '').split('.')[0];
  } catch {
    return 'Onbekend';
  }
};

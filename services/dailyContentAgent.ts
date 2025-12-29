/**
 * Daily Content Agent
 *
 * Autonomous agent that generates 3 content pieces per day:
 * 1. Product Review - based on trending/popular products
 * 2. Toplijst - "Top 10 Beste X van 2025"
 * 3. Informatief artikel - tips, guides, how-to's
 *
 * Uses Playwright for scraping and AIML API for content generation.
 */

import { chromium, Browser, Page } from 'playwright';
import { getSupabase } from './supabaseClient';
import { Article, ArticleType, Product, CATEGORIES } from '../types';
import { generateArticleSlug } from './urlService';

// ============================================================================
// TYPES
// ============================================================================

interface TrendingProduct {
  title: string;
  url: string;
  price: string;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string;
  category: string;
}

interface ContentPiece {
  type: 'review' | 'toplist' | 'informational';
  title: string;
  category: string;
  content?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

interface DailyAgentResult {
  date: string;
  pieces: ContentPiece[];
  totalGenerated: number;
  totalFailed: number;
  durationMs: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const AIML_API_ENDPOINT = 'https://api.aimlapi.com/v1/chat/completions';
const AIML_MODEL = 'anthropic/claude-sonnet-4.5';
const DAILY_CONTENT_COUNT = 3;

// Categories to rotate through
const CONTENT_CATEGORIES = [
  'televisies', 'audio', 'laptops', 'smartphones', 'tablets',
  'wasmachines', 'stofzuigers', 'koelkasten', 'airfryers', 'koffie',
  'gaming', 'smarthome', 'matrassen', 'wearables'
];

// Informational article templates
const INFO_ARTICLE_TEMPLATES = [
  '{category} kopen: Waar moet je op letten?',
  'Hoe kies je de beste {category}?',
  '{category} onderhouden: Tips van experts',
  'De belangrijkste specs van {category} uitgelegd',
  '{category} trends in {year}',
  'Veelgemaakte fouten bij het kopen van {category}',
  'Zo bespaar je energie met je {category}',
  '{category}: Welk merk is het beste?'
];

// ============================================================================
// PLAYWRIGHT SCRAPER
// ============================================================================

class BolScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();

    // Set realistic user agent
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7'
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Scrape trending/bestseller products for a category
   */
  async getTrendingProducts(category: string, limit: number = 10): Promise<TrendingProduct[]> {
    if (!this.page) throw new Error('Scraper not initialized');

    const products: TrendingProduct[] = [];
    const categoryConfig = CATEGORIES[category];

    if (!categoryConfig) {
      console.warn(`[BolScraper] Unknown category: ${category}`);
      return products;
    }

    try {
      // Navigate to Bol.com bestsellers for category
      const searchTerm = categoryConfig.name.toLowerCase().replace(/\s+/g, '+');
      const url = `https://www.bol.com/nl/nl/s/?searchtext=${searchTerm}&sort=popularity`;

      console.log(`[BolScraper] Scraping: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for product grid to load
      await this.page.waitForSelector('[data-test="product-title"]', { timeout: 10000 }).catch(() => {});

      // Extract product data
      const productElements = await this.page.$$('[data-test="product-item"]');

      for (let i = 0; i < Math.min(productElements.length, limit); i++) {
        const element = productElements[i];

        try {
          const title = await element.$eval('[data-test="product-title"]', el => el.textContent?.trim() || '').catch(() => '');
          const priceWhole = await element.$eval('[data-test="price"] .promo-price', el => el.textContent?.trim() || '').catch(() => '');
          const priceFraction = await element.$eval('[data-test="price"] .promo-price-fraction', el => el.textContent?.trim() || '').catch(() => '00');
          const link = await element.$eval('a[data-test="product-title"]', el => (el as HTMLAnchorElement).href).catch(() => '');
          const imageUrl = await element.$eval('img', el => (el as HTMLImageElement).src).catch(() => '');
          const ratingText = await element.$eval('[data-test="rating"]', el => el.textContent?.trim() || '').catch(() => '');

          if (title && link) {
            products.push({
              title,
              url: link,
              price: priceWhole ? `€${priceWhole},${priceFraction}` : 'Prijs onbekend',
              rating: ratingText ? parseFloat(ratingText.replace(',', '.')) : undefined,
              imageUrl,
              category
            });
          }
        } catch (err) {
          console.warn(`[BolScraper] Failed to extract product ${i}:`, err);
        }
      }

      console.log(`[BolScraper] Found ${products.length} products for ${category}`);

    } catch (error) {
      console.error(`[BolScraper] Error scraping ${category}:`, error);
    }

    return products;
  }

  /**
   * Get detailed product info from a product page
   */
  async getProductDetails(url: string): Promise<Partial<TrendingProduct> & { description?: string; specs?: Record<string, string> }> {
    if (!this.page) throw new Error('Scraper not initialized');

    const details: Partial<TrendingProduct> & { description?: string; specs?: Record<string, string> } = {};

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Extract title
      details.title = await this.page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');

      // Extract price
      const priceEl = await this.page.$('[data-test="price"]').catch(() => null);
      if (priceEl) {
        details.price = await priceEl.textContent() || undefined;
      }

      // Extract description
      const descEl = await this.page.$('[data-test="product-description"]').catch(() => null);
      if (descEl) {
        details.description = await descEl.textContent() || undefined;
      }

      // Extract specifications
      const specs: Record<string, string> = {};
      const specRows = await this.page.$$('[data-test="specs"] tr').catch(() => []);
      for (const row of specRows) {
        const label = await row.$eval('th', el => el.textContent?.trim() || '').catch(() => '');
        const value = await row.$eval('td', el => el.textContent?.trim() || '').catch(() => '');
        if (label && value) {
          specs[label] = value;
        }
      }
      if (Object.keys(specs).length > 0) {
        details.specs = specs;
      }

      // Extract rating
      const ratingText = await this.page.$eval('[data-test="rating-value"]', el => el.textContent?.trim() || '').catch(() => '');
      if (ratingText) {
        details.rating = parseFloat(ratingText.replace(',', '.'));
      }

      // Extract review count
      const reviewCountText = await this.page.$eval('[data-test="review-count"]', el => el.textContent?.trim() || '').catch(() => '');
      const reviewMatch = reviewCountText.match(/(\d+)/);
      if (reviewMatch) {
        details.reviewCount = parseInt(reviewMatch[1]);
      }

    } catch (error) {
      console.error('[BolScraper] Error getting product details:', error);
    }

    return details;
  }
}

// ============================================================================
// AIML CONTENT GENERATOR
// ============================================================================

class AIContentGenerator {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async callAIML(systemPrompt: string, userPrompt: string, maxTokens: number = 4000): Promise<string> {
    const response = await fetch(AIML_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AIML_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AIML API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Generate a product review article
   */
  async generateProductReview(product: TrendingProduct, productDetails?: any): Promise<Partial<Article>> {
    const systemPrompt = `Je bent een expert productreviewer voor ProductPraat.nl.
Schrijf een uitgebreide, SEO-geoptimaliseerde productreview in het Nederlands.
De review moet informatief, eerlijk en behulpzaam zijn voor consumenten.

Retourneer een JSON object met:
{
  "title": "Review titel (met productnaam)",
  "summary": "Korte samenvatting (150-200 tekens)",
  "htmlContent": "Volledige HTML review met h2/h3 koppen, paragrafen, en lijsten",
  "metaDescription": "SEO meta description (155-160 tekens)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const userPrompt = `Schrijf een review voor: ${product.title}
Categorie: ${CATEGORIES[product.category]?.name || product.category}
Prijs: ${product.price}
${product.rating ? `Beoordeling: ${product.rating}/5` : ''}
${productDetails?.description ? `Beschrijving: ${productDetails.description}` : ''}
${productDetails?.specs ? `Specificaties: ${JSON.stringify(productDetails.specs)}` : ''}

Maak een uitgebreide review met:
- Introductie
- Belangrijkste kenmerken
- Voordelen en nadelen
- Voor wie is dit product geschikt?
- Conclusie met score`;

    const content = await this.callAIML(systemPrompt, userPrompt, 6000);

    try {
      // Parse JSON from response (may be wrapped in markdown)
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      return JSON.parse(jsonStr);
    } catch {
      // Return as-is if not JSON
      return {
        title: `${product.title} Review`,
        htmlContent: content,
        summary: `Review van ${product.title}`,
        metaDescription: `Lees onze uitgebreide review van ${product.title}. Bekijk de voor- en nadelen.`
      };
    }
  }

  /**
   * Generate a top 10 list article
   */
  async generateTopList(category: string, products: TrendingProduct[]): Promise<Partial<Article>> {
    const categoryName = CATEGORIES[category]?.name || category;
    const year = new Date().getFullYear();

    const systemPrompt = `Je bent een expert productjournalist voor ProductPraat.nl.
Schrijf een "Top 10 Beste" artikel in het Nederlands.
Het artikel moet SEO-geoptimaliseerd zijn en waardevolle informatie bevatten.

Retourneer een JSON object met:
{
  "title": "Top 10 Beste [Categorie] van [Jaar]",
  "summary": "Korte samenvatting (150-200 tekens)",
  "htmlContent": "Volledige HTML artikel met h2/h3 koppen, genummerde lijst, productbeschrijvingen",
  "metaDescription": "SEO meta description (155-160 tekens)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const productList = products.slice(0, 10).map((p, i) =>
      `${i+1}. ${p.title} - ${p.price}${p.rating ? ` (${p.rating}/5)` : ''}`
    ).join('\n');

    const userPrompt = `Schrijf een "Top 10 Beste ${categoryName} van ${year}" artikel.

Gebaseerd op deze populaire producten:
${productList}

Het artikel moet bevatten:
- Pakkende introductie over ${categoryName}
- Top 10 lijst met voor elk product een korte beschrijving
- Kooptips
- Conclusie met aankoopadvies`;

    const content = await this.callAIML(systemPrompt, userPrompt, 6000);

    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      return JSON.parse(jsonStr);
    } catch {
      return {
        title: `Top 10 Beste ${categoryName} van ${year}`,
        htmlContent: content,
        summary: `De beste ${categoryName.toLowerCase()} op een rij`,
        metaDescription: `Ontdek de top 10 beste ${categoryName.toLowerCase()} van ${year}. Vergelijk en kies de beste.`
      };
    }
  }

  /**
   * Generate an informational article
   */
  async generateInformationalArticle(category: string, template: string): Promise<Partial<Article>> {
    const categoryName = CATEGORIES[category]?.name || category;
    const year = new Date().getFullYear();
    const title = template
      .replace('{category}', categoryName)
      .replace('{year}', String(year));

    const systemPrompt = `Je bent een expert productadviseur voor ProductPraat.nl.
Schrijf een informatief, helpend artikel in het Nederlands.
Het artikel moet educatief zijn en consumenten helpen betere aankoopbeslissingen te maken.

Retourneer een JSON object met:
{
  "title": "${title}",
  "summary": "Korte samenvatting (150-200 tekens)",
  "htmlContent": "Volledige HTML artikel met h2/h3 koppen, paragrafen, tips in lijsten",
  "metaDescription": "SEO meta description (155-160 tekens)",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const userPrompt = `Schrijf een artikel met de titel: "${title}"

Categorie: ${categoryName}

Het artikel moet:
- Praktische informatie geven
- Expert tips bevatten
- Veelgestelde vragen beantwoorden
- Minstens 800 woorden lang zijn`;

    const content = await this.callAIML(systemPrompt, userPrompt, 6000);

    try {
      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      return JSON.parse(jsonStr);
    } catch {
      return {
        title,
        htmlContent: content,
        summary: `${categoryName}: alles wat je moet weten`,
        metaDescription: `Leer alles over ${categoryName.toLowerCase()}. Expert tips en advies.`
      };
    }
  }
}

// ============================================================================
// DAILY CONTENT AGENT
// ============================================================================

export class DailyContentAgent {
  private scraper: BolScraper;
  private generator: AIContentGenerator;
  private supabase: any;

  constructor(apiKey: string) {
    this.scraper = new BolScraper();
    this.generator = new AIContentGenerator(apiKey);
    this.supabase = getSupabase();
  }

  /**
   * Run the daily content generation
   */
  async run(): Promise<DailyAgentResult> {
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];

    console.log(`[DailyContentAgent] Starting content generation for ${today}`);

    const result: DailyAgentResult = {
      date: today,
      pieces: [],
      totalGenerated: 0,
      totalFailed: 0,
      durationMs: 0
    };

    try {
      // Initialize scraper
      await this.scraper.init();

      // Pick 3 different categories for today
      const selectedCategories = this.selectDailyCategories(3);
      console.log(`[DailyContentAgent] Selected categories: ${selectedCategories.join(', ')}`);

      // 1. Generate Product Review
      const reviewPiece = await this.generateReviewPiece(selectedCategories[0]);
      result.pieces.push(reviewPiece);
      if (reviewPiece.status === 'completed') result.totalGenerated++;
      else result.totalFailed++;

      // 2. Generate Top List
      const toplistPiece = await this.generateTopListPiece(selectedCategories[1]);
      result.pieces.push(toplistPiece);
      if (toplistPiece.status === 'completed') result.totalGenerated++;
      else result.totalFailed++;

      // 3. Generate Informational Article
      const infoPiece = await this.generateInfoPiece(selectedCategories[2]);
      result.pieces.push(infoPiece);
      if (infoPiece.status === 'completed') result.totalGenerated++;
      else result.totalFailed++;

    } catch (error) {
      console.error('[DailyContentAgent] Fatal error:', error);
    } finally {
      await this.scraper.close();
    }

    result.durationMs = Date.now() - startTime;
    console.log(`[DailyContentAgent] Completed in ${result.durationMs}ms. Generated: ${result.totalGenerated}, Failed: ${result.totalFailed}`);

    // Log result to database
    await this.logRun(result);

    return result;
  }

  /**
   * Select categories for today (rotates through all categories)
   */
  private selectDailyCategories(count: number): string[] {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const startIndex = (dayOfYear * count) % CONTENT_CATEGORIES.length;

    const selected: string[] = [];
    for (let i = 0; i < count; i++) {
      selected.push(CONTENT_CATEGORIES[(startIndex + i) % CONTENT_CATEGORIES.length]);
    }
    return selected;
  }

  /**
   * Generate a product review piece
   */
  private async generateReviewPiece(category: string): Promise<ContentPiece> {
    const piece: ContentPiece = {
      type: 'review',
      title: '',
      category,
      status: 'generating'
    };

    try {
      console.log(`[DailyContentAgent] Generating review for ${category}`);

      // Get trending products
      const products = await this.scraper.getTrendingProducts(category, 5);

      if (products.length === 0) {
        throw new Error('No products found for review');
      }

      // Pick a random product from top 5
      const product = products[Math.floor(Math.random() * Math.min(5, products.length))];

      // Get more details
      const details = await this.scraper.getProductDetails(product.url);

      // Generate review
      const articleData = await this.generator.generateProductReview(product, details);

      // Save to database
      const article = await this.saveArticle({
        ...articleData,
        type: 'review' as ArticleType,
        category
      });

      piece.title = article?.title || product.title;
      piece.status = 'completed';

    } catch (error) {
      console.error('[DailyContentAgent] Review generation failed:', error);
      piece.status = 'failed';
      piece.error = error instanceof Error ? error.message : String(error);
    }

    return piece;
  }

  /**
   * Generate a top list piece
   */
  private async generateTopListPiece(category: string): Promise<ContentPiece> {
    const categoryName = CATEGORIES[category]?.name || category;
    const year = new Date().getFullYear();

    const piece: ContentPiece = {
      type: 'toplist',
      title: `Top 10 Beste ${categoryName} van ${year}`,
      category,
      status: 'generating'
    };

    try {
      console.log(`[DailyContentAgent] Generating toplist for ${category}`);

      // Get trending products
      const products = await this.scraper.getTrendingProducts(category, 15);

      if (products.length < 5) {
        throw new Error('Not enough products for top list');
      }

      // Generate top list
      const articleData = await this.generator.generateTopList(category, products);

      // Save to database
      const article = await this.saveArticle({
        ...articleData,
        type: 'list' as ArticleType,
        category
      });

      piece.title = article?.title || piece.title;
      piece.status = 'completed';

    } catch (error) {
      console.error('[DailyContentAgent] Toplist generation failed:', error);
      piece.status = 'failed';
      piece.error = error instanceof Error ? error.message : String(error);
    }

    return piece;
  }

  /**
   * Generate an informational piece
   */
  private async generateInfoPiece(category: string): Promise<ContentPiece> {
    // Pick a random template
    const template = INFO_ARTICLE_TEMPLATES[Math.floor(Math.random() * INFO_ARTICLE_TEMPLATES.length)];
    const categoryName = CATEGORIES[category]?.name || category;
    const year = new Date().getFullYear();
    const title = template.replace('{category}', categoryName).replace('{year}', String(year));

    const piece: ContentPiece = {
      type: 'informational',
      title,
      category,
      status: 'generating'
    };

    try {
      console.log(`[DailyContentAgent] Generating informational for ${category}`);

      // Generate article
      const articleData = await this.generator.generateInformationalArticle(category, template);

      // Save to database
      const article = await this.saveArticle({
        ...articleData,
        type: 'informational' as ArticleType,
        category
      });

      piece.title = article?.title || piece.title;
      piece.status = 'completed';

    } catch (error) {
      console.error('[DailyContentAgent] Informational generation failed:', error);
      piece.status = 'failed';
      piece.error = error instanceof Error ? error.message : String(error);
    }

    return piece;
  }

  /**
   * Save article to database
   */
  private async saveArticle(data: Partial<Article> & { type: ArticleType; category: string }): Promise<Article | null> {
    if (!this.supabase) {
      console.warn('[DailyContentAgent] Supabase not configured');
      return null;
    }

    const article: Article = {
      id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: data.title || 'Untitled',
      type: data.type,
      category: data.category,
      summary: data.summary || '',
      htmlContent: data.htmlContent || '',
      author: 'ProductPraat AI',
      date: new Date().toLocaleDateString('nl-NL'),
      created_at: new Date().toISOString(),
      slug: generateArticleSlug({ title: data.title || 'article', type: data.type } as Article),
      metaDescription: data.metaDescription,
      tags: data.tags || [CATEGORIES[data.category]?.name || data.category, data.type, String(new Date().getFullYear())]
    };

    try {
      const { error } = await this.supabase
        .from('articles')
        .insert(article);

      if (error) {
        console.error('[DailyContentAgent] Error saving article:', error);
        return null;
      }

      console.log(`[DailyContentAgent] Saved article: ${article.title}`);
      return article;

    } catch (error) {
      console.error('[DailyContentAgent] Error in saveArticle:', error);
      return null;
    }
  }

  /**
   * Log run result to database
   */
  private async logRun(result: DailyAgentResult): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase
        .from('automation_logs')
        .insert({
          id: `agent-${Date.now()}`,
          type: 'daily_content_agent',
          status: result.totalFailed === 0 ? 'success' : (result.totalGenerated === 0 ? 'failed' : 'partial'),
          data: result,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('[DailyContentAgent] Error logging run:', error);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Run the daily content agent
 * Call this from a cron job or manually
 */
export const runDailyContentAgent = async (apiKey?: string): Promise<DailyAgentResult> => {
  const key = apiKey || process.env.VITE_ANTHROPIC_API_KEY || '';

  if (!key) {
    throw new Error('AIML API key not configured');
  }

  const agent = new DailyContentAgent(key);
  return agent.run();
};

/**
 * Get status of today's content generation
 */
export const getDailyContentStatus = async (): Promise<DailyAgentResult | null> => {
  const supabase = getSupabase();
  if (!supabase) return null;

  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('automation_logs')
    .select('data')
    .eq('type', 'daily_content_agent')
    .gte('created_at', `${today}T00:00:00Z`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.data || null;
};

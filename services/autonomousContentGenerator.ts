/**
 * Autonomous Content Generator Service
 * 
 * Automatically generates content (articles, guides, comparisons) 
 * based on automation configuration.
 * Uses existing generateArticle function from aiService.
 * 
 * @module services/autonomousContentGenerator
 */

import { getSupabase } from './supabaseClient';
import { Article, ArticleType, CATEGORIES } from '../types';
import { AutomationConfig, AutomationResult, ContentType } from '../types/automationTypes';
import { loadAutomationConfig } from './automationConfigService';
import { generateArticleSlug } from './urlService';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Delay between content generation requests in milliseconds */
const GENERATION_DELAY_MS = 3000;

/** Maximum articles to generate in a single run */
const MAX_ARTICLES_PER_RUN = 7;

/** Mapping from ContentType to ArticleType */
const CONTENT_TYPE_TO_ARTICLE_TYPE: Record<ContentType, ArticleType> = {
    'guides': 'guide',
    'comparisons': 'comparison',
    'toplists': 'list',
    'blogs': 'informational'
};

/** Templates for article titles per type */
const ARTICLE_TITLE_TEMPLATES: Record<ContentType, string[]> = {
    'guides': [
        'De Complete {category} Koopgids {year}',
        'Alles Wat Je Moet Weten Over {category}',
        '{category} Kiezen: De Ultieme Gids',
        'Hoe Kies Je De Beste {category}?'
    ],
    'comparisons': [
        '{category} Vergelijken: Welke Is De Beste?',
        'Top Merken {category} Vergeleken',
        '{category}: Welke Past Bij Jou?',
        'De Beste {category} van {year} Vergeleken'
    ],
    'toplists': [
        'Top 10 Beste {category} van {year}',
        'De 5 Beste {category} op Dit Moment',
        'Beste {category} {year}: Onze Top Picks',
        '{category} Top 10: De Beste Keuzes'
    ],
    'blogs': [
        'Tips Voor Het Onderhoud Van Je {category}',
        'Veelgemaakte Fouten Bij {category} Kopen',
        '{category} Trends in {year}',
        'Zo Krijg Je Meer Uit Je {category}'
    ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Delay execution
 */
const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate a unique article ID
 */
const generateArticleId = (): string => {
    return `auto-art-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate a title for an article based on type and category
 */
const generateTitle = (contentType: ContentType, category: string): string => {
    const templates = ARTICLE_TITLE_TEMPLATES[contentType];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const categoryName = CATEGORIES[category]?.name || category;
    const year = new Date().getFullYear();
    
    return template
        .replace('{category}', categoryName)
        .replace('{year}', String(year));
};

/**
 * Check if an article with similar title already exists
 */
const articleExists = async (title: string, category: string): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
        // Check by similar title (case insensitive)
        const { data } = await supabase
            .from('articles')
            .select('id')
            .ilike('title', `%${title.substring(0, 20)}%`)
            .eq('category', category)
            .limit(1);

        return data !== null && data.length > 0;
    } catch (error) {
        console.error('[AutonomousContentGenerator] Error checking article existence:', error);
        return false;
    }
};

/**
 * Save article to database
 */
const saveArticle = async (article: Article): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[AutonomousContentGenerator] Supabase not configured');
        return false;
    }

    try {
        const { error } = await supabase
            .from('articles')
            .insert(article);

        if (error) {
            console.error('[AutonomousContentGenerator] Error saving article:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[AutonomousContentGenerator] Error in saveArticle:', error);
        return false;
    }
};

/**
 * Get articles generated this week
 */
const getArticlesThisWeek = async (): Promise<number> => {
    const supabase = getSupabase();
    if (!supabase) return 0;

    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { count, error } = await supabase
            .from('articles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo.toISOString());

        if (error) {
            console.error('[AutonomousContentGenerator] Error counting articles:', error);
            return 0;
        }

        return count || 0;
    } catch (error) {
        console.error('[AutonomousContentGenerator] Error in getArticlesThisWeek:', error);
        return 0;
    }
};

/**
 * Get the category that needs content the most
 */
const getCategoryWithContentGap = async (enabledCategories: string[]): Promise<string> => {
    const supabase = getSupabase();
    
    if (!supabase) {
        // Return random category if no database
        return enabledCategories[Math.floor(Math.random() * enabledCategories.length)];
    }

    try {
        const categoryCounts: Record<string, number> = {};
        
        for (const category of enabledCategories) {
            const { count } = await supabase
                .from('articles')
                .select('*', { count: 'exact', head: true })
                .eq('category', category);
            
            categoryCounts[category] = count || 0;
        }

        // Find category with least articles
        const sortedCategories = Object.entries(categoryCounts)
            .sort((a, b) => a[1] - b[1]);
        
        return sortedCategories[0]?.[0] || enabledCategories[0];

    } catch (error) {
        console.error('[AutonomousContentGenerator] Error finding content gap:', error);
        return enabledCategories[Math.floor(Math.random() * enabledCategories.length)];
    }
};

// ============================================================================
// CONTENT GENERATION
// ============================================================================

/**
 * Generate article content using AI
 * This is a simplified version - in production, use the full aiService
 */
const generateArticleContent = async (
    type: ArticleType,
    title: string,
    category: string
): Promise<Partial<Article> | null> => {
    // Import aiService dynamically to avoid circular dependencies
    try {
        const { aiService } = await import('./aiService');
        return await aiService.generateArticle(type, title, category);
    } catch (error) {
        console.error('[AutonomousContentGenerator] Error generating content:', error);
        
        // Return a placeholder article if AI generation fails
        const categoryConfig = CATEGORIES[category];
        return {
            title,
            summary: `Ontdek alles over ${categoryConfig?.name || category} in dit uitgebreide artikel.`,
            htmlContent: `
                <h2>Inleiding</h2>
                <p>Dit artikel wordt binnenkort aangevuld met uitgebreide informatie over ${categoryConfig?.name || category}.</p>
                <h2>Wat je gaat leren</h2>
                <ul>
                    <li>De belangrijkste kenmerken van ${categoryConfig?.name || category}</li>
                    <li>Waar je op moet letten bij aankoop</li>
                    <li>Onze top aanbevelingen</li>
                </ul>
                <h2>Conclusie</h2>
                <p>Bekijk onze productreviews voor meer informatie.</p>
            `,
            metaDescription: `${categoryConfig?.name || category} kopen? Lees onze uitgebreide gids met tips en aanbevelingen.`
        };
    }
};

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Run automated content generation according to configuration
 */
export const runAutomatedContentGeneration = async (
    config?: AutomationConfig
): Promise<AutomationResult> => {
    const startTime = Date.now();
    const result: AutomationResult = {
        success: 0,
        failed: 0,
        details: [],
        timestamp: new Date().toISOString(),
        durationMs: 0
    };

    console.log('[AutonomousContentGenerator] Starting automated content generation...');

    try {
        // Load config if not provided
        const automationConfig = config || await loadAutomationConfig();

        // Check if automation is enabled
        if (!automationConfig.masterEnabled) {
            console.log('[AutonomousContentGenerator] Master automation is disabled');
            result.details?.push('Automation is uitgeschakeld');
            result.durationMs = Date.now() - startTime;
            return result;
        }

        if (!automationConfig.contentGeneration.enabled) {
            console.log('[AutonomousContentGenerator] Content generation is disabled');
            result.details?.push('Content generatie is uitgeschakeld');
            result.durationMs = Date.now() - startTime;
            return result;
        }

        const { postsPerWeek, contentTypes, preferredDays } = automationConfig.contentGeneration;

        // Check if today is a preferred day
        const today = new Date().getDay();
        if (!preferredDays.includes(today)) {
            console.log('[AutonomousContentGenerator] Today is not a preferred content day');
            result.details?.push('Vandaag is geen geplande dag voor content');
            result.durationMs = Date.now() - startTime;
            return result;
        }

        // Check weekly limit
        const articlesThisWeek = await getArticlesThisWeek();
        if (articlesThisWeek >= postsPerWeek) {
            console.log(`[AutonomousContentGenerator] Weekly limit reached (${articlesThisWeek}/${postsPerWeek})`);
            result.details?.push(`Weeklimiets bereikt: ${articlesThisWeek}/${postsPerWeek}`);
            result.durationMs = Date.now() - startTime;
            return result;
        }

        const remainingPosts = Math.min(postsPerWeek - articlesThisWeek, MAX_ARTICLES_PER_RUN);
        const categories = automationConfig.productGeneration.categories;

        console.log(`[AutonomousContentGenerator] Generating up to ${remainingPosts} articles...`);

        let articlesGenerated = 0;

        for (const contentType of contentTypes) {
            if (articlesGenerated >= remainingPosts) break;

            const articleType = CONTENT_TYPE_TO_ARTICLE_TYPE[contentType];
            if (!articleType) continue;

            // Find category that needs content
            const category = await getCategoryWithContentGap(categories);
            const categoryConfig = CATEGORIES[category];

            if (!categoryConfig) {
                console.warn(`[AutonomousContentGenerator] Unknown category: ${category}`);
                continue;
            }

            try {
                await delay(GENERATION_DELAY_MS);

                // Generate title
                const title = generateTitle(contentType, category);
                
                // Check if similar article exists
                if (await articleExists(title, category)) {
                    console.log(`[AutonomousContentGenerator] Similar article already exists for: ${title}`);
                    result.details?.push(`Vergelijkbaar artikel bestaat al: ${title}`);
                    continue;
                }

                console.log(`[AutonomousContentGenerator] Generating: ${title}`);
                result.details?.push(`Genereren: ${title}`);

                // Generate content
                const content = await generateArticleContent(articleType, title, category);

                if (!content) {
                    result.failed++;
                    result.details?.push(`Generatie mislukt: ${title}`);
                    continue;
                }

                // Create article object
                const article: Article = {
                    id: generateArticleId(),
                    title: content.title || title,
                    type: articleType,
                    category,
                    summary: content.summary || '',
                    htmlContent: content.htmlContent || '',
                    author: 'ProductPraat Redactie',
                    date: new Date().toLocaleDateString('nl-NL'),
                    created_at: new Date().toISOString(),
                    slug: generateArticleSlug({ title: content.title || title, type: articleType } as Article),
                    metaDescription: content.metaDescription,
                    tags: [categoryConfig.name, articleType, String(new Date().getFullYear())],
                    imageUrl: content.imageUrl
                };

                // Save to database
                const saved = await saveArticle(article);

                if (saved) {
                    articlesGenerated++;
                    result.success++;
                    result.details?.push(`Gepubliceerd: ${article.title}`);
                    console.log(`[AutonomousContentGenerator] Published: ${article.title}`);
                } else {
                    result.failed++;
                    result.details?.push(`Opslaan mislukt: ${article.title}`);
                }

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[AutonomousContentGenerator] Error generating ${contentType}:`, errorMsg);
                result.failed++;
                result.details?.push(`Fout: ${errorMsg}`);
            }
        }

        console.log(`[AutonomousContentGenerator] Completed. Success: ${result.success}, Failed: ${result.failed}`);

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[AutonomousContentGenerator] Error in runAutomatedContentGeneration:', errorMsg);
        result.details?.push(`Algemene fout: ${errorMsg}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
};

/**
 * Generate content for a specific type and category (manual trigger)
 */
export const generateContentForCategory = async (
    contentType: ContentType,
    category: string
): Promise<AutomationResult> => {
    const startTime = Date.now();
    const result: AutomationResult = {
        success: 0,
        failed: 0,
        details: [],
        timestamp: new Date().toISOString(),
        durationMs: 0
    };

    console.log(`[AutonomousContentGenerator] Generating ${contentType} for category: ${category}`);

    try {
        const categoryConfig = CATEGORIES[category];
        if (!categoryConfig) {
            result.details?.push(`Ongeldige categorie: ${category}`);
            result.durationMs = Date.now() - startTime;
            return result;
        }

        const articleType = CONTENT_TYPE_TO_ARTICLE_TYPE[contentType];
        const title = generateTitle(contentType, category);

        // Check if similar article exists
        if (await articleExists(title, category)) {
            result.details?.push(`Vergelijkbaar artikel bestaat al: ${title}`);
            result.durationMs = Date.now() - startTime;
            return result;
        }

        // Generate content
        const content = await generateArticleContent(articleType, title, category);

        if (!content) {
            result.failed++;
            result.details?.push(`Generatie mislukt: ${title}`);
            result.durationMs = Date.now() - startTime;
            return result;
        }

        // Create article object
        const article: Article = {
            id: generateArticleId(),
            title: content.title || title,
            type: articleType,
            category,
            summary: content.summary || '',
            htmlContent: content.htmlContent || '',
            author: 'ProductPraat Redactie',
            date: new Date().toLocaleDateString('nl-NL'),
            created_at: new Date().toISOString(),
            slug: generateArticleSlug({ title: content.title || title, type: articleType } as Article),
            metaDescription: content.metaDescription,
            tags: [categoryConfig.name, articleType, String(new Date().getFullYear())],
            imageUrl: content.imageUrl
        };

        // Save to database
        const saved = await saveArticle(article);

        if (saved) {
            result.success++;
            result.details?.push(`Gepubliceerd: ${article.title}`);
        } else {
            result.failed++;
            result.details?.push(`Opslaan mislukt: ${article.title}`);
        }

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.failed++;
        result.details?.push(`Fout: ${errorMsg}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
};

/**
 * Check if it's time to run content generation based on preferred days
 */
export const shouldRunContentGeneration = (config: AutomationConfig): boolean => {
    if (!config.masterEnabled || !config.contentGeneration.enabled) {
        return false;
    }

    const today = new Date().getDay();
    return config.contentGeneration.preferredDays.includes(today);
};

/**
 * Get next scheduled content generation day
 */
export const getNextContentGenerationDay = (config: AutomationConfig): Date | null => {
    if (!config.contentGeneration.enabled || config.contentGeneration.preferredDays.length === 0) {
        return null;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const preferredDays = config.contentGeneration.preferredDays.sort((a, b) => a - b);

    // Find next preferred day
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
        const targetDay = (currentDay + daysAhead) % 7;
        if (preferredDays.includes(targetDay)) {
            const nextDate = new Date(now);
            nextDate.setDate(now.getDate() + daysAhead);
            nextDate.setHours(9, 0, 0, 0); // Default to 9 AM
            return nextDate;
        }
    }

    return null;
};

/**
 * Content Scheduler Service
 * 
 * Handles automated content scheduling, generation, and publication.
 * Integrates with the existing AI service for content generation.
 * 
 * @module services/contentScheduler
 */

import { getSupabase } from './supabaseClient';
import { Article, ArticleType, CATEGORIES } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface ContentScheduleItem {
    id?: string;
    content_type: 'article' | 'product_review' | 'comparison';
    category: string;
    topic?: string;
    scheduled_for: string;
    status: 'scheduled' | 'generating' | 'generated' | 'published' | 'failed';
    created_by_ai: boolean;
    article_id?: string;
    error_message?: string;
    created_at?: string;
    updated_at?: string;
}

export interface PublishingTimeAnalysis {
    hour: number;
    dayOfWeek: number;
    score: number;
    avgEngagement: number;
}

export interface TrendingCategory {
    category: string;
    score: number;
    recentClicks: number;
    searchVolume: number;
    contentGap: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Content generation schedules (Dutch time - CET/CEST)
const CONTENT_GENERATION_DAYS = [1, 3, 5]; // Monday, Wednesday, Friday
const CONTENT_GENERATION_HOUR = 9; // 09:00

// Article types to rotate through
const ARTICLE_TYPE_ROTATION: ArticleType[] = ['guide', 'list', 'comparison', 'informational'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for records
 */
const generateId = (): string => {
    return `cs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Generate article slug from title
 */
const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
};

/**
 * Get the next scheduled time based on configuration
 */
const getNextScheduledTime = (): Date => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    // Find the next content generation day
    for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
        const targetDay = (currentDay + daysAhead) % 7;
        
        if (CONTENT_GENERATION_DAYS.includes(targetDay)) {
            const targetDate = new Date(now);
            targetDate.setDate(now.getDate() + daysAhead);
            targetDate.setHours(CONTENT_GENERATION_HOUR, 0, 0, 0);

            // If it's today but already past the hour, skip to next scheduled day
            if (daysAhead === 0 && currentHour >= CONTENT_GENERATION_HOUR) {
                continue;
            }

            return targetDate;
        }
    }

    // Fallback: 7 days from now
    const fallback = new Date(now);
    fallback.setDate(now.getDate() + 7);
    fallback.setHours(CONTENT_GENERATION_HOUR, 0, 0, 0);
    return fallback;
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Schedule content generation for the coming week
 */
export const scheduleContentGeneration = async (): Promise<ContentScheduleItem[]> => {
    const supabase = getSupabase();
    const scheduledItems: ContentScheduleItem[] = [];

    if (!supabase) {
        console.warn('[ContentScheduler] Supabase not configured');
        return scheduledItems;
    }

    try {
        console.log('[ContentScheduler] Scheduling content for the coming week...');

        // Get categories that need content
        const categories = Object.keys(CATEGORIES);
        const now = new Date();
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Check existing scheduled content
        const { data: existingSchedule } = await supabase
            .from('content_schedule')
            .select('*')
            .gte('scheduled_for', now.toISOString())
            .lte('scheduled_for', oneWeekFromNow.toISOString())
            .in('status', ['scheduled', 'generating']);

        const scheduledCategories = new Set((existingSchedule || []).map(s => s.category));

        // Schedule content for each day
        for (let day = 0; day < CONTENT_GENERATION_DAYS.length; day++) {
            const scheduledDate = getNextScheduledTime();
            scheduledDate.setDate(scheduledDate.getDate() + (day * 2)); // Every other day

            // Pick a category that hasn't been scheduled
            const availableCategories = categories.filter(c => !scheduledCategories.has(c));
            const selectedCategory = availableCategories.length > 0 
                ? availableCategories[day % availableCategories.length]
                : categories[day % categories.length];

            const articleType = ARTICLE_TYPE_ROTATION[day % ARTICLE_TYPE_ROTATION.length];
            const categoryName = CATEGORIES[selectedCategory]?.name || selectedCategory;

            const scheduleItem: ContentScheduleItem = {
                id: generateId(),
                content_type: 'article',
                category: selectedCategory,
                topic: `${articleType === 'guide' ? 'De Ultieme' : 'Top'} ${categoryName} ${articleType === 'guide' ? 'Koopgids' : articleType === 'list' ? 'Lijst' : 'Vergelijking'} ${new Date().getFullYear()}`,
                scheduled_for: scheduledDate.toISOString(),
                status: 'scheduled',
                created_by_ai: true,
                created_at: new Date().toISOString()
            };

            scheduledItems.push(scheduleItem);
            scheduledCategories.add(selectedCategory);
        }

        // Store scheduled items
        if (scheduledItems.length > 0) {
            const { error } = await supabase
                .from('content_schedule')
                .insert(scheduledItems);

            if (error) {
                console.error('[ContentScheduler] Error storing schedule:', error);
            } else {
                console.log(`[ContentScheduler] Scheduled ${scheduledItems.length} content items`);
            }
        }

        return scheduledItems;

    } catch (error) {
        console.error('[ContentScheduler] Error in scheduleContentGeneration:', error);
        return scheduledItems;
    }
};

/**
 * Generate daily content based on category
 */
export const generateDailyContent = async (category: string): Promise<Article | null> => {
    const supabase = getSupabase();

    if (!supabase) {
        console.warn('[ContentScheduler] Supabase not configured');
        return null;
    }

    try {
        console.log(`[ContentScheduler] Generating content for category: ${category}`);

        const categoryConfig = CATEGORIES[category];
        if (!categoryConfig) {
            console.error(`[ContentScheduler] Unknown category: ${category}`);
            return null;
        }

        // Determine article type based on existing content
        const { data: existingArticles } = await supabase
            .from('articles')
            .select('type')
            .eq('category', category);

        const typeCounts: Record<ArticleType, number> = {
            guide: 0,
            list: 0,
            comparison: 0,
            informational: 0
        };

        for (const article of existingArticles || []) {
            const type = article.type as ArticleType;
            if (type in typeCounts) {
                typeCounts[type]++;
            }
        }

        // Pick the least common type
        const articleType = Object.entries(typeCounts)
            .sort(([, a], [, b]) => a - b)[0][0] as ArticleType;

        // Generate title based on type
        const year = new Date().getFullYear();
        let title: string;
        switch (articleType) {
            case 'guide':
                title = `De Complete ${categoryConfig.name} Koopgids ${year}`;
                break;
            case 'list':
                title = `Top 10 Beste ${categoryConfig.name} van ${year}`;
                break;
            case 'comparison':
                title = `${categoryConfig.name} Vergelijking: Welke Kies Je?`;
                break;
            default:
                title = `Alles over ${categoryConfig.name}: Tips & Advies`;
        }

        // Create article placeholder
        const article: Article = {
            id: generateId(),
            title,
            type: articleType,
            category,
            summary: `Ontdek de beste ${categoryConfig.name.toLowerCase()} met onze uitgebreide ${articleType === 'guide' ? 'koopgids' : articleType === 'list' ? 'top lijst' : 'vergelijking'}.`,
            htmlContent: `<p>Dit artikel wordt binnenkort aangevuld met uitgebreide content...</p>`,
            author: 'ProductPraat Redactie',
            date: new Date().toLocaleDateString('nl-NL'),
            slug: generateSlug(title),
            created_at: new Date().toISOString(),
            metaDescription: `${categoryConfig.name} kopen? Lees onze ${articleType === 'guide' ? 'complete koopgids' : 'uitgebreide review'} met tips en aanbevelingen.`
        };

        // Store article
        const { error } = await supabase
            .from('articles')
            .insert(article);

        if (error) {
            console.error('[ContentScheduler] Error storing article:', error);
            return null;
        }

        console.log(`[ContentScheduler] Generated article: ${title}`);
        return article;

    } catch (error) {
        console.error('[ContentScheduler] Error in generateDailyContent:', error);
        return null;
    }
};

/**
 * Detect trending categories based on click data and content gaps
 */
export const selectTrendingCategory = async (): Promise<string> => {
    const supabase = getSupabase();

    if (!supabase) {
        // Return a random category
        const categories = Object.keys(CATEGORIES);
        return categories[Math.floor(Math.random() * categories.length)];
    }

    try {
        const trendingCategories: TrendingCategory[] = [];
        const categories = Object.keys(CATEGORIES);

        for (const category of categories) {
            // Get recent clicks for this category
            const { data: clicks } = await supabase
                .from('affiliate_clicks')
                .select(`
                    id,
                    affiliate_links!inner (
                        products!inner (
                            category
                        )
                    )
                `)
                .eq('affiliate_links.products.category', category)
                .gte('clicked_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

            // Get existing content count
            const { count: articleCount } = await supabase
                .from('articles')
                .select('*', { count: 'exact', head: true })
                .eq('category', category);

            const { count: productCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('category', category);

            // Calculate content gap (high products, low articles = opportunity)
            const contentGap = (productCount || 0) - (articleCount || 0) * 2;

            trendingCategories.push({
                category,
                score: (clicks?.length || 0) + Math.max(0, contentGap) * 10,
                recentClicks: clicks?.length || 0,
                searchVolume: 0, // Would need external API
                contentGap
            });
        }

        // Sort by score and return top category
        trendingCategories.sort((a, b) => b.score - a.score);

        const selected = trendingCategories[0]?.category || categories[0];
        console.log(`[ContentScheduler] Selected trending category: ${selected}`);

        return selected;

    } catch (error) {
        console.error('[ContentScheduler] Error selecting trending category:', error);
        const categories = Object.keys(CATEGORIES);
        return categories[Math.floor(Math.random() * categories.length)];
    }
};

/**
 * Auto-publish scheduled content that is ready
 */
export const autoPublishScheduledContent = async (): Promise<number> => {
    const supabase = getSupabase();
    let publishedCount = 0;

    if (!supabase) {
        console.warn('[ContentScheduler] Supabase not configured');
        return publishedCount;
    }

    try {
        const now = new Date().toISOString();

        // Find generated content that is due for publication
        const { data: dueContent, error } = await supabase
            .from('content_schedule')
            .select('*')
            .eq('status', 'generated')
            .lte('scheduled_for', now);

        if (error) {
            console.error('[ContentScheduler] Error fetching due content:', error);
            return publishedCount;
        }

        if (!dueContent || dueContent.length === 0) {
            console.log('[ContentScheduler] No content due for publication');
            return publishedCount;
        }

        console.log(`[ContentScheduler] Found ${dueContent.length} items due for publication`);

        for (const item of dueContent) {
            if (item.article_id) {
                // Update article status if needed
                const { error: updateError } = await supabase
                    .from('articles')
                    .update({ 
                        lastUpdated: new Date().toISOString()
                    })
                    .eq('id', item.article_id);

                if (!updateError) {
                    // Mark as published
                    await supabase
                        .from('content_schedule')
                        .update({ 
                            status: 'published',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', item.id);

                    publishedCount++;
                    console.log(`[ContentScheduler] Published: ${item.topic}`);
                }
            }
        }

        console.log(`[ContentScheduler] Published ${publishedCount} content items`);
        return publishedCount;

    } catch (error) {
        console.error('[ContentScheduler] Error in autoPublishScheduledContent:', error);
        return publishedCount;
    }
};

/**
 * Analyze best publishing times based on historical engagement
 */
export const optimizePublishingTimes = async (): Promise<PublishingTimeAnalysis[]> => {
    const supabase = getSupabase();
    const analysis: PublishingTimeAnalysis[] = [];

    if (!supabase) {
        console.warn('[ContentScheduler] Supabase not configured');
        return analysis;
    }

    try {
        // Get click data with timestamps
        const { data: clicks } = await supabase
            .from('affiliate_clicks')
            .select('clicked_at');

        if (!clicks || clicks.length === 0) {
            // Return default optimal times (based on general best practices)
            return [
                { hour: 9, dayOfWeek: 1, score: 80, avgEngagement: 0 },  // Monday 9AM
                { hour: 10, dayOfWeek: 3, score: 85, avgEngagement: 0 }, // Wednesday 10AM
                { hour: 14, dayOfWeek: 5, score: 75, avgEngagement: 0 }, // Friday 2PM
            ];
        }

        // Analyze click patterns by hour and day of week
        const patterns: Record<string, number> = {};

        for (const click of clicks) {
            const date = new Date(click.clicked_at);
            const hour = date.getHours();
            const dayOfWeek = date.getDay();
            const key = `${dayOfWeek}-${hour}`;

            patterns[key] = (patterns[key] || 0) + 1;
        }

        // Convert to analysis format
        for (const [key, count] of Object.entries(patterns)) {
            const [dayOfWeek, hour] = key.split('-').map(Number);
            analysis.push({
                hour,
                dayOfWeek,
                score: (count / clicks.length) * 100,
                avgEngagement: count
            });
        }

        // Sort by score
        analysis.sort((a, b) => b.score - a.score);

        // Store analysis results
        await supabase
            .from('performance_metrics')
            .upsert({
                id: 'publishing-time-analysis',
                metric_type: 'publishing_times',
                entity_id: 'all',
                data: analysis.slice(0, 10),
                recorded_at: new Date().toISOString()
            });

        return analysis.slice(0, 10);

    } catch (error) {
        console.error('[ContentScheduler] Error in optimizePublishingTimes:', error);
        return analysis;
    }
};

/**
 * Get upcoming scheduled content
 */
export const getUpcomingContent = async (): Promise<ContentScheduleItem[]> => {
    const supabase = getSupabase();

    if (!supabase) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('content_schedule')
            .select('*')
            .gte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true })
            .limit(10);

        if (error) {
            console.error('[ContentScheduler] Error fetching upcoming content:', error);
            return [];
        }

        return data || [];

    } catch (error) {
        console.error('[ContentScheduler] Error in getUpcomingContent:', error);
        return [];
    }
};

/**
 * Main entry point for scheduled content generation
 */
export const runScheduledContentGeneration = async (): Promise<void> => {
    console.log('[ContentScheduler] Starting scheduled content generation...');
    const startTime = Date.now();

    try {
        // Select trending category
        const category = await selectTrendingCategory();
        
        // Generate content
        await generateDailyContent(category);
        
        // Schedule future content
        await scheduleContentGeneration();
        
        // Publish any due content
        await autoPublishScheduledContent();

        const duration = Date.now() - startTime;
        console.log(`[ContentScheduler] Scheduled generation completed in ${duration}ms`);

    } catch (error) {
        console.error('[ContentScheduler] Scheduled generation failed:', error);
        throw error;
    }
};

/**
 * Main entry point for hourly content publication check
 */
export const runHourlyPublicationCheck = async (): Promise<void> => {
    console.log('[ContentScheduler] Running hourly publication check...');

    try {
        await autoPublishScheduledContent();
    } catch (error) {
        console.error('[ContentScheduler] Hourly check failed:', error);
        throw error;
    }
};

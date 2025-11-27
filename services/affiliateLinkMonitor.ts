/**
 * Affiliate Link Monitor Service
 * 
 * Monitors the health of affiliate links, detects broken links,
 * and automatically replaces them with alternatives.
 * 
 * @module services/affiliateLinkMonitor
 */

import { getSupabase } from './supabaseClient';
import { AffiliateLink } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface LinkHealthCheck {
    id?: string;
    link_id: string;
    status_code: number;
    checked_at: string;
    response_time: number;
    is_working: boolean;
    error_message?: string;
}

export interface LinkHealthReport {
    total: number;
    working: number;
    broken: number;
    fixed: number;
    avgResponseTime: number;
    generatedAt: string;
    details: Array<{
        linkId: string;
        url: string;
        status: 'working' | 'broken' | 'timeout';
        statusCode?: number;
        responseTime?: number;
    }>;
}

export interface LinkPerformance {
    linkId: string;
    productId: string;
    clicks: number;
    ctr: number;
    lastClicked?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const BATCH_SIZE = 10; // Process links in batches
const DELAY_BETWEEN_BATCHES_MS = 1000; // 1 second between batches

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for database records
 */
const generateId = (): string => {
    return `lhc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Delay execution for specified milliseconds
 */
const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Fetch URL with timeout
 * Uses HEAD request to minimize bandwidth
 */
const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<{
    statusCode: number;
    responseTime: number;
    error?: string;
}> => {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'ProductPraat LinkChecker/1.0'
            }
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        return {
            statusCode: response.status,
            responseTime
        };
    } catch (error) {
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return {
            statusCode: 0,
            responseTime,
            error: errorMessage.includes('aborted') ? 'Timeout' : errorMessage
        };
    }
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Check all affiliate links for validity
 * Processes links in batches to avoid overwhelming servers
 */
export const checkAllAffiliateLinks = async (): Promise<LinkHealthCheck[]> => {
    const supabase = getSupabase();
    const results: LinkHealthCheck[] = [];

    if (!supabase) {
        console.warn('[AffiliateLinkMonitor] Supabase not configured');
        return results;
    }

    try {
        console.log('[AffiliateLinkMonitor] Starting link health check...');

        // Fetch all affiliate links
        const { data: links, error } = await supabase
            .from('affiliate_links')
            .select('id, url, product_id, network_id')
            .order('last_checked', { ascending: true, nullsFirst: true });

        if (error) {
            console.error('[AffiliateLinkMonitor] Error fetching links:', error);
            return results;
        }

        if (!links || links.length === 0) {
            console.log('[AffiliateLinkMonitor] No affiliate links found');
            return results;
        }

        console.log(`[AffiliateLinkMonitor] Checking ${links.length} links...`);

        // Process in batches
        for (let i = 0; i < links.length; i += BATCH_SIZE) {
            const batch = links.slice(i, i + BATCH_SIZE);
            
            const batchPromises = batch.map(async (link) => {
                const result = await validateLinkStatus(link.url);
                const healthCheck: LinkHealthCheck = {
                    id: generateId(),
                    link_id: link.id,
                    status_code: result.statusCode,
                    checked_at: new Date().toISOString(),
                    response_time: result.responseTime,
                    is_working: result.isWorking,
                    error_message: result.error
                };
                return healthCheck;
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Delay between batches
            if (i + BATCH_SIZE < links.length) {
                await delay(DELAY_BETWEEN_BATCHES_MS);
            }
        }

        // Store health check results in database
        if (results.length > 0) {
            const { error: insertError } = await supabase
                .from('link_health_checks')
                .insert(results);

            if (insertError) {
                console.error('[AffiliateLinkMonitor] Error storing health checks:', insertError);
            }

            // Update affiliate_links with last_checked and health_status
            for (const result of results) {
                await supabase
                    .from('affiliate_links')
                    .update({
                        last_checked: result.checked_at,
                        health_status: result.is_working ? 'healthy' : 'broken'
                    })
                    .eq('id', result.link_id);
            }
        }

        console.log(`[AffiliateLinkMonitor] Completed. ${results.filter(r => r.is_working).length}/${results.length} links working.`);
        return results;

    } catch (error) {
        console.error('[AffiliateLinkMonitor] Error in checkAllAffiliateLinks:', error);
        return results;
    }
};

/**
 * Validate a single link's status
 */
export const validateLinkStatus = async (url: string): Promise<{
    statusCode: number;
    responseTime: number;
    isWorking: boolean;
    error?: string;
}> => {
    const result = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
    
    // Consider 2xx and 3xx as working
    const isWorking = result.statusCode >= 200 && result.statusCode < 400;

    return {
        ...result,
        isWorking
    };
};

/**
 * Detect broken links from the database
 */
export const detectBrokenLinks = async (): Promise<AffiliateLink[]> => {
    const supabase = getSupabase();

    if (!supabase) {
        console.warn('[AffiliateLinkMonitor] Supabase not configured');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('affiliate_links')
            .select('*')
            .eq('health_status', 'broken');

        if (error) {
            console.error('[AffiliateLinkMonitor] Error fetching broken links:', error);
            return [];
        }

        return (data || []).map(link => ({
            id: link.id,
            productId: link.product_id,
            networkId: link.network_id,
            shopName: link.shop_name,
            url: link.url,
            price: link.price,
            inStock: link.in_stock,
            lastChecked: link.last_checked,
            isPrimary: link.is_primary
        }));

    } catch (error) {
        console.error('[AffiliateLinkMonitor] Error in detectBrokenLinks:', error);
        return [];
    }
};

/**
 * Update broken links with alternatives
 * For now, marks broken links as inactive and finds alternatives
 */
export const updateBrokenLinks = async (): Promise<number> => {
    const supabase = getSupabase();
    let fixedCount = 0;

    if (!supabase) {
        console.warn('[AffiliateLinkMonitor] Supabase not configured');
        return fixedCount;
    }

    try {
        const brokenLinks = await detectBrokenLinks();
        console.log(`[AffiliateLinkMonitor] Found ${brokenLinks.length} broken links to update`);

        for (const link of brokenLinks) {
            // Check if there's an alternative healthy link for the same product
            const { data: alternatives, error } = await supabase
                .from('affiliate_links')
                .select('*')
                .eq('product_id', link.productId)
                .eq('health_status', 'healthy')
                .neq('id', link.id)
                .limit(1);

            if (error) {
                console.error('[AffiliateLinkMonitor] Error finding alternatives:', error);
                continue;
            }

            if (alternatives && alternatives.length > 0) {
                // Demote broken link and promote alternative
                await supabase
                    .from('affiliate_links')
                    .update({ is_primary: false })
                    .eq('id', link.id);

                await supabase
                    .from('affiliate_links')
                    .update({ is_primary: true })
                    .eq('id', alternatives[0].id);

                fixedCount++;
                console.log(`[AffiliateLinkMonitor] Promoted alternative link for product ${link.productId}`);
            } else {
                // No alternative found, mark link as needing attention
                await supabase
                    .from('affiliate_links')
                    .update({ health_status: 'needs_attention' })
                    .eq('id', link.id);
            }
        }

        console.log(`[AffiliateLinkMonitor] Fixed ${fixedCount} broken links`);
        return fixedCount;

    } catch (error) {
        console.error('[AffiliateLinkMonitor] Error in updateBrokenLinks:', error);
        return fixedCount;
    }
};

/**
 * Generate a comprehensive link health report
 */
export const generateLinkHealthReport = async (): Promise<LinkHealthReport> => {
    const supabase = getSupabase();
    const report: LinkHealthReport = {
        total: 0,
        working: 0,
        broken: 0,
        fixed: 0,
        avgResponseTime: 0,
        generatedAt: new Date().toISOString(),
        details: []
    };

    if (!supabase) {
        console.warn('[AffiliateLinkMonitor] Supabase not configured');
        return report;
    }

    try {
        // Get all links with their latest health check
        const { data: links, error } = await supabase
            .from('affiliate_links')
            .select(`
                id,
                url,
                health_status,
                link_health_checks (
                    status_code,
                    response_time,
                    checked_at
                )
            `)
            .order('last_checked', { ascending: false });

        if (error) {
            console.error('[AffiliateLinkMonitor] Error fetching links for report:', error);
            return report;
        }

        if (!links) return report;

        report.total = links.length;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        for (const link of links) {
            const healthCheck = link.link_health_checks?.[0];
            const status = link.health_status === 'healthy' ? 'working' : 
                          link.health_status === 'broken' ? 'broken' : 'timeout';

            if (status === 'working') report.working++;
            if (status === 'broken') report.broken++;

            if (healthCheck?.response_time) {
                totalResponseTime += healthCheck.response_time;
                responseTimeCount++;
            }

            report.details.push({
                linkId: link.id,
                url: link.url,
                status,
                statusCode: healthCheck?.status_code,
                responseTime: healthCheck?.response_time
            });
        }

        report.avgResponseTime = responseTimeCount > 0 
            ? Math.round(totalResponseTime / responseTimeCount) 
            : 0;

        console.log('[AffiliateLinkMonitor] Report generated:', {
            total: report.total,
            working: report.working,
            broken: report.broken
        });

        return report;

    } catch (error) {
        console.error('[AffiliateLinkMonitor] Error generating report:', error);
        return report;
    }
};

/**
 * Track link performance (click-through rates)
 */
export const trackLinkPerformance = async (): Promise<LinkPerformance[]> => {
    const supabase = getSupabase();
    const performance: LinkPerformance[] = [];

    if (!supabase) {
        console.warn('[AffiliateLinkMonitor] Supabase not configured');
        return performance;
    }

    try {
        // Get click statistics per link
        const { data, error } = await supabase
            .from('affiliate_clicks')
            .select(`
                link_id,
                affiliate_links!inner (
                    product_id
                )
            `);

        if (error) {
            console.error('[AffiliateLinkMonitor] Error fetching click data:', error);
            return performance;
        }

        if (!data) return performance;

        // Aggregate clicks per link
        const clickCounts: Record<string, { clicks: number; productId: string }> = {};
        for (const click of data) {
            const linkId = click.link_id;
            const affiliateLink = click.affiliate_links as unknown as { product_id: string } | undefined;
            if (!clickCounts[linkId]) {
                clickCounts[linkId] = { 
                    clicks: 0, 
                    productId: affiliateLink?.product_id || '' 
                };
            }
            clickCounts[linkId].clicks++;
        }

        // Get total views for CTR calculation (simplified - using click count as proxy)
        for (const [linkId, stats] of Object.entries(clickCounts)) {
            performance.push({
                linkId,
                productId: stats.productId,
                clicks: stats.clicks,
                ctr: stats.clicks / 100, // Placeholder CTR calculation
            });
        }

        // Store performance metrics
        if (performance.length > 0) {
            const { error: insertError } = await supabase
                .from('performance_metrics')
                .insert(performance.map(p => ({
                    id: generateId(),
                    metric_type: 'link_performance',
                    entity_id: p.linkId,
                    data: p,
                    recorded_at: new Date().toISOString()
                })));

            if (insertError) {
                console.error('[AffiliateLinkMonitor] Error storing performance metrics:', insertError);
            }
        }

        return performance;

    } catch (error) {
        console.error('[AffiliateLinkMonitor] Error in trackLinkPerformance:', error);
        return performance;
    }
};

/**
 * Main entry point for scheduled link health check
 */
export const runScheduledLinkHealthCheck = async (): Promise<void> => {
    console.log('[AffiliateLinkMonitor] Starting scheduled link health check...');
    const startTime = Date.now();

    try {
        await checkAllAffiliateLinks();
        await updateBrokenLinks();
        await generateLinkHealthReport();

        const duration = Date.now() - startTime;
        console.log(`[AffiliateLinkMonitor] Scheduled check completed in ${duration}ms`);

    } catch (error) {
        console.error('[AffiliateLinkMonitor] Scheduled check failed:', error);
        throw error;
    }
};

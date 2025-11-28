/**
 * Product Discovery Automation Service
 * 
 * Manages automated product discovery from Bol.com API.
 * Periodically fetches products, filters by criteria, generates AI reviews,
 * and stores them in the database.
 * 
 * @module services/productDiscoveryService
 */

import { getSupabase } from './supabaseClient';
import type { Product } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export type ScheduleInterval = 'hourly' | 'daily' | 'weekly';
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type RunType = 'manual' | 'scheduled';
export type ImportStatus = 'imported' | 'skipped' | 'failed';

export interface DiscoveryFilters {
    minRating?: number;
    minReviews?: number;
    inStockOnly?: boolean;
}

export interface DiscoveryConfig {
    id?: string;
    enabled: boolean;
    scheduleInterval: ScheduleInterval | null;
    categories: string[];
    filters: DiscoveryFilters;
    maxProductsPerRun: number;
    lastRunAt?: string;
    nextScheduledRun?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface AutomationRun {
    id: string;
    startedAt: string;
    completedAt?: string;
    status: RunStatus;
    runType: RunType;
    categories: string[];
    filters: DiscoveryFilters;
    productsProcessed: number;
    productsImported: number;
    productsSkipped: number;
    productsFailed: number;
    errorMessage?: string;
    config?: Record<string, unknown>;
}

export interface ProductImportLog {
    id?: string;
    runId: string;
    ean?: string;
    bolProductId?: string;
    productTitle?: string;
    status: ImportStatus;
    skipReason?: string;
    errorMessage?: string;
    productId?: string;
}

export interface AutomationStats {
    isRunning: boolean;
    lastRun?: AutomationRun;
    schedule?: {
        enabled: boolean;
        interval: ScheduleInterval | null;
        nextRun?: string;
    };
    stats: {
        totalProcessed: number;
        successfulImports: number;
        failedImports: number;
        skippedProducts: number;
    };
}

export interface DiscoverResult {
    success: boolean;
    run?: AutomationRun;
    productsImported: Product[];
    errors: string[];
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
    enabled: false,
    scheduleInterval: 'daily',
    categories: ['11652', '13512', '21328'], // Electronics, Computer & Gaming, Phones
    filters: {
        minRating: 4.0,
        minReviews: 10,
        inStockOnly: true,
    },
    maxProductsPerRun: 10,
};

// Bol.com category IDs with names
export const BOL_CATEGORIES: Record<string, string> = {
    '11652': 'Elektronica',
    '13512': 'Computer & Gaming',
    '21328': 'Telefonie & Navigatie',
    '15452': 'TV & Audio',
    '15457': 'Huishouden',
    '13640': 'Wonen & Slapen',
    '12652': 'Speelgoed',
    '10644': 'Klussen & Gereedschap',
    '10639': 'Tuin & Klussen',
    '15654': 'Baby & Kind',
};

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

/**
 * Load discovery configuration from database
 */
export const loadDiscoveryConfig = async (): Promise<DiscoveryConfig> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[ProductDiscovery] Supabase not configured, using defaults');
        return DEFAULT_DISCOVERY_CONFIG;
    }

    try {
        const { data, error } = await supabase
            .from('discovery_config')
            .select('*')
            .eq('id', 'default')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found, return defaults
                return DEFAULT_DISCOVERY_CONFIG;
            }
            console.error('[ProductDiscovery] Error loading config:', error);
            return DEFAULT_DISCOVERY_CONFIG;
        }

        if (!data) {
            return DEFAULT_DISCOVERY_CONFIG;
        }

        return {
            id: data.id,
            enabled: data.enabled || false,
            scheduleInterval: data.schedule_interval,
            categories: data.categories || [],
            filters: data.filters || DEFAULT_DISCOVERY_CONFIG.filters,
            maxProductsPerRun: data.max_products_per_run || 10,
            lastRunAt: data.last_run_at,
            nextScheduledRun: data.next_scheduled_run,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
    } catch (error) {
        console.error('[ProductDiscovery] Error in loadDiscoveryConfig:', error);
        return DEFAULT_DISCOVERY_CONFIG;
    }
};

/**
 * Save discovery configuration to database
 */
export const saveDiscoveryConfig = async (config: DiscoveryConfig): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[ProductDiscovery] Supabase not configured');
        return false;
    }

    try {
        const { error } = await supabase
            .from('discovery_config')
            .upsert({
                id: 'default',
                enabled: config.enabled,
                schedule_interval: config.scheduleInterval,
                categories: config.categories,
                filters: config.filters,
                max_products_per_run: config.maxProductsPerRun,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            console.error('[ProductDiscovery] Error saving config:', error);
            return false;
        }

        console.log('[ProductDiscovery] Configuration saved');
        return true;
    } catch (error) {
        console.error('[ProductDiscovery] Error in saveDiscoveryConfig:', error);
        return false;
    }
};

// ============================================================================
// RUN MANAGEMENT
// ============================================================================

/**
 * Create a new automation run record
 */
export const createAutomationRun = async (
    runType: RunType,
    categories: string[],
    filters: DiscoveryFilters,
    config?: Record<string, unknown>
): Promise<AutomationRun | null> => {
    const supabase = getSupabase();
    if (!supabase) {
        return null;
    }

    try {
        const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('automation_runs')
            .insert({
                id: runId,
                started_at: now,
                status: 'running',
                run_type: runType,
                categories: categories,
                filters: filters,
                config: config || {},
            })
            .select()
            .single();

        if (error) {
            console.error('[ProductDiscovery] Error creating run:', error);
            return null;
        }

        return mapRunFromDb(data);
    } catch (error) {
        console.error('[ProductDiscovery] Error in createAutomationRun:', error);
        return null;
    }
};

/**
 * Update an automation run
 */
export const updateAutomationRun = async (
    runId: string,
    updates: Partial<{
        status: RunStatus;
        completedAt: string;
        productsProcessed: number;
        productsImported: number;
        productsSkipped: number;
        productsFailed: number;
        errorMessage: string;
    }>
): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        return false;
    }

    try {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;
        if (updates.productsProcessed !== undefined) dbUpdates.products_processed = updates.productsProcessed;
        if (updates.productsImported !== undefined) dbUpdates.products_imported = updates.productsImported;
        if (updates.productsSkipped !== undefined) dbUpdates.products_skipped = updates.productsSkipped;
        if (updates.productsFailed !== undefined) dbUpdates.products_failed = updates.productsFailed;
        if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;

        const { error } = await supabase
            .from('automation_runs')
            .update(dbUpdates)
            .eq('id', runId);

        if (error) {
            console.error('[ProductDiscovery] Error updating run:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[ProductDiscovery] Error in updateAutomationRun:', error);
        return false;
    }
};

/**
 * Log a product import attempt
 */
export const logProductImport = async (log: ProductImportLog): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        return false;
    }

    try {
        const { error } = await supabase
            .from('product_import_logs')
            .insert({
                run_id: log.runId,
                ean: log.ean,
                bol_product_id: log.bolProductId,
                product_title: log.productTitle,
                status: log.status,
                skip_reason: log.skipReason,
                error_message: log.errorMessage,
                product_id: log.productId,
            });

        if (error) {
            console.error('[ProductDiscovery] Error logging import:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[ProductDiscovery] Error in logProductImport:', error);
        return false;
    }
};

// ============================================================================
// STATUS & HISTORY
// ============================================================================

/**
 * Get automation status
 */
export const getAutomationStatus = async (): Promise<AutomationStats> => {
    const supabase = getSupabase();
    const defaultStats: AutomationStats = {
        isRunning: false,
        stats: {
            totalProcessed: 0,
            successfulImports: 0,
            failedImports: 0,
            skippedProducts: 0,
        },
    };

    if (!supabase) {
        return defaultStats;
    }

    try {
        // Check for running automation
        const { data: runningRuns } = await supabase
            .from('automation_runs')
            .select('*')
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1);

        const isRunning = (runningRuns && runningRuns.length > 0) || false;

        // Get last completed run
        const { data: lastRuns } = await supabase
            .from('automation_runs')
            .select('*')
            .neq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1);

        const lastRun = lastRuns && lastRuns.length > 0 ? mapRunFromDb(lastRuns[0]) : undefined;

        // Get config for schedule info
        const config = await loadDiscoveryConfig();

        // Calculate aggregate stats from recent runs (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentRuns } = await supabase
            .from('automation_runs')
            .select('products_processed, products_imported, products_skipped, products_failed')
            .gte('started_at', thirtyDaysAgo.toISOString());

        let totalProcessed = 0;
        let successfulImports = 0;
        let failedImports = 0;
        let skippedProducts = 0;

        if (recentRuns) {
            for (const run of recentRuns) {
                totalProcessed += run.products_processed || 0;
                successfulImports += run.products_imported || 0;
                failedImports += run.products_failed || 0;
                skippedProducts += run.products_skipped || 0;
            }
        }

        return {
            isRunning,
            lastRun,
            schedule: {
                enabled: config.enabled,
                interval: config.scheduleInterval,
                nextRun: config.nextScheduledRun,
            },
            stats: {
                totalProcessed,
                successfulImports,
                failedImports,
                skippedProducts,
            },
        };
    } catch (error) {
        console.error('[ProductDiscovery] Error in getAutomationStatus:', error);
        return defaultStats;
    }
};

/**
 * Get automation run history
 */
export const getAutomationHistory = async (limit: number = 20): Promise<AutomationRun[]> => {
    const supabase = getSupabase();
    if (!supabase) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('automation_runs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[ProductDiscovery] Error fetching history:', error);
            return [];
        }

        return (data || []).map(mapRunFromDb);
    } catch (error) {
        console.error('[ProductDiscovery] Error in getAutomationHistory:', error);
        return [];
    }
};

/**
 * Get import logs for a specific run
 */
export const getRunImportLogs = async (runId: string): Promise<ProductImportLog[]> => {
    const supabase = getSupabase();
    if (!supabase) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('product_import_logs')
            .select('*')
            .eq('run_id', runId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[ProductDiscovery] Error fetching import logs:', error);
            return [];
        }

        return (data || []).map(row => ({
            id: row.id,
            runId: row.run_id,
            ean: row.ean,
            bolProductId: row.bol_product_id,
            productTitle: row.product_title,
            status: row.status,
            skipReason: row.skip_reason,
            errorMessage: row.error_message,
            productId: row.product_id,
        }));
    } catch (error) {
        console.error('[ProductDiscovery] Error in getRunImportLogs:', error);
        return [];
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map database row to AutomationRun object
 */
function mapRunFromDb(row: Record<string, unknown>): AutomationRun {
    return {
        id: row.id as string,
        startedAt: row.started_at as string,
        completedAt: row.completed_at as string | undefined,
        status: row.status as RunStatus,
        runType: row.run_type as RunType,
        categories: (row.categories as string[]) || [],
        filters: (row.filters as DiscoveryFilters) || {},
        productsProcessed: (row.products_processed as number) || 0,
        productsImported: (row.products_imported as number) || 0,
        productsSkipped: (row.products_skipped as number) || 0,
        productsFailed: (row.products_failed as number) || 0,
        errorMessage: row.error_message as string | undefined,
        config: row.config as Record<string, unknown> | undefined,
    };
}

/**
 * Calculate next scheduled run time
 */
export function calculateNextRun(interval: ScheduleInterval): Date {
    const now = new Date();
    
    switch (interval) {
        case 'hourly':
            now.setHours(now.getHours() + 1);
            now.setMinutes(0);
            now.setSeconds(0);
            break;
        case 'daily':
            now.setDate(now.getDate() + 1);
            now.setHours(3, 0, 0, 0); // Run at 3:00 AM
            break;
        case 'weekly':
            now.setDate(now.getDate() + 7);
            now.setHours(3, 0, 0, 0); // Run at 3:00 AM
            break;
    }
    
    return now;
}

/**
 * Update the next scheduled run time in config
 */
export const updateNextScheduledRun = async (interval: ScheduleInterval): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        return false;
    }

    try {
        const nextRun = calculateNextRun(interval);
        
        const { error } = await supabase
            .from('discovery_config')
            .update({
                next_scheduled_run: nextRun.toISOString(),
                last_run_at: new Date().toISOString(),
            })
            .eq('id', 'default');

        if (error) {
            console.error('[ProductDiscovery] Error updating next run:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[ProductDiscovery] Error in updateNextScheduledRun:', error);
        return false;
    }
};

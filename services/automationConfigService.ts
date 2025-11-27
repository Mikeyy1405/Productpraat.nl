/**
 * Automation Configuration Service
 * 
 * Handles loading, saving, and validating automation configuration.
 * Syncs between localStorage and Supabase for persistence.
 * 
 * @module services/automationConfigService
 */

import { getSupabase } from './supabaseClient';
import { CATEGORIES } from '../types';
import {
    AutomationConfig,
    ValidationResult,
    ValidationError,
    ContentFrequency,
    ContentType,
    CheckFrequency,
    SyncFrequency,
    AlertType
} from '../types/automationTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'productpraat_automation_config';
const SUPABASE_TABLE = 'automation_config';

/**
 * Default automation configuration
 * Used when no configuration exists or to reset to defaults
 */
export const DEFAULT_CONFIG: AutomationConfig = {
    masterEnabled: false,
    productGeneration: {
        enabled: false,
        productsPerDay: 3,
        categories: Object.keys(CATEGORIES).slice(0, 4),
        preferredTime: '09:00'
    },
    contentGeneration: {
        enabled: false,
        frequency: 'weekly',
        contentTypes: ['guides', 'comparisons', 'toplists'],
        postsPerWeek: 3,
        preferredDays: [1, 3, 5]
    },
    linkMonitoring: {
        enabled: true,
        checkFrequency: 'daily',
        autoFix: true,
        notifications: true
    },
    commissionTracking: {
        enabled: true,
        syncFrequency: 'daily',
        networks: ['bol', 'tradetracker', 'daisycon']
    },
    notifications: {
        email: '',
        alertTypes: ['broken_links', 'error_occurred', 'high_earnings'],
        emailEnabled: false
    },
    performance: {
        enableCaching: true,
        enableLazyLoading: true,
        enableImageOptimization: true,
        minConversionRate: 1.0,
        autoRemoveLowPerformers: false
    }
};

// ============================================================================
// VALIDATION
// ============================================================================

const VALID_FREQUENCIES: ContentFrequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];
const VALID_CONTENT_TYPES: ContentType[] = ['guides', 'comparisons', 'toplists', 'blogs'];
const VALID_CHECK_FREQUENCIES: CheckFrequency[] = ['hourly', 'daily', 'weekly'];
const VALID_SYNC_FREQUENCIES: SyncFrequency[] = ['hourly', 'daily', 'weekly'];
const VALID_ALERT_TYPES: AlertType[] = [
    'broken_links', 'low_conversion', 'high_earnings',
    'content_published', 'product_generated', 'error_occurred'
];

/**
 * Validate automation configuration
 */
export const validateConfig = (config: Partial<AutomationConfig>): ValidationResult => {
    const errors: ValidationError[] = [];

    // Product Generation validation
    if (config.productGeneration) {
        const pg = config.productGeneration;
        
        if (typeof pg.productsPerDay !== 'number' || pg.productsPerDay < 0 || pg.productsPerDay > 10) {
            errors.push({ field: 'productGeneration.productsPerDay', message: 'Moet tussen 0 en 10 zijn' });
        }
        
        if (!Array.isArray(pg.categories) || pg.categories.length === 0) {
            errors.push({ field: 'productGeneration.categories', message: 'Selecteer minimaal één categorie' });
        } else {
            const invalidCategories = pg.categories.filter(c => !CATEGORIES[c]);
            if (invalidCategories.length > 0) {
                errors.push({ field: 'productGeneration.categories', message: `Ongeldige categorieën: ${invalidCategories.join(', ')}` });
            }
        }
        
        if (pg.preferredTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(pg.preferredTime)) {
            errors.push({ field: 'productGeneration.preferredTime', message: 'Ongeldig tijdformaat (gebruik HH:MM)' });
        }
    }

    // Content Generation validation
    if (config.contentGeneration) {
        const cg = config.contentGeneration;
        
        if (cg.frequency && !VALID_FREQUENCIES.includes(cg.frequency)) {
            errors.push({ field: 'contentGeneration.frequency', message: 'Ongeldige frequentie' });
        }
        
        if (!Array.isArray(cg.contentTypes) || cg.contentTypes.length === 0) {
            errors.push({ field: 'contentGeneration.contentTypes', message: 'Selecteer minimaal één content type' });
        } else {
            const invalidTypes = cg.contentTypes.filter(t => !VALID_CONTENT_TYPES.includes(t));
            if (invalidTypes.length > 0) {
                errors.push({ field: 'contentGeneration.contentTypes', message: `Ongeldige content types: ${invalidTypes.join(', ')}` });
            }
        }
        
        if (typeof cg.postsPerWeek !== 'number' || cg.postsPerWeek < 1 || cg.postsPerWeek > 7) {
            errors.push({ field: 'contentGeneration.postsPerWeek', message: 'Moet tussen 1 en 7 zijn' });
        }
        
        if (!Array.isArray(cg.preferredDays) || cg.preferredDays.length === 0) {
            errors.push({ field: 'contentGeneration.preferredDays', message: 'Selecteer minimaal één dag' });
        } else {
            const invalidDays = cg.preferredDays.filter(d => d < 0 || d > 6);
            if (invalidDays.length > 0) {
                errors.push({ field: 'contentGeneration.preferredDays', message: 'Ongeldige dagen geselecteerd' });
            }
        }
    }

    // Link Monitoring validation
    if (config.linkMonitoring) {
        if (config.linkMonitoring.checkFrequency && !VALID_CHECK_FREQUENCIES.includes(config.linkMonitoring.checkFrequency)) {
            errors.push({ field: 'linkMonitoring.checkFrequency', message: 'Ongeldige check frequentie' });
        }
    }

    // Commission Tracking validation
    if (config.commissionTracking) {
        const ct = config.commissionTracking;
        
        if (ct.syncFrequency && !VALID_SYNC_FREQUENCIES.includes(ct.syncFrequency)) {
            errors.push({ field: 'commissionTracking.syncFrequency', message: 'Ongeldige sync frequentie' });
        }
        
        if (ct.enabled && (!Array.isArray(ct.networks) || ct.networks.length === 0)) {
            errors.push({ field: 'commissionTracking.networks', message: 'Selecteer minimaal één netwerk' });
        }
    }

    // Notifications validation
    if (config.notifications) {
        const n = config.notifications;
        
        if (n.emailEnabled && (!n.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.email))) {
            errors.push({ field: 'notifications.email', message: 'Voer een geldig e-mailadres in' });
        }
        
        if (n.alertTypes && n.alertTypes.length > 0) {
            const invalidAlerts = n.alertTypes.filter(a => !VALID_ALERT_TYPES.includes(a));
            if (invalidAlerts.length > 0) {
                errors.push({ field: 'notifications.alertTypes', message: `Ongeldige alert types: ${invalidAlerts.join(', ')}` });
            }
        }
    }

    // Performance validation
    if (config.performance) {
        const p = config.performance;
        
        if (typeof p.minConversionRate !== 'number' || p.minConversionRate < 0 || p.minConversionRate > 100) {
            errors.push({ field: 'performance.minConversionRate', message: 'Moet tussen 0 en 100 zijn' });
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Load automation configuration from localStorage
 */
const loadFromLocalStorage = (): AutomationConfig | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to ensure all fields exist
            return mergeWithDefaults(parsed);
        }
    } catch (error) {
        console.error('[AutomationConfigService] Error loading from localStorage:', error);
    }
    return null;
};

/**
 * Save automation configuration to localStorage
 */
const saveToLocalStorage = (config: AutomationConfig): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
        console.error('[AutomationConfigService] Error saving to localStorage:', error);
    }
};

/**
 * Load automation configuration from Supabase
 */
const loadFromSupabase = async (): Promise<AutomationConfig | null> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[AutomationConfigService] Supabase not configured');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from(SUPABASE_TABLE)
            .select('config, updated_at')
            .eq('id', 'default')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows found, return null
                return null;
            }
            console.error('[AutomationConfigService] Error loading from Supabase:', error);
            return null;
        }

        if (data && data.config) {
            const config = mergeWithDefaults(data.config);
            config.updatedAt = data.updated_at;
            return config;
        }
    } catch (error) {
        console.error('[AutomationConfigService] Error in loadFromSupabase:', error);
    }
    return null;
};

/**
 * Save automation configuration to Supabase
 */
const saveToSupabase = async (config: AutomationConfig): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[AutomationConfigService] Supabase not configured');
        return false;
    }

    try {
        const { error } = await supabase
            .from(SUPABASE_TABLE)
            .upsert({
                id: 'default',
                config: config,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('[AutomationConfigService] Error saving to Supabase:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[AutomationConfigService] Error in saveToSupabase:', error);
        return false;
    }
};

/**
 * Merge partial config with defaults to ensure all fields exist
 */
const mergeWithDefaults = (partial: Partial<AutomationConfig>): AutomationConfig => {
    return {
        ...DEFAULT_CONFIG,
        ...partial,
        productGeneration: {
            ...DEFAULT_CONFIG.productGeneration,
            ...(partial.productGeneration || {})
        },
        contentGeneration: {
            ...DEFAULT_CONFIG.contentGeneration,
            ...(partial.contentGeneration || {})
        },
        linkMonitoring: {
            ...DEFAULT_CONFIG.linkMonitoring,
            ...(partial.linkMonitoring || {})
        },
        commissionTracking: {
            ...DEFAULT_CONFIG.commissionTracking,
            ...(partial.commissionTracking || {})
        },
        notifications: {
            ...DEFAULT_CONFIG.notifications,
            ...(partial.notifications || {})
        },
        performance: {
            ...DEFAULT_CONFIG.performance,
            ...(partial.performance || {})
        }
    };
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Load automation configuration
 * Tries Supabase first, falls back to localStorage, then defaults
 */
export const loadAutomationConfig = async (): Promise<AutomationConfig> => {
    console.log('[AutomationConfigService] Loading automation config...');

    // Try Supabase first
    const supabaseConfig = await loadFromSupabase();
    if (supabaseConfig) {
        console.log('[AutomationConfigService] Loaded from Supabase');
        // Also update localStorage for offline access
        saveToLocalStorage(supabaseConfig);
        return supabaseConfig;
    }

    // Try localStorage
    const localConfig = loadFromLocalStorage();
    if (localConfig) {
        console.log('[AutomationConfigService] Loaded from localStorage');
        return localConfig;
    }

    // Return defaults
    console.log('[AutomationConfigService] Using default config');
    return { ...DEFAULT_CONFIG };
};

/**
 * Save automation configuration
 * Saves to both localStorage and Supabase for redundancy
 */
export const saveAutomationConfig = async (config: AutomationConfig): Promise<{
    success: boolean;
    errors: ValidationError[];
}> => {
    console.log('[AutomationConfigService] Saving automation config...');

    // Validate first
    const validation = validateConfig(config);
    if (!validation.isValid) {
        console.error('[AutomationConfigService] Validation failed:', validation.errors);
        return { success: false, errors: validation.errors };
    }

    // Update timestamp
    const configWithTimestamp: AutomationConfig = {
        ...config,
        updatedAt: new Date().toISOString()
    };

    // Save to localStorage first (fast, always available)
    saveToLocalStorage(configWithTimestamp);

    // Save to Supabase (async, may fail)
    const supabaseSuccess = await saveToSupabase(configWithTimestamp);
    
    if (!supabaseSuccess) {
        console.warn('[AutomationConfigService] Saved to localStorage only (Supabase unavailable)');
    } else {
        console.log('[AutomationConfigService] Saved to both localStorage and Supabase');
    }

    return { success: true, errors: [] };
};

/**
 * Reset configuration to defaults
 */
export const resetAutomationConfig = async (): Promise<AutomationConfig> => {
    const defaultWithTimestamp: AutomationConfig = {
        ...DEFAULT_CONFIG,
        updatedAt: new Date().toISOString()
    };

    await saveAutomationConfig(defaultWithTimestamp);
    return defaultWithTimestamp;
};

/**
 * Update specific section of configuration
 */
export const updateConfigSection = async <K extends keyof AutomationConfig>(
    section: K,
    value: AutomationConfig[K]
): Promise<{ success: boolean; errors: ValidationError[] }> => {
    const currentConfig = await loadAutomationConfig();
    const updatedConfig: AutomationConfig = {
        ...currentConfig,
        [section]: value
    };
    return saveAutomationConfig(updatedConfig);
};

/**
 * Toggle master switch
 */
export const toggleMasterSwitch = async (enabled: boolean): Promise<{
    success: boolean;
    errors: ValidationError[];
}> => {
    const currentConfig = await loadAutomationConfig();
    return saveAutomationConfig({
        ...currentConfig,
        masterEnabled: enabled
    });
};

/**
 * Synchronous load from localStorage only (for immediate UI use)
 */
export const loadAutomationConfigSync = (): AutomationConfig => {
    const localConfig = loadFromLocalStorage();
    return localConfig || { ...DEFAULT_CONFIG };
};

/**
 * WritgoCMS - Context Provider
 * 
 * This module provides React context for the CMS system,
 * managing site configuration, templates, and feature toggles.
 * 
 * Storage Strategy:
 * - Supabase is the source of truth for logged-in users
 * - localStorage serves as a fallback/cache for offline use and non-authenticated users
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import {
    SiteConfig,
    TemplateType,
    TemplateSettings,
    FeatureId,
    FeatureSettings,
    FeatureToggleState,
    TEMPLATES,
    FEATURES,
    createDefaultSiteConfig,
    getDefaultFeatureState,
} from './types';
import { siteService } from '../../services/siteService';
import { authService } from '../../services/authService';

// ============================================================================
// CONTEXT TYPES
// ============================================================================

interface CMSContextValue {
    // Site configuration
    siteConfig: SiteConfig | null;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
    
    // Template management
    currentTemplate: TemplateType;
    setTemplate: (template: TemplateType) => void;
    updateTemplateSettings: (settings: Partial<TemplateSettings>) => void;
    
    // Feature management
    isFeatureEnabled: (featureId: FeatureId) => boolean;
    toggleFeature: (featureId: FeatureId, enabled: boolean) => void;
    updateFeatureSettings: (featureId: FeatureId, settings: FeatureSettings) => void;
    
    // Site config management
    updateSiteConfig: (config: Partial<SiteConfig>) => void;
    saveSiteConfig: () => Promise<boolean>;
    resetToDefaults: () => void;
    
    // Setup wizard
    isSetupComplete: boolean;
    completeSetup: (config: Partial<SiteConfig>) => Promise<void>;
    
    // Migration from Productpraat
    migrateFromProductpraat: () => Promise<void>;
}

const CMSContext = createContext<CMSContextValue | null>(null);

// ============================================================================
// STORAGE KEY
// ============================================================================

const CMS_CONFIG_KEY = 'writgo_cms_config';
const CMS_SETUP_KEY = 'writgo_cms_setup_complete';

// ============================================================================
// CMS PROVIDER
// ============================================================================

interface CMSProviderProps {
    children: ReactNode;
}

export const CMSProvider: React.FC<CMSProviderProps> = ({ children }) => {
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [savedConfigHash, setSavedConfigHash] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    
    // Track if we've already synced to Supabase to avoid duplicate saves
    const hasSyncedToSupabase = useRef(false);

    // Helper to create a hash of config for comparison
    const getConfigHash = useCallback((config: SiteConfig | null): string => {
        if (!config) return '';
        return JSON.stringify(config);
    }, []);

    // Track unsaved changes
    useEffect(() => {
        if (siteConfig && savedConfigHash !== null) {
            const currentHash = getConfigHash(siteConfig);
            setHasUnsavedChanges(currentHash !== savedConfigHash);
        }
    }, [siteConfig, savedConfigHash, getConfigHash]);

    // Load configuration on mount
    useEffect(() => {
        const loadConfig = async () => {
            setIsLoading(true);
            try {
                // Check if setup is complete (from localStorage)
                const setupComplete = localStorage.getItem(CMS_SETUP_KEY) === 'true';
                setIsSetupComplete(setupComplete);

                // Check if user is authenticated
                const authenticated = await authService.isAuthenticated();
                setIsAuthenticated(authenticated);

                if (authenticated) {
                    // Try to fetch from Supabase first (source of truth)
                    console.log('[CMS] User authenticated, fetching from Supabase...');
                    const result = await siteService.getMySite();
                    
                    if (result.success && result.data) {
                        // Found config in Supabase
                        setSiteConfig(result.data);
                        const configStr = JSON.stringify(result.data);
                        setSavedConfigHash(configStr);
                        // Also update localStorage as cache
                        localStorage.setItem(CMS_CONFIG_KEY, configStr);
                        hasSyncedToSupabase.current = true;
                        console.log('[CMS] Loaded config from Supabase');
                    } else if (result.success && result.data === null) {
                        // User is authenticated but has no site in DB
                        // Check localStorage for existing config to migrate
                        const savedConfig = localStorage.getItem(CMS_CONFIG_KEY);
                        if (savedConfig) {
                            // Migrate localStorage config to Supabase
                            const parsed = JSON.parse(savedConfig) as SiteConfig;
                            console.log('[CMS] Migrating localStorage config to Supabase...');
                            const createResult = await siteService.createSite(parsed);
                            if (createResult.success && createResult.data) {
                                setSiteConfig(createResult.data);
                                const configStr = JSON.stringify(createResult.data);
                                setSavedConfigHash(configStr);
                                localStorage.setItem(CMS_CONFIG_KEY, configStr);
                                hasSyncedToSupabase.current = true;
                                console.log('[CMS] Migrated localStorage config to Supabase');
                            } else {
                                // Migration failed, use localStorage
                                console.warn('[CMS] Migration to Supabase failed, using localStorage:', createResult.error);
                                setSiteConfig(parsed);
                                setSavedConfigHash(savedConfig);
                            }
                        } else {
                            // No config anywhere, create default and save to Supabase
                            const defaultConfig = createDefaultSiteConfig('WritgoCMS', 'shop');
                            const fullConfig: SiteConfig = {
                                ...defaultConfig,
                                id: `site-${Date.now()}`,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                migratedFromProductpraat: false,
                            };
                            console.log('[CMS] Creating default config in Supabase...');
                            const createResult = await siteService.createSite(fullConfig);
                            if (createResult.success && createResult.data) {
                                setSiteConfig(createResult.data);
                                const configStr = JSON.stringify(createResult.data);
                                setSavedConfigHash(configStr);
                                localStorage.setItem(CMS_CONFIG_KEY, configStr);
                                hasSyncedToSupabase.current = true;
                                console.log('[CMS] Created default config in Supabase');
                            } else {
                                // Creation failed, use local config
                                console.warn('[CMS] Supabase creation failed, using local config:', createResult.error);
                                setSiteConfig(fullConfig);
                                const configStr = JSON.stringify(fullConfig);
                                setSavedConfigHash(configStr);
                            }
                        }
                    } else {
                        // Supabase fetch failed, fallback to localStorage
                        console.warn('[CMS] Supabase fetch failed, falling back to localStorage:', result.error);
                        await loadFromLocalStorage();
                    }
                } else {
                    // Not authenticated, use localStorage
                    console.log('[CMS] User not authenticated, using localStorage');
                    await loadFromLocalStorage();
                }
            } catch (e) {
                console.error('[CMS] Failed to load config:', e);
                setError('Kon CMS configuratie niet laden');
                // Fallback to localStorage on any error
                await loadFromLocalStorage();
            } finally {
                setIsLoading(false);
            }
        };

        const loadFromLocalStorage = async () => {
            const savedConfig = localStorage.getItem(CMS_CONFIG_KEY);
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig) as SiteConfig;
                setSiteConfig(parsed);
                setSavedConfigHash(savedConfig);
                console.log('[CMS] Loaded existing config from localStorage');
            } else {
                // Create default config
                const defaultConfig = createDefaultSiteConfig('WritgoCMS', 'shop');
                const fullConfig: SiteConfig = {
                    ...defaultConfig,
                    id: `site-${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    migratedFromProductpraat: false,
                };
                setSiteConfig(fullConfig);
                const configStr = JSON.stringify(fullConfig);
                setSavedConfigHash(configStr);
                console.log('[CMS] Created default config');
            }
        };

        loadConfig();
    }, []);

    // Get current template
    const currentTemplate = siteConfig?.templateType || 'shop';

    // Set template
    const setTemplate = useCallback((template: TemplateType) => {
        if (!siteConfig) return;
        
        const newTemplateConfig = TEMPLATES[template];
        const newFeatures = getDefaultFeatureState(template);
        
        setSiteConfig(prev => prev ? {
            ...prev,
            templateType: template,
            templateSettings: { ...newTemplateConfig.settings },
            features: newFeatures,
            updatedAt: new Date().toISOString(),
        } : prev);
    }, [siteConfig]);

    // Update template settings
    const updateTemplateSettings = useCallback((settings: Partial<TemplateSettings>) => {
        setSiteConfig(prev => prev ? {
            ...prev,
            templateSettings: { ...prev.templateSettings, ...settings },
            updatedAt: new Date().toISOString(),
        } : prev);
    }, []);

    // Check if feature is enabled
    const isFeatureEnabled = useCallback((featureId: FeatureId): boolean => {
        if (!siteConfig) return false;
        
        const feature = siteConfig.features.find(f => f.featureId === featureId);
        if (!feature) {
            // If feature not in config, check if it's a core feature
            const featureConfig = FEATURES[featureId];
            return featureConfig?.isCore || false;
        }
        return feature.enabled;
    }, [siteConfig]);

    // Toggle feature with immediate save
    const toggleFeature = useCallback((featureId: FeatureId, enabled: boolean) => {
        if (!siteConfig) return;
        
        // Don't allow disabling core features
        const featureConfig = FEATURES[featureId];
        if (featureConfig?.isCore && !enabled) {
            console.warn(`[CMS] Cannot disable core feature: ${featureId}`);
            return;
        }
        
        console.log(`[CMS] Toggle feature: ${featureId} -> ${enabled ? 'ON' : 'OFF'}`);
        
        setSiteConfig(prev => {
            if (!prev) return prev;
            
            const existingIndex = prev.features.findIndex(f => f.featureId === featureId);
            const newFeatures = [...prev.features];
            
            if (existingIndex >= 0) {
                newFeatures[existingIndex] = { ...newFeatures[existingIndex], enabled };
            } else {
                newFeatures.push({ featureId, enabled });
            }
            
            const newConfig = {
                ...prev,
                features: newFeatures,
                updatedAt: new Date().toISOString(),
            };
            
            // Immediate save for feature toggles - localStorage first
            try {
                localStorage.setItem(CMS_CONFIG_KEY, JSON.stringify(newConfig));
                console.log(`[CMS] Feature ${featureId} saved to localStorage`);
                
                // Also sync to Supabase if authenticated (async, non-blocking)
                if (isAuthenticated) {
                    siteService.updateSiteConfig(newConfig).then(result => {
                        if (result.success) {
                            console.log(`[CMS] Feature ${featureId} synced to Supabase`);
                        } else {
                            console.warn(`[CMS] Feature ${featureId} Supabase sync failed:`, result.error);
                        }
                    });
                }
            } catch (e) {
                console.error('[CMS] Failed to save feature toggle:', e);
            }
            
            return newConfig;
        });
    }, [siteConfig, isAuthenticated]);

    // Update feature settings
    const updateFeatureSettings = useCallback((featureId: FeatureId, settings: FeatureSettings) => {
        setSiteConfig(prev => {
            if (!prev) return prev;
            
            const existingIndex = prev.features.findIndex(f => f.featureId === featureId);
            const newFeatures = [...prev.features];
            
            if (existingIndex >= 0) {
                newFeatures[existingIndex] = { 
                    ...newFeatures[existingIndex], 
                    settings: { ...newFeatures[existingIndex].settings, ...settings } as FeatureSettings
                };
            } else {
                newFeatures.push({ featureId, enabled: true, settings });
            }
            
            return {
                ...prev,
                features: newFeatures,
                updatedAt: new Date().toISOString(),
            };
        });
    }, []);

    // Update site config
    const updateSiteConfig = useCallback((config: Partial<SiteConfig>) => {
        setSiteConfig(prev => prev ? {
            ...prev,
            ...config,
            updatedAt: new Date().toISOString(),
        } : prev);
    }, []);

    // Save site config to storage with feedback
    const saveSiteConfig = useCallback(async (): Promise<boolean> => {
        if (!siteConfig) {
            console.warn('[CMS] No config to save');
            return false;
        }
        
        setIsSaving(true);
        setError(null);
        console.log('[CMS] Saving config...');
        
        try {
            const configStr = JSON.stringify(siteConfig);
            
            // Always save to localStorage as cache
            localStorage.setItem(CMS_CONFIG_KEY, configStr);
            
            // If authenticated, also save to Supabase (source of truth)
            if (isAuthenticated) {
                console.log('[CMS] Saving to Supabase...');
                const result = await siteService.updateSiteConfig(siteConfig);
                if (!result.success) {
                    console.warn('[CMS] Supabase save failed:', result.error);
                    // Don't fail the save - localStorage worked
                    setError(`Lokaal opgeslagen, maar Supabase sync mislukt: ${result.error}`);
                } else {
                    console.log('[CMS] Saved to Supabase successfully');
                }
            }
            
            setSavedConfigHash(configStr);
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
            console.log('[CMS] Config saved successfully at', new Date().toISOString());
            return true;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Onbekende fout';
            console.error('[CMS] Failed to save config:', e);
            setError(`Kon configuratie niet opslaan: ${errorMsg}`);
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [siteConfig, isAuthenticated]);

    // Reset to defaults
    const resetToDefaults = useCallback(() => {
        const defaultConfig = createDefaultSiteConfig('WritgoCMS', 'shop');
        const fullConfig: SiteConfig = {
            ...defaultConfig,
            id: siteConfig?.id || `site-${Date.now()}`,
            createdAt: siteConfig?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setSiteConfig(fullConfig);
    }, [siteConfig?.id, siteConfig?.createdAt]);

    // Complete setup wizard
    const completeSetup = useCallback(async (config: Partial<SiteConfig>) => {
        const fullConfig: SiteConfig = {
            ...(siteConfig || createDefaultSiteConfig('WritgoCMS', 'shop')),
            ...config,
            id: siteConfig?.id || `site-${Date.now()}`,
            createdAt: siteConfig?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as SiteConfig;
        
        setSiteConfig(fullConfig);
        const configStr = JSON.stringify(fullConfig);
        localStorage.setItem(CMS_CONFIG_KEY, configStr);
        localStorage.setItem(CMS_SETUP_KEY, 'true');
        setIsSetupComplete(true);
        
        // Sync to Supabase if authenticated
        if (isAuthenticated) {
            try {
                // Check if site exists in Supabase
                const existingResult = await siteService.getMySite();
                if (existingResult.success && existingResult.data) {
                    // Update existing site
                    const updateResult = await siteService.updateSiteConfig(fullConfig);
                    if (!updateResult.success) {
                        console.warn('[CMS] Failed to update site in Supabase:', updateResult.error);
                    }
                } else {
                    // Create new site
                    const createResult = await siteService.createSite(fullConfig);
                    if (!createResult.success) {
                        console.warn('[CMS] Failed to create site in Supabase:', createResult.error);
                    }
                }
            } catch (e) {
                console.error('[CMS] Error syncing setup to Supabase:', e);
            }
        }
    }, [siteConfig, isAuthenticated]);

    // Migrate from Productpraat
    const migrateFromProductpraat = useCallback(async () => {
        // This function preserves existing Productpraat data while enabling CMS features
        const shopConfig = createDefaultSiteConfig('ProductPraat', 'shop');
        const fullConfig: SiteConfig = {
            ...shopConfig,
            id: siteConfig?.id || `site-${Date.now()}`,
            name: 'ProductPraat',
            description: 'AI Powered Affiliate Platform',
            createdAt: siteConfig?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            migratedFromProductpraat: true,
            legacyData: {
                migratedAt: new Date().toISOString(),
            },
        };
        
        setSiteConfig(fullConfig);
        const configStr = JSON.stringify(fullConfig);
        localStorage.setItem(CMS_CONFIG_KEY, configStr);
        localStorage.setItem(CMS_SETUP_KEY, 'true');
        setIsSetupComplete(true);
        
        // Sync to Supabase if authenticated
        if (isAuthenticated) {
            try {
                // Check if site exists in Supabase
                const existingResult = await siteService.getMySite();
                if (existingResult.success && existingResult.data) {
                    // Update existing site
                    const updateResult = await siteService.updateSiteConfig(fullConfig);
                    if (!updateResult.success) {
                        console.warn('[CMS] Failed to update site in Supabase during migration:', updateResult.error);
                    }
                } else {
                    // Create new site
                    const createResult = await siteService.createSite(fullConfig);
                    if (!createResult.success) {
                        console.warn('[CMS] Failed to create site in Supabase during migration:', createResult.error);
                    }
                }
            } catch (e) {
                console.error('[CMS] Error syncing migration to Supabase:', e);
            }
        }
    }, [siteConfig, isAuthenticated]);

    // Auto-save when config changes (debounced)
    useEffect(() => {
        if (siteConfig && isSetupComplete && !isLoading) {
            const timeoutId = setTimeout(async () => {
                try {
                    const configStr = JSON.stringify(siteConfig);
                    localStorage.setItem(CMS_CONFIG_KEY, configStr);
                    setSavedConfigHash(configStr);
                    setHasUnsavedChanges(false);
                    console.log('[CMS] Auto-saved config to localStorage');
                    
                    // Also sync to Supabase if authenticated (debounced)
                    if (isAuthenticated && hasSyncedToSupabase.current) {
                        const result = await siteService.updateSiteConfig(siteConfig);
                        if (result.success) {
                            console.log('[CMS] Auto-synced config to Supabase');
                        } else {
                            console.warn('[CMS] Auto-sync to Supabase failed:', result.error);
                        }
                    }
                } catch (e) {
                    console.error('[CMS] Auto-save failed:', e);
                }
            }, 1500); // Slightly longer debounce to avoid conflicts
            
            return () => clearTimeout(timeoutId);
        }
    }, [siteConfig, isSetupComplete, isLoading, isAuthenticated]);

    const value: CMSContextValue = {
        siteConfig,
        isLoading,
        isSaving,
        error,
        lastSaved,
        hasUnsavedChanges,
        currentTemplate,
        setTemplate,
        updateTemplateSettings,
        isFeatureEnabled,
        toggleFeature,
        updateFeatureSettings,
        updateSiteConfig,
        saveSiteConfig,
        resetToDefaults,
        isSetupComplete,
        completeSetup,
        migrateFromProductpraat,
    };

    return (
        <CMSContext.Provider value={value}>
            {children}
        </CMSContext.Provider>
    );
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access CMS context
 */
export const useCMS = (): CMSContextValue => {
    const context = useContext(CMSContext);
    if (!context) {
        throw new Error('useCMS must be used within a CMSProvider');
    }
    return context;
};

/**
 * Hook to check if a specific feature is enabled
 */
export const useFeature = (featureId: FeatureId): boolean => {
    const { isFeatureEnabled } = useCMS();
    return isFeatureEnabled(featureId);
};

/**
 * Hook to get current template configuration
 */
export const useTemplate = () => {
    const { currentTemplate, siteConfig } = useCMS();
    const templateConfig = TEMPLATES[currentTemplate];
    
    return {
        type: currentTemplate,
        config: templateConfig,
        settings: siteConfig?.templateSettings || templateConfig.settings,
    };
};

/**
 * Hook to get feature toggle state and controls
 */
export const useFeatureToggle = (featureId: FeatureId) => {
    const { isFeatureEnabled, toggleFeature, updateFeatureSettings, siteConfig } = useCMS();
    const featureConfig = FEATURES[featureId];
    const featureState = siteConfig?.features.find(f => f.featureId === featureId);
    
    return {
        enabled: isFeatureEnabled(featureId),
        config: featureConfig,
        settings: featureState?.settings,
        toggle: (enabled: boolean) => toggleFeature(featureId, enabled),
        updateSettings: (settings: FeatureSettings) => updateFeatureSettings(featureId, settings),
    };
};

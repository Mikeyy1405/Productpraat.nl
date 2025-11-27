/**
 * WritgoCMS - Context Provider
 * 
 * This module provides React context for the CMS system,
 * managing site configuration, templates, and feature toggles.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
                // Check if setup is complete
                const setupComplete = localStorage.getItem(CMS_SETUP_KEY) === 'true';
                setIsSetupComplete(setupComplete);

                // Load saved config or create default
                const savedConfig = localStorage.getItem(CMS_CONFIG_KEY);
                if (savedConfig) {
                    const parsed = JSON.parse(savedConfig) as SiteConfig;
                    setSiteConfig(parsed);
                    setSavedConfigHash(savedConfig);
                    console.log('[CMS] Loaded existing config');
                } else {
                    // Create default config based on existing Productpraat setup
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
            } catch (e) {
                console.error('[CMS] Failed to load config:', e);
                setError('Kon CMS configuratie niet laden');
            } finally {
                setIsLoading(false);
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
            
            // Immediate save for feature toggles
            try {
                localStorage.setItem(CMS_CONFIG_KEY, JSON.stringify(newConfig));
                console.log(`[CMS] Feature ${featureId} saved immediately`);
            } catch (e) {
                console.error('[CMS] Failed to save feature toggle:', e);
            }
            
            return newConfig;
        });
    }, [siteConfig]);

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
            localStorage.setItem(CMS_CONFIG_KEY, configStr);
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
    }, [siteConfig]);

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
        localStorage.setItem(CMS_CONFIG_KEY, JSON.stringify(fullConfig));
        localStorage.setItem(CMS_SETUP_KEY, 'true');
        setIsSetupComplete(true);
    }, [siteConfig]);

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
        localStorage.setItem(CMS_CONFIG_KEY, JSON.stringify(fullConfig));
        localStorage.setItem(CMS_SETUP_KEY, 'true');
        setIsSetupComplete(true);
    }, [siteConfig]);

    // Auto-save when config changes (debounced)
    useEffect(() => {
        if (siteConfig && isSetupComplete && !isLoading) {
            const timeoutId = setTimeout(() => {
                try {
                    const configStr = JSON.stringify(siteConfig);
                    localStorage.setItem(CMS_CONFIG_KEY, configStr);
                    setSavedConfigHash(configStr);
                    setHasUnsavedChanges(false);
                    console.log('[CMS] Auto-saved config');
                } catch (e) {
                    console.error('[CMS] Auto-save failed:', e);
                }
            }, 1500); // Slightly longer debounce to avoid conflicts
            
            return () => clearTimeout(timeoutId);
        }
    }, [siteConfig, isSetupComplete, isLoading]);

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

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
    error: string | null;
    
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
    saveSiteConfig: () => Promise<void>;
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
    const [error, setError] = useState<string | null>(null);
    const [isSetupComplete, setIsSetupComplete] = useState(false);

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
                }
            } catch (e) {
                console.error('Failed to load CMS config:', e);
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

    // Toggle feature
    const toggleFeature = useCallback((featureId: FeatureId, enabled: boolean) => {
        if (!siteConfig) return;
        
        // Don't allow disabling core features
        const featureConfig = FEATURES[featureId];
        if (featureConfig?.isCore && !enabled) {
            console.warn(`Cannot disable core feature: ${featureId}`);
            return;
        }
        
        setSiteConfig(prev => {
            if (!prev) return prev;
            
            const existingIndex = prev.features.findIndex(f => f.featureId === featureId);
            const newFeatures = [...prev.features];
            
            if (existingIndex >= 0) {
                newFeatures[existingIndex] = { ...newFeatures[existingIndex], enabled };
            } else {
                newFeatures.push({ featureId, enabled });
            }
            
            return {
                ...prev,
                features: newFeatures,
                updatedAt: new Date().toISOString(),
            };
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

    // Save site config to storage
    const saveSiteConfig = useCallback(async () => {
        if (!siteConfig) return;
        
        try {
            localStorage.setItem(CMS_CONFIG_KEY, JSON.stringify(siteConfig));
            console.log('CMS config saved successfully');
        } catch (e) {
            console.error('Failed to save CMS config:', e);
            throw new Error('Kon configuratie niet opslaan');
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

    // Auto-save when config changes
    useEffect(() => {
        if (siteConfig && isSetupComplete) {
            const timeoutId = setTimeout(() => {
                localStorage.setItem(CMS_CONFIG_KEY, JSON.stringify(siteConfig));
            }, 1000);
            
            return () => clearTimeout(timeoutId);
        }
    }, [siteConfig, isSetupComplete]);

    const value: CMSContextValue = {
        siteConfig,
        isLoading,
        error,
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

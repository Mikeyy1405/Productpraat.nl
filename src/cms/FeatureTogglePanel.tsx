/**
 * WritgoCMS - Feature Toggle Panel Component
 * 
 * Allows users to enable/disable features and configure feature settings.
 */

import React, { useState } from 'react';
import { 
    FeatureId, 
    FeatureConfig, 
    FeatureCategory,
    FEATURES, 
    CATEGORY_LABELS,
    getFeaturesByCategory,
} from './types';
import { useCMS, useFeatureToggle } from './CMSContext';

interface FeatureTogglePanelProps {
    showCategories?: boolean;
    editableSettings?: boolean;
}

export const FeatureTogglePanel: React.FC<FeatureTogglePanelProps> = ({
    showCategories = true,
    editableSettings = true,
}) => {
    const { currentTemplate, siteConfig } = useCMS();
    const [expandedFeature, setExpandedFeature] = useState<FeatureId | null>(null);
    const [activeCategory, setActiveCategory] = useState<FeatureCategory | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const featuresByCategory = getFeaturesByCategory();

    // Filter features based on template compatibility, category, and search
    const getFilteredFeatures = (): FeatureConfig[] => {
        let features = Object.values(FEATURES).filter(
            f => f.templateCompatibility.includes(currentTemplate)
        );

        if (activeCategory !== 'all') {
            features = features.filter(f => f.category === activeCategory);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            features = features.filter(
                f => f.name.toLowerCase().includes(term) || 
                     f.description.toLowerCase().includes(term)
            );
        }

        return features;
    };

    const filteredFeatures = getFilteredFeatures();
    
    // Count enabled features
    const enabledCount = siteConfig?.features.filter(f => f.enabled).length || 0;
    const totalAvailable = Object.values(FEATURES).filter(
        f => f.templateCompatibility.includes(currentTemplate)
    ).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Feature Toggles</h2>
                    <p className="text-slate-400">
                        Schakel functionaliteiten in of uit voor je website. 
                        <span className="text-blue-400 ml-1">
                            {enabledCount} van {totalAvailable} actief
                        </span>
                    </p>
                </div>
                
                {/* Search */}
                <div className="relative w-full md:w-64">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Zoek functies..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none focus:border-blue-500 transition"
                    />
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                </div>
            </div>

            {/* Category tabs */}
            {showCategories && (
                <div className="flex flex-wrap gap-2 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                            activeCategory === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        Alle ({totalAvailable})
                    </button>
                    {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                        const count = featuresByCategory[category as FeatureCategory]?.filter(
                            f => f.templateCompatibility.includes(currentTemplate)
                        ).length || 0;
                        
                        if (count === 0) return null;
                        
                        return (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category as FeatureCategory)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                                    activeCategory === category
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Feature list */}
            <div className="space-y-3">
                {filteredFeatures.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                        <i className="fas fa-search text-4xl text-slate-700 mb-4"></i>
                        <h3 className="text-lg font-bold text-white mb-2">Geen functies gevonden</h3>
                        <p className="text-slate-400">Probeer een andere zoekterm of categorie.</p>
                    </div>
                ) : (
                    filteredFeatures.map(feature => (
                        <FeatureToggleCard
                            key={feature.id}
                            feature={feature}
                            isExpanded={expandedFeature === feature.id}
                            onToggleExpand={() => setExpandedFeature(
                                expandedFeature === feature.id ? null : feature.id
                            )}
                            editableSettings={editableSettings}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ============================================================================
// Feature Toggle Card Component
// ============================================================================

interface FeatureToggleCardProps {
    feature: FeatureConfig;
    isExpanded: boolean;
    onToggleExpand: () => void;
    editableSettings?: boolean;
}

const FeatureToggleCard: React.FC<FeatureToggleCardProps> = ({
    feature,
    isExpanded,
    onToggleExpand,
    editableSettings = true,
}) => {
    const { enabled, toggle, settings, updateSettings } = useFeatureToggle(feature.id);
    const [localSettings, setLocalSettings] = useState(settings || {});

    const handleToggle = () => {
        if (feature.isCore) return; // Can't disable core features
        toggle(!enabled);
    };

    const handleSettingChange = (key: string, value: string | boolean | number) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        updateSettings({ [key]: value });
    };

    // Static color classes to ensure Tailwind generates them
    const getCategoryClasses = (category: FeatureCategory): {
        border: string;
        bg: string;
        text: string;
        bgLight: string;
        toggle: string;
    } => {
        switch (category) {
            case 'core': 
                return {
                    border: 'border-blue-500/50',
                    bg: 'bg-blue-600/20',
                    text: 'text-blue-400',
                    bgLight: 'bg-blue-600/10',
                    toggle: 'bg-blue-600'
                };
            case 'content': 
                return {
                    border: 'border-purple-500/50',
                    bg: 'bg-purple-600/20',
                    text: 'text-purple-400',
                    bgLight: 'bg-purple-600/10',
                    toggle: 'bg-purple-600'
                };
            case 'engagement': 
                return {
                    border: 'border-pink-500/50',
                    bg: 'bg-pink-600/20',
                    text: 'text-pink-400',
                    bgLight: 'bg-pink-600/10',
                    toggle: 'bg-pink-600'
                };
            case 'commerce': 
                return {
                    border: 'border-green-500/50',
                    bg: 'bg-green-600/20',
                    text: 'text-green-400',
                    bgLight: 'bg-green-600/10',
                    toggle: 'bg-green-600'
                };
            case 'seo_analytics': 
                return {
                    border: 'border-yellow-500/50',
                    bg: 'bg-yellow-600/20',
                    text: 'text-yellow-400',
                    bgLight: 'bg-yellow-600/10',
                    toggle: 'bg-yellow-600'
                };
            case 'communication': 
                return {
                    border: 'border-orange-500/50',
                    bg: 'bg-orange-600/20',
                    text: 'text-orange-400',
                    bgLight: 'bg-orange-600/10',
                    toggle: 'bg-orange-600'
                };
            default: 
                return {
                    border: 'border-slate-500/50',
                    bg: 'bg-slate-600/20',
                    text: 'text-slate-400',
                    bgLight: 'bg-slate-600/10',
                    toggle: 'bg-slate-600'
                };
        }
    };

    const categoryClasses = getCategoryClasses(feature.category);

    return (
        <div className={`
            bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300
            ${enabled ? categoryClasses.border : 'border-slate-800'}
        `}>
            {/* Main row */}
            <div className="p-4 flex items-center gap-4">
                {/* Icon */}
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                    ${enabled ? categoryClasses.bg : 'bg-slate-800'}
                `}>
                    <i className={`fas ${feature.icon} text-xl ${enabled ? categoryClasses.text : 'text-slate-500'}`}></i>
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-bold ${enabled ? 'text-white' : 'text-slate-400'}`}>
                            {feature.name}
                        </h3>
                        {feature.isCore && (
                            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                                Kern
                            </span>
                        )}
                        <span className={`text-xs ${categoryClasses.bgLight} ${categoryClasses.text} px-2 py-0.5 rounded`}>
                            {CATEGORY_LABELS[feature.category]}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">{feature.description}</p>
                </div>
                
                {/* Toggle */}
                <button
                    onClick={handleToggle}
                    disabled={feature.isCore}
                    className={`
                        relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0
                        ${feature.isCore ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        ${enabled ? categoryClasses.toggle : 'bg-slate-700'}
                    `}
                >
                    <span className={`
                        absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300
                        ${enabled ? 'left-8' : 'left-1'}
                    `}></span>
                </button>
                
                {/* Expand button */}
                {feature.settings && Object.keys(feature.settings).length > 0 && editableSettings && (
                    <button
                        onClick={onToggleExpand}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
                    >
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-sm`}></i>
                    </button>
                )}
            </div>
            
            {/* Settings panel */}
            {isExpanded && feature.settings && enabled && (
                <div className="px-4 pb-4 pt-0">
                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                        <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                            <i className="fas fa-cog"></i>
                            Instellingen
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(feature.settings).map(([key, defaultValue]) => {
                                const currentValue = localSettings[key] ?? defaultValue;
                                const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                                
                                return (
                                    <div key={key}>
                                        <label className="block text-xs font-medium text-slate-400 uppercase mb-2">
                                            {label}
                                        </label>
                                        
                                        {typeof defaultValue === 'boolean' ? (
                                            <button
                                                onClick={() => handleSettingChange(key, !currentValue)}
                                                className={`
                                                    w-full px-4 py-2 rounded-lg text-sm font-medium transition text-left flex items-center justify-between
                                                    ${currentValue ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}
                                                `}
                                            >
                                                <span>{currentValue ? 'Ingeschakeld' : 'Uitgeschakeld'}</span>
                                                <i className={`fas ${currentValue ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
                                            </button>
                                        ) : typeof defaultValue === 'number' ? (
                                            <input
                                                type="number"
                                                value={currentValue as number}
                                                onChange={(e) => handleSettingChange(key, parseInt(e.target.value))}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition"
                                            />
                                        ) : Array.isArray(defaultValue) ? (
                                            <div className="flex flex-wrap gap-1">
                                                {(defaultValue as string[]).map((item: string) => (
                                                    <span key={item} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={currentValue as string}
                                                onChange={(e) => handleSettingChange(key, e.target.value)}
                                                placeholder={`Voer ${label} in...`}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeatureTogglePanel;

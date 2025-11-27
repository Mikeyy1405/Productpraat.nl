/**
 * WritgoCMS - Dashboard Component
 * 
 * Main dashboard for CMS administration with template switching and feature management.
 */

import React, { useState, useCallback } from 'react';
import { 
    TEMPLATES, 
    FEATURES,
    TemplateSettings,
} from './types';
import { useCMS, useTemplate } from './CMSContext';
import { TemplateSelector } from './TemplateSelector';
import { FeatureTogglePanel } from './FeatureTogglePanel';
import { ContentManagementPanel } from './ContentManagementPanel';

interface CMSDashboardProps {
    onClose?: () => void;
}

type DashboardTab = 'overview' | 'templates' | 'features' | 'content' | 'settings';

export const CMSDashboard: React.FC<CMSDashboardProps> = ({ onClose }) => {
    const { siteConfig, saveSiteConfig, resetToDefaults, currentTemplate, updateSiteConfig, updateTemplateSettings } = useCMS();
    const template = useTemplate();
    const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
    const [isSaving, setIsSaving] = useState(false);

    // Helper to update template settings with proper typing
    const handleTemplateSettingChange = useCallback((key: keyof TemplateSettings, value: string) => {
        updateTemplateSettings({ [key]: value } as Partial<TemplateSettings>);
    }, [updateTemplateSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveSiteConfig();
        } finally {
            setIsSaving(false);
        }
    };

    // Count enabled features
    const enabledFeatures = siteConfig?.features.filter(f => f.enabled).length || 0;
    const totalFeatures = Object.values(FEATURES).filter(
        f => f.templateCompatibility.includes(currentTemplate)
    ).length;

    const tabs: { id: DashboardTab; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overzicht', icon: 'fa-th-large' },
        { id: 'templates', label: 'Templates', icon: 'fa-layer-group' },
        { id: 'features', label: 'Functies', icon: 'fa-puzzle-piece' },
        { id: 'content', label: 'Content Beheer', icon: 'fa-edit' },
        { id: 'settings', label: 'Instellingen', icon: 'fa-cog' },
    ];

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <i className="fas fa-sliders-h text-white"></i>
                        </div>
                        WritgoCMS Configuratie
                    </h1>
                    <p className="text-slate-400 mt-1">
                        Beheer templates, functies en instellingen van je website.
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center gap-2 transition-all"
                    >
                        {isSaving ? (
                            <><i className="fas fa-spinner fa-spin"></i> Opslaan...</>
                        ) : (
                            <><i className="fas fa-save"></i> Opslaan</>
                        )}
                    </button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium transition"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 bg-slate-900 p-2 rounded-xl border border-slate-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all
                            ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }
                        `}
                    >
                        <i className={`fas ${tab.icon}`}></i>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Quick stats */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Current template card */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-layer-group text-blue-400"></i>
                                Huidig Template
                            </h2>
                            
                            <div className="flex items-start gap-4">
                                <div className={`
                                    w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0
                                    bg-gradient-to-br from-blue-600 to-purple-600
                                `}>
                                    <i className={`fas ${TEMPLATES[currentTemplate].icon} text-2xl text-white`}></i>
                                </div>
                                
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white mb-1">
                                        {TEMPLATES[currentTemplate].name}
                                    </h3>
                                    <p className="text-sm text-slate-400 mb-3">
                                        {TEMPLATES[currentTemplate].description}
                                    </p>
                                    
                                    <button
                                        onClick={() => setActiveTab('templates')}
                                        className="text-sm text-blue-400 hover:text-blue-300 transition"
                                    >
                                        <i className="fas fa-exchange-alt mr-1"></i>
                                        Template wisselen
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Feature overview */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <i className="fas fa-puzzle-piece text-purple-400"></i>
                                Actieve Functies
                            </h2>
                            
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex-1 bg-slate-950 rounded-full h-4 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-500"
                                        style={{ width: `${(enabledFeatures / totalFeatures) * 100}%` }}
                                    ></div>
                                </div>
                                <span className="text-white font-bold">
                                    {enabledFeatures} / {totalFeatures}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {siteConfig?.features.filter(f => f.enabled).slice(0, 6).map(feature => {
                                    const config = FEATURES[feature.featureId];
                                    if (!config) return null;
                                    
                                    return (
                                        <div 
                                            key={feature.featureId}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-center gap-2"
                                        >
                                            <i className={`fas ${config.icon} text-blue-400 text-sm`}></i>
                                            <span className="text-xs text-slate-300 truncate">{config.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {enabledFeatures > 6 && (
                                <button
                                    onClick={() => setActiveTab('features')}
                                    className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition"
                                >
                                    +{enabledFeatures - 6} meer functies bekijken
                                </button>
                            )}
                        </div>
                    </div>
                    
                    {/* Side panel */}
                    <div className="space-y-6">
                        {/* Quick actions */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Snelle Acties</h2>
                            
                            <div className="space-y-2">
                                <button
                                    onClick={() => setActiveTab('templates')}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-medium text-left flex items-center gap-3 transition"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                        <i className="fas fa-layer-group text-blue-400"></i>
                                    </div>
                                    <span>Template Wijzigen</span>
                                </button>
                                
                                <button
                                    onClick={() => setActiveTab('features')}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-medium text-left flex items-center gap-3 transition"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                                        <i className="fas fa-puzzle-piece text-purple-400"></i>
                                    </div>
                                    <span>Functies Beheren</span>
                                </button>
                                
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl font-medium text-left flex items-center gap-3 transition"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                                        <i className="fas fa-cog text-green-400"></i>
                                    </div>
                                    <span>Instellingen</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* Site info */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Site Info</h2>
                            
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Naam</div>
                                    <div className="text-white font-medium">{siteConfig?.name || 'Niet ingesteld'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Template</div>
                                    <div className="text-white font-medium">{TEMPLATES[currentTemplate].name}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Laatst bijgewerkt</div>
                                    <div className="text-white font-medium">
                                        {siteConfig?.updatedAt 
                                            ? new Date(siteConfig.updatedAt).toLocaleString('nl-NL')
                                            : 'Onbekend'
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'templates' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <TemplateSelector showPreview={true} compact={false} />
                </div>
            )}

            {activeTab === 'features' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <FeatureTogglePanel showCategories={true} editableSettings={true} />
                </div>
            )}

            {activeTab === 'content' && (
                <ContentManagementPanel />
            )}

            {activeTab === 'settings' && (
                <div className="space-y-6">
                    {/* Site settings */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i className="fas fa-info-circle text-blue-400"></i>
                            Algemene Instellingen
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2">
                                    Website Naam
                                </label>
                                <input
                                    type="text"
                                    value={siteConfig?.name || ''}
                                    onChange={(e) => updateSiteConfig({ name: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2">
                                    Beschrijving
                                </label>
                                <input
                                    type="text"
                                    value={siteConfig?.description || ''}
                                    onChange={(e) => updateSiteConfig({ description: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Template settings */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i className="fas fa-palette text-purple-400"></i>
                            Template Instellingen
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2">
                                    Hoofdkleur
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={template.settings.primaryColor}
                                        onChange={(e) => handleTemplateSettingChange('primaryColor', e.target.value)}
                                        className="w-12 h-12 rounded-lg border-2 border-slate-700 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={template.settings.primaryColor}
                                        onChange={(e) => handleTemplateSettingChange('primaryColor', e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition font-mono"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2">
                                    Secundaire Kleur
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={template.settings.secondaryColor}
                                        onChange={(e) => handleTemplateSettingChange('secondaryColor', e.target.value)}
                                        className="w-12 h-12 rounded-lg border-2 border-slate-700 cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={template.settings.secondaryColor}
                                        onChange={(e) => handleTemplateSettingChange('secondaryColor', e.target.value)}
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition font-mono"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-2">
                                    Lettertype
                                </label>
                                <select
                                    value={template.settings.fontFamily}
                                    onChange={(e) => handleTemplateSettingChange('fontFamily', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                >
                                    <option value="Inter">Inter (Modern)</option>
                                    <option value="Georgia">Georgia (Klassiek)</option>
                                    <option value="Roboto">Roboto (Clean)</option>
                                    <option value="Poppins">Poppins (Friendly)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    {/* Danger zone */}
                    <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i>
                            Gevaarlijke Zone
                        </h2>
                        
                        <p className="text-sm text-red-200/70 mb-4">
                            Deze acties kunnen niet ongedaan worden gemaakt. Wees voorzichtig.
                        </p>
                        
                        <button
                            onClick={() => {
                                if (confirm('Weet je zeker dat je alle CMS instellingen wilt resetten naar de standaardwaarden?')) {
                                    resetToDefaults();
                                }
                            }}
                            className="bg-red-600/20 border border-red-500/50 text-red-400 hover:bg-red-600/30 px-4 py-2 rounded-xl font-medium transition flex items-center gap-2"
                        >
                            <i className="fas fa-undo"></i>
                            Reset naar Standaardwaarden
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CMSDashboard;

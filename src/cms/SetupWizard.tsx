/**
 * WritgoCMS - Setup Wizard Component
 * 
 * A guided setup process for new users to configure their CMS.
 */

import React, { useState } from 'react';
import { 
    TemplateType, 
    TEMPLATES, 
    SiteConfig,
    getDefaultFeatureState,
} from './types';
import { useCMS } from './CMSContext';
import { TemplateSelector } from './TemplateSelector';
import { FeatureTogglePanel } from './FeatureTogglePanel';

interface SetupWizardProps {
    onComplete?: () => void;
    showMigrationOption?: boolean;
}

type WizardStep = 'welcome' | 'template' | 'features' | 'branding' | 'complete';

export const SetupWizard: React.FC<SetupWizardProps> = ({
    onComplete,
    showMigrationOption = true,
}) => {
    const { completeSetup, migrateFromProductpraat, currentTemplate, setTemplate, updateSiteConfig, siteConfig } = useCMS();
    const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Form state
    const [siteName, setSiteName] = useState('');
    const [siteDescription, setSiteDescription] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#1877F2');
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('shop');

    const steps: { id: WizardStep; label: string; icon: string }[] = [
        { id: 'welcome', label: 'Welkom', icon: 'fa-hand-wave' },
        { id: 'template', label: 'Template', icon: 'fa-layer-group' },
        { id: 'features', label: 'Functies', icon: 'fa-puzzle-piece' },
        { id: 'branding', label: 'Branding', icon: 'fa-palette' },
        { id: 'complete', label: 'Klaar', icon: 'fa-check-circle' },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === currentStep);

    const handleNext = () => {
        const nextIndex = currentStepIndex + 1;
        if (nextIndex < steps.length) {
            setCurrentStep(steps[nextIndex].id);
        }
    };

    const handlePrev = () => {
        const prevIndex = currentStepIndex - 1;
        if (prevIndex >= 0) {
            setCurrentStep(steps[prevIndex].id);
        }
    };

    const handleTemplateSelect = (template: TemplateType) => {
        setSelectedTemplate(template);
        setTemplate(template);
        setPrimaryColor(TEMPLATES[template].settings.primaryColor);
    };

    const handleMigrate = async () => {
        setIsProcessing(true);
        try {
            await migrateFromProductpraat();
            onComplete?.();
        } catch (e) {
            console.error('Migration failed:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = async () => {
        setIsProcessing(true);
        try {
            const config: Partial<SiteConfig> = {
                name: siteName || 'Mijn Website',
                description: siteDescription,
                templateType: selectedTemplate,
                templateSettings: {
                    ...TEMPLATES[selectedTemplate].settings,
                    primaryColor,
                },
                features: getDefaultFeatureState(selectedTemplate),
            };
            
            await completeSetup(config);
            setCurrentStep('complete');
        } catch (e) {
            console.error('Setup failed:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinish = () => {
        onComplete?.();
    };

    // Render step content
    const renderStepContent = () => {
        switch (currentStep) {
            case 'welcome':
                return (
                    <div className="text-center space-y-8 max-w-2xl mx-auto">
                        {/* Logo */}
                        <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
                            <i className="fas fa-rocket text-4xl text-white"></i>
                        </div>
                        
                        <div>
                            <h1 className="text-4xl font-black text-white mb-4">
                                Welkom bij <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">WritgoCMS</span>
                            </h1>
                            <p className="text-xl text-slate-400">
                                Maak in enkele minuten een professionele website met onze intuïtieve CMS.
                            </p>
                        </div>
                        
                        {/* Quick options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                            <button
                                onClick={handleNext}
                                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 transition-all"
                            >
                                <i className="fas fa-wand-magic-sparkles"></i>
                                Nieuwe Website
                            </button>
                            
                            {showMigrationOption && (
                                <button
                                    onClick={handleMigrate}
                                    disabled={isProcessing}
                                    className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-xl font-bold border border-slate-700 flex items-center justify-center gap-3 transition-all"
                                >
                                    {isProcessing ? (
                                        <><i className="fas fa-spinner fa-spin"></i> Migreren...</>
                                    ) : (
                                        <><i className="fas fa-download"></i> ProductPraat Behouden</>
                                    )}
                                </button>
                            )}
                        </div>
                        
                        {/* Features preview */}
                        <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-800">
                            {[
                                { icon: 'fa-layer-group', label: '3 Templates', desc: 'Shop, Blog, Zakelijk' },
                                { icon: 'fa-puzzle-piece', label: '20+ Functies', desc: 'Modulair & Flexibel' },
                                { icon: 'fa-mobile-alt', label: 'Responsive', desc: 'Mobiel Optimaal' },
                            ].map((feature, i) => (
                                <div key={i} className="text-center">
                                    <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 flex items-center justify-center mb-3">
                                        <i className={`fas ${feature.icon} text-blue-400`}></i>
                                    </div>
                                    <div className="font-bold text-white text-sm">{feature.label}</div>
                                    <div className="text-xs text-slate-500">{feature.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
                
            case 'template':
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-white mb-2">Kies je Template</h2>
                            <p className="text-slate-400">
                                Selecteer het type website dat het beste bij je past. 
                                Je kunt later altijd wisselen.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {Object.values(TEMPLATES).map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => handleTemplateSelect(template.id)}
                                    className={`
                                        p-6 rounded-2xl border-2 text-left transition-all duration-300
                                        ${selectedTemplate === template.id
                                            ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20'
                                            : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                                        }
                                    `}
                                >
                                    {/* Selected indicator */}
                                    {selectedTemplate === template.id && (
                                        <div className="absolute top-4 right-4">
                                            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                                <i className="fas fa-check text-white text-xs"></i>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className={`
                                        w-16 h-16 rounded-xl mb-4 flex items-center justify-center
                                        ${selectedTemplate === template.id ? 'bg-blue-600' : 'bg-slate-800'}
                                    `}>
                                        <i className={`fas ${template.icon} text-2xl ${selectedTemplate === template.id ? 'text-white' : 'text-slate-400'}`}></i>
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
                                    <p className="text-sm text-slate-400 mb-4">{template.description}</p>
                                    
                                    <div className="flex flex-wrap gap-1">
                                        {template.defaultFeatures.slice(0, 3).map(f => (
                                            <span key={f} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                                                {f.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                        {template.defaultFeatures.length > 3 && (
                                            <span className="text-xs text-slate-500">
                                                +{template.defaultFeatures.length - 3}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );
                
            case 'features':
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-white mb-2">Functionaliteiten</h2>
                            <p className="text-slate-400">
                                Pas je website aan met de functies die je nodig hebt. 
                                Standaard functies zijn al ingeschakeld.
                            </p>
                        </div>
                        
                        <div className="max-h-[500px] overflow-y-auto custom-scroll pr-2">
                            <FeatureTogglePanel showCategories={true} editableSettings={false} />
                        </div>
                    </div>
                );
                
            case 'branding':
                return (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-white mb-2">Branding & Identiteit</h2>
                            <p className="text-slate-400">
                                Geef je website een naam en kies je kleuren.
                            </p>
                        </div>
                        
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                            {/* Site name */}
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2">
                                    Website Naam
                                </label>
                                <input
                                    type="text"
                                    value={siteName}
                                    onChange={(e) => setSiteName(e.target.value)}
                                    placeholder="Bijv. Mijn Webshop"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                />
                            </div>
                            
                            {/* Site description */}
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2">
                                    Korte Beschrijving
                                </label>
                                <textarea
                                    value={siteDescription}
                                    onChange={(e) => setSiteDescription(e.target.value)}
                                    placeholder="Beschrijf je website in een paar zinnen..."
                                    rows={3}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition resize-none"
                                />
                            </div>
                            
                            {/* Primary color */}
                            <div>
                                <label className="block text-sm font-bold text-slate-300 mb-2">
                                    Hoofdkleur
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-12 h-12 rounded-lg border-2 border-slate-700 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={primaryColor}
                                            onChange={(e) => setPrimaryColor(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition font-mono"
                                        />
                                    </div>
                                </div>
                                
                                {/* Preset colors */}
                                <div className="flex gap-2 mt-3">
                                    {['#1877F2', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setPrimaryColor(color)}
                                            className={`w-8 h-8 rounded-lg transition-all ${primaryColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* Preview */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-slate-400 mb-4">Preview</h3>
                            <div 
                                className="h-32 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: primaryColor + '20' }}
                            >
                                <div className="text-center">
                                    <h4 className="text-2xl font-bold text-white mb-1">
                                        {siteName || 'Mijn Website'}
                                    </h4>
                                    <p className="text-sm text-slate-400">
                                        {siteDescription || 'Welkom bij mijn website'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
                
            case 'complete':
                return (
                    <div className="text-center space-y-8 max-w-2xl mx-auto">
                        <div className="w-24 h-24 mx-auto rounded-full bg-green-600/20 flex items-center justify-center">
                            <i className="fas fa-check text-5xl text-green-400"></i>
                        </div>
                        
                        <div>
                            <h2 className="text-4xl font-bold text-white mb-4">
                                🎉 Gefeliciteerd!
                            </h2>
                            <p className="text-xl text-slate-400">
                                Je website is klaar om te gebruiken. Je kunt nu beginnen met het toevoegen van content.
                            </p>
                        </div>
                        
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                            <h3 className="font-bold text-white mb-4">Samenvatting</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="text-left">
                                    <div className="text-slate-500">Website naam</div>
                                    <div className="text-white font-medium">{siteName || 'Mijn Website'}</div>
                                </div>
                                <div className="text-left">
                                    <div className="text-slate-500">Template</div>
                                    <div className="text-white font-medium">{TEMPLATES[selectedTemplate].name}</div>
                                </div>
                                <div className="text-left">
                                    <div className="text-slate-500">Actieve functies</div>
                                    <div className="text-white font-medium">{TEMPLATES[selectedTemplate].defaultFeatures.length}</div>
                                </div>
                                <div className="text-left">
                                    <div className="text-slate-500">Hoofdkleur</div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-4 h-4 rounded" style={{ backgroundColor: primaryColor }}></span>
                                        <span className="text-white font-medium font-mono">{primaryColor}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <button
                            onClick={handleFinish}
                            className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all"
                        >
                            <i className="fas fa-rocket mr-2"></i>
                            Start met je Website
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">
            {/* Progress bar */}
            {currentStep !== 'welcome' && currentStep !== 'complete' && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center justify-between max-w-4xl mx-auto">
                            {/* Steps */}
                            <div className="flex items-center gap-2">
                                {steps.filter(s => s.id !== 'welcome' && s.id !== 'complete').map((step, index) => {
                                    const stepIndex = steps.findIndex(s => s.id === step.id);
                                    const isActive = currentStepIndex === stepIndex;
                                    const isComplete = currentStepIndex > stepIndex;
                                    
                                    return (
                                        <React.Fragment key={step.id}>
                                            <div className={`
                                                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                                                ${isActive ? 'bg-blue-600 text-white' : isComplete ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-500'}
                                            `}>
                                                {isComplete ? <i className="fas fa-check text-xs"></i> : index + 1}
                                            </div>
                                            <span className={`hidden sm:inline text-sm ${isActive ? 'text-white font-medium' : 'text-slate-500'}`}>
                                                {step.label}
                                            </span>
                                            {index < 2 && (
                                                <div className={`w-8 h-0.5 ${isComplete ? 'bg-green-600' : 'bg-slate-800'}`}></div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                            
                            {/* Skip button */}
                            <button
                                onClick={() => setCurrentStep('complete')}
                                className="text-sm text-slate-500 hover:text-white transition"
                            >
                                Overslaan
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Content */}
            <div className={`flex-1 flex items-center justify-center p-4 ${currentStep !== 'welcome' && currentStep !== 'complete' ? 'pt-24' : ''}`}>
                <div className="w-full max-w-5xl">
                    {renderStepContent()}
                </div>
            </div>
            
            {/* Navigation buttons */}
            {currentStep !== 'welcome' && currentStep !== 'complete' && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 py-4">
                    <div className="container mx-auto px-4">
                        <div className="flex justify-between max-w-4xl mx-auto">
                            <button
                                onClick={handlePrev}
                                disabled={currentStepIndex <= 1}
                                className="px-6 py-3 rounded-xl font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <i className="fas fa-arrow-left mr-2"></i>
                                Vorige
                            </button>
                            
                            {currentStep === 'branding' ? (
                                <button
                                    onClick={handleComplete}
                                    disabled={isProcessing}
                                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"
                                >
                                    {isProcessing ? (
                                        <><i className="fas fa-spinner fa-spin mr-2"></i> Voltooien...</>
                                    ) : (
                                        <><i className="fas fa-check mr-2"></i> Voltooien</>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"
                                >
                                    Volgende
                                    <i className="fas fa-arrow-right ml-2"></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Styles */}
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
            `}</style>
        </div>
    );
};

export default SetupWizard;

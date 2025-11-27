/**
 * WritgoCMS - Template Selector Component
 * 
 * Allows users to select and preview different template types.
 */

import React, { useState } from 'react';
import { TemplateType, TEMPLATES, TemplateConfig } from './types';
import { useCMS } from './CMSContext';

interface TemplateSelectorProps {
    onSelect?: (template: TemplateType) => void;
    showPreview?: boolean;
    compact?: boolean;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
    onSelect,
    showPreview = true,
    compact = false,
}) => {
    const { currentTemplate, setTemplate } = useCMS();
    const [previewTemplate, setPreviewTemplate] = useState<TemplateType | null>(null);
    const [isChanging, setIsChanging] = useState(false);

    const handleSelect = async (templateType: TemplateType) => {
        if (templateType === currentTemplate) return;
        
        setIsChanging(true);
        
        // Confirm before switching templates
        const confirmed = window.confirm(
            `Weet je zeker dat je wilt wisselen naar het "${TEMPLATES[templateType].name}" template? Sommige instellingen worden gereset naar de standaardwaarden.`
        );
        
        if (confirmed) {
            setTemplate(templateType);
            onSelect?.(templateType);
        }
        
        setIsChanging(false);
    };

    const renderTemplateCard = (template: TemplateConfig, isSelected: boolean) => {
        const isHovered = previewTemplate === template.id;
        
        return (
            <div
                key={template.id}
                className={`
                    relative cursor-pointer transition-all duration-300
                    ${compact ? 'p-4' : 'p-6'}
                    rounded-2xl border-2
                    ${isSelected 
                        ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20' 
                        : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    }
                    ${isHovered && !isSelected ? 'scale-[1.02]' : ''}
                `}
                onClick={() => handleSelect(template.id)}
                onMouseEnter={() => setPreviewTemplate(template.id)}
                onMouseLeave={() => setPreviewTemplate(null)}
            >
                {/* Selected indicator */}
                {isSelected && (
                    <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <i className="fas fa-check text-white text-xs"></i>
                        </div>
                    </div>
                )}
                
                {/* Icon */}
                <div className={`
                    ${compact ? 'w-12 h-12' : 'w-16 h-16'} 
                    rounded-xl mb-4 flex items-center justify-center
                    ${isSelected ? 'bg-blue-600' : 'bg-slate-800'}
                `}>
                    <i className={`fas ${template.icon} ${compact ? 'text-xl' : 'text-2xl'} ${isSelected ? 'text-white' : 'text-slate-400'}`}></i>
                </div>
                
                {/* Title */}
                <h3 className={`font-bold text-white ${compact ? 'text-lg' : 'text-xl'} mb-2`}>
                    {template.name}
                </h3>
                
                {/* Description */}
                {!compact && (
                    <p className="text-sm text-slate-400 mb-4 line-clamp-3">
                        {template.description}
                    </p>
                )}
                
                {/* Feature highlights */}
                {!compact && (
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-slate-500 uppercase">Standaard functies:</div>
                        <div className="flex flex-wrap gap-1">
                            {template.defaultFeatures.slice(0, 4).map(feature => (
                                <span 
                                    key={feature}
                                    className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded"
                                >
                                    {feature.replace(/_/g, ' ')}
                                </span>
                            ))}
                            {template.defaultFeatures.length > 4 && (
                                <span className="text-xs text-slate-500">
                                    +{template.defaultFeatures.length - 4} meer
                                </span>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Select button */}
                {!isSelected && !compact && (
                    <button
                        className={`
                            mt-4 w-full py-2 rounded-lg text-sm font-medium transition
                            ${isHovered
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }
                        `}
                        disabled={isChanging}
                    >
                        {isChanging ? (
                            <><i className="fas fa-spinner fa-spin mr-2"></i> Wisselen...</>
                        ) : (
                            <>Selecteer Template</>
                        )}
                    </button>
                )}
            </div>
        );
    };

    const renderTemplatePreview = () => {
        const template = previewTemplate ? TEMPLATES[previewTemplate] : TEMPLATES[currentTemplate];
        
        return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <i className={`fas ${template.icon} text-blue-400`}></i>
                        {template.name} Preview
                    </h3>
                    {previewTemplate && previewTemplate !== currentTemplate && (
                        <span className="text-xs text-yellow-400">
                            <i className="fas fa-eye mr-1"></i> Preview mode
                        </span>
                    )}
                </div>
                
                {/* Preview area */}
                <div className="aspect-video bg-slate-950 relative overflow-hidden">
                    {/* Simplified preview mockup */}
                    <div className="absolute inset-0 p-4">
                        {/* Header mockup */}
                        <div 
                            className="h-12 rounded-lg mb-4 flex items-center justify-between px-4"
                            style={{ backgroundColor: template.settings.primaryColor + '20' }}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-slate-700"></div>
                                <div className="w-24 h-4 rounded bg-slate-700"></div>
                            </div>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="w-16 h-4 rounded bg-slate-700"></div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Content area mockup based on template */}
                        {template.id === 'shop' && (
                            <div className="grid grid-cols-4 gap-3">
                                {/* Sidebar for shop */}
                                <div className="col-span-1 bg-slate-800/50 rounded-lg p-3 space-y-2">
                                    <div className="w-full h-4 rounded bg-slate-700"></div>
                                    <div className="w-3/4 h-3 rounded bg-slate-700"></div>
                                    <div className="w-2/3 h-3 rounded bg-slate-700"></div>
                                    <div className="w-3/4 h-3 rounded bg-slate-700"></div>
                                </div>
                                {/* Product grid */}
                                <div className="col-span-3 grid grid-cols-3 gap-2">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="bg-slate-800/50 rounded-lg p-2">
                                            <div className="aspect-square rounded bg-slate-700 mb-2"></div>
                                            <div className="w-full h-3 rounded bg-slate-700 mb-1"></div>
                                            <div className="w-2/3 h-3 rounded bg-slate-700"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {template.id === 'business' && (
                            <div className="space-y-4">
                                {/* Hero section */}
                                <div 
                                    className="h-24 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: template.settings.primaryColor + '20' }}
                                >
                                    <div className="text-center">
                                        <div className="w-48 h-6 rounded bg-slate-700 mx-auto mb-2"></div>
                                        <div className="w-64 h-4 rounded bg-slate-700 mx-auto"></div>
                                    </div>
                                </div>
                                {/* Services grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-slate-800/50 rounded-lg p-3 text-center">
                                            <div className="w-10 h-10 rounded-full bg-slate-700 mx-auto mb-2"></div>
                                            <div className="w-20 h-3 rounded bg-slate-700 mx-auto mb-1"></div>
                                            <div className="w-full h-2 rounded bg-slate-700"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {template.id === 'blog' && (
                            <div className="grid grid-cols-3 gap-4">
                                {/* Main content */}
                                <div className="col-span-2 space-y-3">
                                    {[1, 2].map(i => (
                                        <div key={i} className="bg-slate-800/50 rounded-lg p-3 flex gap-3">
                                            <div className="w-24 h-20 rounded bg-slate-700 flex-shrink-0"></div>
                                            <div className="flex-1 space-y-2">
                                                <div className="w-3/4 h-4 rounded bg-slate-700"></div>
                                                <div className="w-full h-2 rounded bg-slate-700"></div>
                                                <div className="w-2/3 h-2 rounded bg-slate-700"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Sidebar */}
                                <div className="col-span-1 space-y-3">
                                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                                        <div className="w-20 h-4 rounded bg-slate-700"></div>
                                        <div className="w-full h-2 rounded bg-slate-700"></div>
                                        <div className="w-3/4 h-2 rounded bg-slate-700"></div>
                                    </div>
                                    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                                        <div className="w-16 h-4 rounded bg-slate-700"></div>
                                        <div className="flex flex-wrap gap-1">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} className="w-12 h-4 rounded bg-slate-700"></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Overlay with template colors */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: `linear-gradient(135deg, ${template.settings.primaryColor}10 0%, transparent 50%, ${template.settings.secondaryColor}10 100%)`
                        }}
                    ></div>
                </div>
                
                {/* Template info */}
                <div className="p-4 border-t border-slate-800">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-white">{template.defaultFeatures.length}</div>
                            <div className="text-xs text-slate-500">Standaard functies</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{template.availableFeatures.length}</div>
                            <div className="text-xs text-slate-500">Beschikbare functies</div>
                        </div>
                        <div>
                            <div 
                                className="w-8 h-8 rounded-lg mx-auto mb-1"
                                style={{ backgroundColor: template.settings.primaryColor }}
                            ></div>
                            <div className="text-xs text-slate-500">Hoofdkleur</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-2">Template Kiezen</h2>
                <p className="text-slate-400">
                    Selecteer het type website dat je wilt maken. Je kunt later altijd wisselen van template.
                </p>
            </div>
            
            {/* Template cards grid */}
            <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-1 lg:grid-cols-3'} gap-4`}>
                {Object.values(TEMPLATES).map(template => 
                    renderTemplateCard(template, currentTemplate === template.id)
                )}
            </div>
            
            {/* Preview */}
            {showPreview && !compact && (
                <div className="mt-6">
                    {renderTemplatePreview()}
                </div>
            )}
        </div>
    );
};

export default TemplateSelector;

/**
 * Automation Tab Component
 * 
 * Comprehensive automation control dashboard for managing all autonomous functions.
 * Includes settings for product generation, content generation, link monitoring,
 * commission tracking, notifications, and performance optimization.
 * 
 * @module components/AutomationTab
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CATEGORIES, AffiliateNetworkId } from '../types';
import {
    AutomationConfig,
    ContentType,
    CheckFrequency,
    SyncFrequency,
    AlertType,
    ValidationError
} from '../types/automationTypes';
import {
    loadAutomationConfig,
    saveAutomationConfig,
    resetAutomationConfig,
    DEFAULT_CONFIG
} from '../services/automationConfigService';

// ============================================================================
// TYPES
// ============================================================================

interface AutomationTabProps {
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface AutomationStatus {
    enabled: boolean;
    jobs: Record<string, { lastRun: string | null; status: string; nextRun: string | null }>;
    config: Record<string, string>;
}

type SubTab = 'overview' | 'products' | 'content' | 'monitoring' | 'notifications';

// ============================================================================
// COMPONENT
// ============================================================================

export const AutomationTab: React.FC<AutomationTabProps> = ({ showToast }) => {
    // State
    const [automationStatus, setAutomationStatus] = useState<AutomationStatus>({ 
        enabled: true, 
        jobs: {}, 
        config: {} 
    });
    const [automationLoading, setAutomationLoading] = useState(false);
    const [automationConfig, setAutomationConfig] = useState<AutomationConfig>(DEFAULT_CONFIG);
    const [automationConfigErrors, setAutomationConfigErrors] = useState<ValidationError[]>([]);
    const [automationSubTab, setAutomationSubTab] = useState<SubTab>('overview');

    // Load automation data on mount
    useEffect(() => {
        const fetchAutomationData = async () => {
            try {
                // Fetch server automation status
                const response = await fetch('/api/automation/status');
                if (response.ok) {
                    const data = await response.json();
                    setAutomationStatus(data);
                }
                
                // Load automation config from service
                const config = await loadAutomationConfig();
                setAutomationConfig(config);
            } catch (error) {
                console.error('Failed to fetch automation data:', error);
            }
        };
        fetchAutomationData();
        
        // Refresh every 30 seconds
        const interval = setInterval(fetchAutomationData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Handle master toggle
    const handleMasterToggle = useCallback(async () => {
        const newConfig = { ...automationConfig, masterEnabled: !automationConfig.masterEnabled };
        setAutomationConfig(newConfig);
        const result = await saveAutomationConfig(newConfig);
        if (result.success) {
            showToast(newConfig.masterEnabled ? 'Automation ingeschakeld' : 'Automation uitgeschakeld', 'success');
        } else {
            setAutomationConfigErrors(result.errors);
            showToast('Fout bij opslaan', 'error');
        }
    }, [automationConfig, showToast]);

    // Handle save
    const handleSave = useCallback(async () => {
        setAutomationLoading(true);
        const result = await saveAutomationConfig(automationConfig);
        setAutomationLoading(false);
        
        if (result.success) {
            setAutomationConfigErrors([]);
            showToast('Instellingen opgeslagen!', 'success');
        } else {
            setAutomationConfigErrors(result.errors);
            showToast('Validatie fouten - controleer de instellingen', 'error');
        }
    }, [automationConfig, showToast]);

    // Handle reset
    const handleReset = useCallback(async () => {
        if (confirm('Weet je zeker dat je alle instellingen wilt resetten naar de standaard waarden?')) {
            const defaultConfig = await resetAutomationConfig();
            setAutomationConfig(defaultConfig);
            setAutomationConfigErrors([]);
            showToast('Instellingen gereset naar standaard', 'success');
        }
    }, [showToast]);

    // Handle job trigger
    const handleTriggerJob = useCallback(async (jobId: string, jobName: string) => {
        try {
            setAutomationLoading(true);
            const response = await fetch(`/api/automation/trigger/${jobId}`, { method: 'POST' });
            if (response.ok) {
                showToast(`${jobName} gestart`, 'success');
            }
        } catch (error) {
            showToast(`Kon ${jobName} niet starten`, 'error');
        } finally {
            setAutomationLoading(false);
        }
    }, [showToast]);

    return (
        <div className="animate-fade-in space-y-6">
            {/* Master Switch Header */}
            <div className="bg-gradient-to-r from-cyan-900/30 to-slate-900 p-6 rounded-2xl border border-cyan-500/30">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <i className="fas fa-robot text-cyan-400"></i>
                            Automation Control Center
                        </h2>
                        <p className="text-slate-400 mt-1">Configureer alle autonome functies voor je affiliate platform</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Master Toggle */}
                        <div className="flex items-center gap-3 bg-slate-950 px-4 py-3 rounded-xl border border-slate-700">
                            <span className="text-sm font-medium text-slate-300">Master Switch</span>
                            <button
                                onClick={handleMasterToggle}
                                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                                    automationConfig.masterEnabled ? 'bg-green-500' : 'bg-slate-700'
                                }`}
                            >
                                <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all duration-300 shadow-lg ${
                                    automationConfig.masterEnabled ? 'left-8' : 'left-1'
                                }`}></div>
                            </button>
                            <span className={`text-sm font-bold ${automationConfig.masterEnabled ? 'text-green-400' : 'text-red-400'}`}>
                                {automationConfig.masterEnabled ? 'AAN' : 'UIT'}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Status Indicator */}
                <div className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-lg w-fit ${
                    automationConfig.masterEnabled 
                        ? 'bg-green-600/20 border border-green-500/30' 
                        : 'bg-red-600/20 border border-red-500/30'
                }`}>
                    <span className={`w-3 h-3 rounded-full ${
                        automationConfig.masterEnabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    }`}></span>
                    <span className={`text-sm font-medium ${
                        automationConfig.masterEnabled ? 'text-green-300' : 'text-red-300'
                    }`}>
                        {automationConfig.masterEnabled 
                            ? 'Alle automatische taken zijn actief' 
                            : 'Alle automatische taken zijn uitgeschakeld'}
                    </span>
                </div>
            </div>

            {/* Automation Sub-Navigation */}
            <div className="flex flex-wrap gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                {[
                    { id: 'overview' as SubTab, icon: 'fa-th-large', label: 'Overzicht' },
                    { id: 'products' as SubTab, icon: 'fa-box-open', label: 'Product Generatie' },
                    { id: 'content' as SubTab, icon: 'fa-file-alt', label: 'Content Generatie' },
                    { id: 'monitoring' as SubTab, icon: 'fa-heartbeat', label: 'Monitoring' },
                    { id: 'notifications' as SubTab, icon: 'fa-bell', label: 'Notificaties' }
                ].map(sub => (
                    <button
                        key={sub.id}
                        onClick={() => setAutomationSubTab(sub.id)}
                        className={`
                            flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all
                            ${automationSubTab === sub.id 
                                ? 'bg-cyan-600 text-white shadow-lg' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }
                        `}
                    >
                        <i className={`fas ${sub.icon}`}></i>
                        <span className="hidden sm:inline">{sub.label}</span>
                    </button>
                ))}
            </div>

            {/* Validation Errors */}
            {automationConfigErrors.length > 0 && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-exclamation-triangle text-red-400 mt-0.5"></i>
                        <div>
                            <h4 className="font-medium text-red-300 mb-2">Validatie Fouten</h4>
                            <ul className="text-sm text-red-200/70 space-y-1">
                                {automationConfigErrors.map((error, idx) => (
                                    <li key={idx}>• {error.field}: {error.message}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Overview Tab */}
            {automationSubTab === 'overview' && (
                <OverviewSection 
                    automationConfig={automationConfig}
                    automationStatus={automationStatus}
                    automationLoading={automationLoading}
                    onTriggerJob={handleTriggerJob}
                />
            )}

            {/* Product Generation Tab */}
            {automationSubTab === 'products' && (
                <ProductGenerationSection
                    automationConfig={automationConfig}
                    setAutomationConfig={setAutomationConfig}
                />
            )}

            {/* Content Generation Tab */}
            {automationSubTab === 'content' && (
                <ContentGenerationSection
                    automationConfig={automationConfig}
                    setAutomationConfig={setAutomationConfig}
                />
            )}

            {/* Monitoring Tab */}
            {automationSubTab === 'monitoring' && (
                <MonitoringSection
                    automationConfig={automationConfig}
                    setAutomationConfig={setAutomationConfig}
                />
            )}

            {/* Notifications Tab */}
            {automationSubTab === 'notifications' && (
                <NotificationsSection
                    automationConfig={automationConfig}
                    setAutomationConfig={setAutomationConfig}
                />
            )}

            {/* Save/Reset Buttons */}
            <div className="flex flex-wrap gap-4 justify-end">
                <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                    <i className="fas fa-undo"></i> Reset naar Standaard
                </button>
                <button
                    onClick={handleSave}
                    disabled={automationLoading}
                    className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                    {automationLoading ? (
                        <><i className="fas fa-spinner fa-spin"></i> Opslaan...</>
                    ) : (
                        <><i className="fas fa-save"></i> Instellingen Opslaan</>
                    )}
                </button>
            </div>

            {/* Info Box */}
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <i className="fas fa-info-circle text-cyan-400 mt-0.5"></i>
                    <div>
                        <h4 className="font-medium text-cyan-300 mb-1">Automation Control Center</h4>
                        <p className="text-sm text-cyan-200/70">
                            Met het Automation Control Center beheer je alle autonome functies van je affiliate platform.
                            Stel in hoeveel producten en content er automatisch wordt gegenereerd, configureer link monitoring
                            en commissie tracking, en ontvang notificaties wanneer er iets belangrijks gebeurt.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SectionProps {
    automationConfig: AutomationConfig;
    setAutomationConfig?: React.Dispatch<React.SetStateAction<AutomationConfig>>;
}

interface OverviewSectionProps extends SectionProps {
    automationStatus: AutomationStatus;
    automationLoading: boolean;
    onTriggerJob: (jobId: string, jobName: string) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({
    automationConfig,
    automationStatus,
    automationLoading,
    onTriggerJob
}) => (
    <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-600/30 flex items-center justify-center">
                        <i className="fas fa-box-open text-purple-400"></i>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{automationConfig.productGeneration.productsPerDay}</div>
                        <div className="text-xs text-slate-400">Producten/dag</div>
                    </div>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-600/30 flex items-center justify-center">
                        <i className="fas fa-file-alt text-green-400"></i>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{automationConfig.contentGeneration.postsPerWeek}</div>
                        <div className="text-xs text-slate-400">Posts/week</div>
                    </div>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
                        <i className="fas fa-tags text-blue-400"></i>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{automationConfig.productGeneration.categories.length}</div>
                        <div className="text-xs text-slate-400">Categorieën</div>
                    </div>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-600/30 flex items-center justify-center">
                        <i className="fas fa-network-wired text-yellow-400"></i>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{automationConfig.commissionTracking.networks.length}</div>
                        <div className="text-xs text-slate-400">Netwerken</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Job Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
                { 
                    id: 'productGeneration', 
                    name: 'Product Generatie', 
                    icon: 'fa-box-open',
                    enabled: automationConfig.productGeneration.enabled,
                    schedule: automationConfig.productGeneration.preferredTime,
                    description: `${automationConfig.productGeneration.productsPerDay} producten per dag`,
                    colorClass: 'purple'
                },
                { 
                    id: 'contentGeneration', 
                    name: 'Content Generatie', 
                    icon: 'fa-file-alt',
                    enabled: automationConfig.contentGeneration.enabled,
                    schedule: automationConfig.contentGeneration.frequency,
                    description: `${automationConfig.contentGeneration.postsPerWeek} posts per week`,
                    colorClass: 'green'
                },
                { 
                    id: 'linkHealthCheck', 
                    name: 'Link Monitoring', 
                    icon: 'fa-heartbeat',
                    enabled: automationConfig.linkMonitoring.enabled,
                    schedule: automationConfig.linkMonitoring.checkFrequency,
                    description: automationConfig.linkMonitoring.autoFix ? 'Met auto-fix' : 'Alleen monitoring',
                    colorClass: 'blue'
                },
                { 
                    id: 'commissionSync', 
                    name: 'Commissie Tracking', 
                    icon: 'fa-chart-line',
                    enabled: automationConfig.commissionTracking.enabled,
                    schedule: automationConfig.commissionTracking.syncFrequency,
                    description: `${automationConfig.commissionTracking.networks.length} netwerken`,
                    colorClass: 'yellow'
                }
            ].map(job => {
                const jobStatus = automationStatus.jobs[job.id] || { status: 'idle', lastRun: null };
                const bgColor = job.enabled ? `bg-${job.colorClass}-900/20` : 'bg-slate-950';
                const iconBg = job.enabled ? `bg-${job.colorClass}-600/30` : 'bg-slate-800';
                const iconColor = job.enabled ? `text-${job.colorClass}-400` : 'text-slate-500';
                
                return (
                    <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <div className={`p-4 border-b border-slate-800 ${bgColor}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                                        <i className={`fas ${job.icon} ${iconColor}`}></i>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white">{job.name}</h3>
                                        <div className="text-xs text-slate-500">{job.schedule}</div>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    job.enabled ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-slate-400'
                                }`}>
                                    {job.enabled ? 'Actief' : 'Uit'}
                                </span>
                            </div>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-slate-400 mb-3">{job.description}</p>
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-500">
                                    {jobStatus.lastRun ? (
                                        <>Laatst: {new Date(jobStatus.lastRun).toLocaleString('nl-NL')}</>
                                    ) : (
                                        'Nog niet uitgevoerd'
                                    )}
                                </div>
                                <button
                                    onClick={() => onTriggerJob(job.id, job.name)}
                                    disabled={automationLoading || !job.enabled}
                                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1"
                                >
                                    <i className="fas fa-play"></i> Start
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const ProductGenerationSection: React.FC<SectionProps> = ({ automationConfig, setAutomationConfig }) => {
    if (!setAutomationConfig) return null;
    
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-900/30 to-slate-900 p-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-box-open text-purple-400"></i> Product Generatie Instellingen
                    </h2>
                    <button
                        onClick={() => setAutomationConfig({
                            ...automationConfig,
                            productGeneration: {
                                ...automationConfig.productGeneration,
                                enabled: !automationConfig.productGeneration.enabled
                            }
                        })}
                        className={`relative w-12 h-6 rounded-full transition-all ${
                            automationConfig.productGeneration.enabled ? 'bg-purple-500' : 'bg-slate-700'
                        }`}
                    >
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow ${
                            automationConfig.productGeneration.enabled ? 'left-7' : 'left-1'
                        }`}></div>
                    </button>
                </div>
            </div>
            <div className="p-6 space-y-6">
                {/* Products Per Day Slider */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Producten per dag: <span className="text-purple-400 font-bold">{automationConfig.productGeneration.productsPerDay}</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        value={automationConfig.productGeneration.productsPerDay}
                        onChange={(e) => setAutomationConfig({
                            ...automationConfig,
                            productGeneration: {
                                ...automationConfig.productGeneration,
                                productsPerDay: parseInt(e.target.value)
                            }
                        })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                    </div>
                </div>

                {/* Preferred Time */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Uitvoer tijd</label>
                    <input
                        type="time"
                        value={automationConfig.productGeneration.preferredTime}
                        onChange={(e) => setAutomationConfig({
                            ...automationConfig,
                            productGeneration: {
                                ...automationConfig.productGeneration,
                                preferredTime: e.target.value
                            }
                        })}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500"
                    />
                </div>

                {/* Category Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Categorieën</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(CATEGORIES).map(([key, cat]) => (
                            <label
                                key={key}
                                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                                    automationConfig.productGeneration.categories.includes(key)
                                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={automationConfig.productGeneration.categories.includes(key)}
                                    onChange={(e) => {
                                        const cats = e.target.checked
                                            ? [...automationConfig.productGeneration.categories, key]
                                            : automationConfig.productGeneration.categories.filter(c => c !== key);
                                        setAutomationConfig({
                                            ...automationConfig,
                                            productGeneration: {
                                                ...automationConfig.productGeneration,
                                                categories: cats
                                            }
                                        });
                                    }}
                                    className="rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm">{cat.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContentGenerationSection: React.FC<SectionProps> = ({ automationConfig, setAutomationConfig }) => {
    if (!setAutomationConfig) return null;
    
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-900/30 to-slate-900 p-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-file-alt text-green-400"></i> Content Generatie Instellingen
                    </h2>
                    <button
                        onClick={() => setAutomationConfig({
                            ...automationConfig,
                            contentGeneration: {
                                ...automationConfig.contentGeneration,
                                enabled: !automationConfig.contentGeneration.enabled
                            }
                        })}
                        className={`relative w-12 h-6 rounded-full transition-all ${
                            automationConfig.contentGeneration.enabled ? 'bg-green-500' : 'bg-slate-700'
                        }`}
                    >
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow ${
                            automationConfig.contentGeneration.enabled ? 'left-7' : 'left-1'
                        }`}></div>
                    </button>
                </div>
            </div>
            <div className="p-6 space-y-6">
                {/* Frequency Dropdown */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Frequentie</label>
                    <select
                        value={automationConfig.contentGeneration.frequency}
                        onChange={(e) => setAutomationConfig({
                            ...automationConfig,
                            contentGeneration: {
                                ...automationConfig.contentGeneration,
                                frequency: e.target.value as any
                            }
                        })}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-green-500 cursor-pointer"
                    >
                        <option value="daily">Dagelijks</option>
                        <option value="weekly">Wekelijks</option>
                        <option value="biweekly">Tweewekelijks</option>
                        <option value="monthly">Maandelijks</option>
                    </select>
                </div>

                {/* Posts Per Week Slider */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Posts per week: <span className="text-green-400 font-bold">{automationConfig.contentGeneration.postsPerWeek}</span>
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="7"
                        value={automationConfig.contentGeneration.postsPerWeek}
                        onChange={(e) => setAutomationConfig({
                            ...automationConfig,
                            contentGeneration: {
                                ...automationConfig.contentGeneration,
                                postsPerWeek: parseInt(e.target.value)
                            }
                        })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>1</span>
                        <span>4</span>
                        <span>7</span>
                    </div>
                </div>

                {/* Content Types */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Content Types</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { id: 'guides' as ContentType, label: 'Koopgidsen', icon: 'fa-book' },
                            { id: 'comparisons' as ContentType, label: 'Vergelijkingen', icon: 'fa-balance-scale' },
                            { id: 'toplists' as ContentType, label: 'Toplijsten', icon: 'fa-list-ol' },
                            { id: 'blogs' as ContentType, label: 'Blogs', icon: 'fa-pen' }
                        ].map(type => (
                            <label
                                key={type.id}
                                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                                    automationConfig.contentGeneration.contentTypes.includes(type.id)
                                        ? 'bg-green-600/20 border-green-500/50 text-green-300'
                                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={automationConfig.contentGeneration.contentTypes.includes(type.id)}
                                    onChange={(e) => {
                                        const types = e.target.checked
                                            ? [...automationConfig.contentGeneration.contentTypes, type.id]
                                            : automationConfig.contentGeneration.contentTypes.filter(t => t !== type.id);
                                        setAutomationConfig({
                                            ...automationConfig,
                                            contentGeneration: {
                                                ...automationConfig.contentGeneration,
                                                contentTypes: types
                                            }
                                        });
                                    }}
                                    className="rounded border-slate-600 bg-slate-800 text-green-600 focus:ring-green-500"
                                />
                                <i className={`fas ${type.icon} text-sm`}></i>
                                <span className="text-sm">{type.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Preferred Days */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Voorkeur dagen</label>
                    <div className="flex flex-wrap gap-2">
                        {['Zon', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'].map((day, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    const days = automationConfig.contentGeneration.preferredDays.includes(idx)
                                        ? automationConfig.contentGeneration.preferredDays.filter(d => d !== idx)
                                        : [...automationConfig.contentGeneration.preferredDays, idx];
                                    setAutomationConfig({
                                        ...automationConfig,
                                        contentGeneration: {
                                            ...automationConfig.contentGeneration,
                                            preferredDays: days.sort()
                                        }
                                    });
                                }}
                                className={`w-12 h-12 rounded-lg font-medium transition ${
                                    automationConfig.contentGeneration.preferredDays.includes(idx)
                                        ? 'bg-green-600 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MonitoringSection: React.FC<SectionProps> = ({ automationConfig, setAutomationConfig }) => {
    if (!setAutomationConfig) return null;
    
    return (
        <div className="space-y-6">
            {/* Link Monitoring */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-900/30 to-slate-900 p-4 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-heartbeat text-blue-400"></i> Link Monitoring
                        </h2>
                        <button
                            onClick={() => setAutomationConfig({
                                ...automationConfig,
                                linkMonitoring: {
                                    ...automationConfig.linkMonitoring,
                                    enabled: !automationConfig.linkMonitoring.enabled
                                }
                            })}
                            className={`relative w-12 h-6 rounded-full transition-all ${
                                automationConfig.linkMonitoring.enabled ? 'bg-blue-500' : 'bg-slate-700'
                            }`}
                        >
                            <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow ${
                                automationConfig.linkMonitoring.enabled ? 'left-7' : 'left-1'
                            }`}></div>
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Check Frequentie</label>
                            <select
                                value={automationConfig.linkMonitoring.checkFrequency}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    linkMonitoring: {
                                        ...automationConfig.linkMonitoring,
                                        checkFrequency: e.target.value as CheckFrequency
                                    }
                                })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="hourly">Elk uur</option>
                                <option value="daily">Dagelijks</option>
                                <option value="weekly">Wekelijks</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={automationConfig.linkMonitoring.autoFix}
                                    onChange={(e) => setAutomationConfig({
                                        ...automationConfig,
                                        linkMonitoring: {
                                            ...automationConfig.linkMonitoring,
                                            autoFix: e.target.checked
                                        }
                                    })}
                                    className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-slate-300">Auto-fix broken links</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={automationConfig.linkMonitoring.notifications}
                                    onChange={(e) => setAutomationConfig({
                                        ...automationConfig,
                                        linkMonitoring: {
                                            ...automationConfig.linkMonitoring,
                                            notifications: e.target.checked
                                        }
                                    })}
                                    className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-slate-300">Notificaties bij problemen</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Commission Tracking */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-900/30 to-slate-900 p-4 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-chart-line text-yellow-400"></i> Commissie Tracking
                        </h2>
                        <button
                            onClick={() => setAutomationConfig({
                                ...automationConfig,
                                commissionTracking: {
                                    ...automationConfig.commissionTracking,
                                    enabled: !automationConfig.commissionTracking.enabled
                                }
                            })}
                            className={`relative w-12 h-6 rounded-full transition-all ${
                                automationConfig.commissionTracking.enabled ? 'bg-yellow-500' : 'bg-slate-700'
                            }`}
                        >
                            <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow ${
                                automationConfig.commissionTracking.enabled ? 'left-7' : 'left-1'
                            }`}></div>
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Sync Frequentie</label>
                        <select
                            value={automationConfig.commissionTracking.syncFrequency}
                            onChange={(e) => setAutomationConfig({
                                ...automationConfig,
                                commissionTracking: {
                                    ...automationConfig.commissionTracking,
                                    syncFrequency: e.target.value as SyncFrequency
                                }
                            })}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-yellow-500 cursor-pointer"
                        >
                            <option value="hourly">Elk uur</option>
                            <option value="daily">Dagelijks</option>
                            <option value="weekly">Wekelijks</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">Netwerken</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {[
                                { id: 'bol' as AffiliateNetworkId, label: 'Bol.com' },
                                { id: 'tradetracker' as AffiliateNetworkId, label: 'TradeTracker' },
                                { id: 'daisycon' as AffiliateNetworkId, label: 'Daisycon' },
                                { id: 'awin' as AffiliateNetworkId, label: 'Awin' },
                                { id: 'paypro' as AffiliateNetworkId, label: 'PayPro' },
                                { id: 'plugpay' as AffiliateNetworkId, label: 'Plug&Pay' }
                            ].map(network => (
                                <label
                                    key={network.id}
                                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                                        automationConfig.commissionTracking.networks.includes(network.id)
                                            ? 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'
                                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={automationConfig.commissionTracking.networks.includes(network.id)}
                                        onChange={(e) => {
                                            const nets = e.target.checked
                                                ? [...automationConfig.commissionTracking.networks, network.id]
                                                : automationConfig.commissionTracking.networks.filter(n => n !== network.id);
                                            setAutomationConfig({
                                                ...automationConfig,
                                                commissionTracking: {
                                                    ...automationConfig.commissionTracking,
                                                    networks: nets
                                                }
                                            });
                                        }}
                                        className="rounded border-slate-600 bg-slate-800 text-yellow-600 focus:ring-yellow-500"
                                    />
                                    <span className="text-sm">{network.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-slate-950 p-4 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-tachometer-alt text-cyan-400"></i> Performance Instellingen
                    </h2>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={automationConfig.performance.enableCaching}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    performance: { ...automationConfig.performance, enableCaching: e.target.checked }
                                })}
                                className="rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">Caching inschakelen</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={automationConfig.performance.enableLazyLoading}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    performance: { ...automationConfig.performance, enableLazyLoading: e.target.checked }
                                })}
                                className="rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">Lazy loading voor afbeeldingen</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={automationConfig.performance.enableImageOptimization}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    performance: { ...automationConfig.performance, enableImageOptimization: e.target.checked }
                                })}
                                className="rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">Afbeelding optimalisatie</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg cursor-pointer">
                            <input
                                type="checkbox"
                                checked={automationConfig.performance.autoRemoveLowPerformers}
                                onChange={(e) => setAutomationConfig({
                                    ...automationConfig,
                                    performance: { ...automationConfig.performance, autoRemoveLowPerformers: e.target.checked }
                                })}
                                className="rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-slate-300">Auto-verwijder slecht presterende producten</span>
                        </label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">
                            Minimum conversie rate: <span className="text-cyan-400 font-bold">{automationConfig.performance.minConversionRate}%</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={automationConfig.performance.minConversionRate}
                            onChange={(e) => setAutomationConfig({
                                ...automationConfig,
                                performance: {
                                    ...automationConfig.performance,
                                    minConversionRate: parseFloat(e.target.value)
                                }
                            })}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const NotificationsSection: React.FC<SectionProps> = ({ automationConfig, setAutomationConfig }) => {
    if (!setAutomationConfig) return null;
    
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-900/30 to-slate-900 p-4 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-bell text-yellow-400"></i> Notificatie Instellingen
                </h2>
            </div>
            <div className="p-6 space-y-6">
                {/* Email Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg">
                    <div>
                        <h3 className="font-medium text-white">E-mail notificaties</h3>
                        <p className="text-sm text-slate-400">Ontvang meldingen via e-mail</p>
                    </div>
                    <button
                        onClick={() => setAutomationConfig({
                            ...automationConfig,
                            notifications: {
                                ...automationConfig.notifications,
                                emailEnabled: !automationConfig.notifications.emailEnabled
                            }
                        })}
                        className={`relative w-12 h-6 rounded-full transition-all ${
                            automationConfig.notifications.emailEnabled ? 'bg-yellow-500' : 'bg-slate-700'
                        }`}
                    >
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-all shadow ${
                            automationConfig.notifications.emailEnabled ? 'left-7' : 'left-1'
                        }`}></div>
                    </button>
                </div>

                {/* Email Input */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">E-mailadres</label>
                    <input
                        type="email"
                        value={automationConfig.notifications.email}
                        onChange={(e) => setAutomationConfig({
                            ...automationConfig,
                            notifications: {
                                ...automationConfig.notifications,
                                email: e.target.value
                            }
                        })}
                        placeholder="jouw@email.nl"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-yellow-500"
                    />
                </div>

                {/* Alert Types */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">Alert Types</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {[
                            { id: 'broken_links' as AlertType, label: 'Broken links gedetecteerd', icon: 'fa-chain-broken' },
                            { id: 'low_conversion' as AlertType, label: 'Lage conversie rate', icon: 'fa-chart-line' },
                            { id: 'high_earnings' as AlertType, label: 'Hoge verdiensten', icon: 'fa-euro-sign' },
                            { id: 'content_published' as AlertType, label: 'Content gepubliceerd', icon: 'fa-newspaper' },
                            { id: 'product_generated' as AlertType, label: 'Product gegenereerd', icon: 'fa-box-open' },
                            { id: 'error_occurred' as AlertType, label: 'Fout opgetreden', icon: 'fa-exclamation-triangle' }
                        ].map(alert => (
                            <label
                                key={alert.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                    automationConfig.notifications.alertTypes.includes(alert.id)
                                        ? 'bg-yellow-600/20 border-yellow-500/50 text-yellow-300'
                                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={automationConfig.notifications.alertTypes.includes(alert.id)}
                                    onChange={(e) => {
                                        const types = e.target.checked
                                            ? [...automationConfig.notifications.alertTypes, alert.id]
                                            : automationConfig.notifications.alertTypes.filter(t => t !== alert.id);
                                        setAutomationConfig({
                                            ...automationConfig,
                                            notifications: {
                                                ...automationConfig.notifications,
                                                alertTypes: types
                                            }
                                        });
                                    }}
                                    className="rounded border-slate-600 bg-slate-800 text-yellow-600 focus:ring-yellow-500"
                                />
                                <i className={`fas ${alert.icon} text-sm`}></i>
                                <span className="text-sm">{alert.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutomationTab;

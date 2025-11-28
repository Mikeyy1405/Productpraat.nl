/**
 * Automation Panel Component
 * 
 * Admin panel for managing automated product discovery from Bol.com.
 * Features:
 * - Toggle for enable/disable automation
 * - Category selection for Bol.com monitoring
 * - Filter configuration (min rating, reviews, stock)
 * - Schedule interval selection
 * - Real-time status dashboard
 * - Activity log/timeline
 * - Manual trigger button
 * 
 * @module components/AutomationPanel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BOL_CATEGORIES } from '../services/productDiscoveryService';

// ============================================================================
// TYPES
// ============================================================================

interface DiscoveryFilters {
    minRating: number;
    minReviews: number;
    inStockOnly: boolean;
}

interface DiscoveryConfig {
    enabled: boolean;
    scheduleInterval: 'hourly' | 'daily' | 'weekly' | null;
    categories: string[];
    filters: DiscoveryFilters;
    maxProductsPerRun: number;
    lastRunAt?: string;
    nextScheduledRun?: string;
}

interface AutomationRun {
    id: string;
    startedAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    runType: 'manual' | 'scheduled';
    categories: string[];
    productsProcessed: number;
    productsImported: number;
    productsSkipped: number;
    productsFailed: number;
    errorMessage?: string;
}

interface AutomationStatus {
    isRunning: boolean;
    currentRunId?: string;
    schedulerEnabled: boolean;
    lastRun?: AutomationRun;
    config?: DiscoveryConfig;
    stats: {
        totalProcessed: number;
        successfulImports: number;
        failedImports: number;
        skippedProducts: number;
    };
    bolSyncConfigured: boolean;
}

interface AutomationPanelProps {
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DiscoveryConfig = {
    enabled: false,
    scheduleInterval: 'daily',
    categories: ['11652', '13512', '21328'],
    filters: {
        minRating: 4.0,
        minReviews: 10,
        inStockOnly: true,
    },
    maxProductsPerRun: 10,
};

// ============================================================================
// COMPONENT
// ============================================================================

export const AutomationPanel: React.FC<AutomationPanelProps> = ({ showToast }) => {
    // State
    const [status, setStatus] = useState<AutomationStatus | null>(null);
    const [config, setConfig] = useState<DiscoveryConfig>(DEFAULT_CONFIG);
    const [history, setHistory] = useState<AutomationRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    // Fetch status and history
    const fetchData = useCallback(async () => {
        try {
            const [statusRes, historyRes] = await Promise.all([
                fetch('/api/automation/status'),
                fetch('/api/automation/history?limit=10'),
            ]);

            if (statusRes.ok) {
                const statusData = await statusRes.json();
                setStatus(statusData);
                if (statusData.config) {
                    setConfig({
                        enabled: statusData.config.enabled ?? false,
                        scheduleInterval: statusData.config.scheduleInterval ?? 'daily',
                        categories: statusData.config.categories ?? [],
                        filters: statusData.config.filters ?? DEFAULT_CONFIG.filters,
                        maxProductsPerRun: statusData.config.maxProductsPerRun ?? 10,
                        lastRunAt: statusData.config.lastRunAt,
                        nextScheduledRun: statusData.config.nextScheduledRun,
                    });
                }
                setIsRunning(statusData.isRunning);
            }

            if (historyRes.ok) {
                const historyData = await historyRes.json();
                setHistory(historyData.runs || []);
            }
        } catch (error) {
            console.error('Failed to fetch automation data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load data on mount and set up polling
    useEffect(() => {
        fetchData();

        // Poll for updates every 10 seconds when running
        const interval = setInterval(() => {
            if (isRunning) {
                fetchData();
            }
        }, 10000);

        return () => clearInterval(interval);
    }, [fetchData, isRunning]);

    // Save configuration
    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/automation/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (response.ok) {
                showToast('Configuratie opgeslagen!', 'success');
            } else {
                const data = await response.json();
                showToast(data.error || 'Opslaan mislukt', 'error');
            }
        } catch (error) {
            showToast('Fout bij opslaan', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Start manual discovery
    const handleStartDiscovery = async () => {
        if (config.categories.length === 0) {
            showToast('Selecteer minimaal één categorie', 'warning');
            return;
        }

        setIsRunning(true);
        try {
            const response = await fetch('/api/automation/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categories: config.categories,
                    limit: config.maxProductsPerRun,
                    filters: config.filters,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                showToast(`Product discovery gestart (${data.runId})`, 'success');
                // Start polling
                setTimeout(fetchData, 2000);
            } else {
                showToast(data.error || 'Start mislukt', 'error');
                setIsRunning(false);
            }
        } catch (error) {
            showToast('Fout bij starten', 'error');
            setIsRunning(false);
        }
    };

    // Stop running automation
    const handleStopAutomation = async () => {
        try {
            const response = await fetch('/api/automation/stop', {
                method: 'POST',
            });

            if (response.ok) {
                showToast('Stop aangevraagd, even geduld...', 'info');
            }
        } catch (error) {
            showToast('Fout bij stoppen', 'error');
        }
    };

    // Toggle scheduler
    const handleToggleScheduler = async () => {
        if (status?.schedulerEnabled) {
            // Stop scheduler
            try {
                const response = await fetch('/api/automation/stop-schedule', {
                    method: 'POST',
                });

                if (response.ok) {
                    showToast('Scheduler gestopt', 'success');
                    fetchData();
                }
            } catch (error) {
                showToast('Fout bij stoppen scheduler', 'error');
            }
        } else {
            // Start scheduler
            if (config.categories.length === 0) {
                showToast('Selecteer minimaal één categorie', 'warning');
                return;
            }

            try {
                const response = await fetch('/api/automation/start-schedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        interval: config.scheduleInterval,
                        categories: config.categories,
                        maxProductsPerRun: config.maxProductsPerRun,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    showToast(`Scheduler gestart (${config.scheduleInterval})`, 'success');
                    fetchData();
                } else {
                    const data = await response.json();
                    showToast(data.error || 'Start scheduler mislukt', 'error');
                }
            } catch (error) {
                showToast('Fout bij starten scheduler', 'error');
            }
        }
    };

    // Toggle category selection
    const toggleCategory = (categoryId: string) => {
        setConfig(prev => ({
            ...prev,
            categories: prev.categories.includes(categoryId)
                ? prev.categories.filter(c => c !== categoryId)
                : [...prev.categories, categoryId],
        }));
    };

    // Format date
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('nl-NL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Format duration
    const formatDuration = (start: string, end?: string) => {
        if (!end) return 'Bezig...';
        const ms = new Date(end).getTime() - new Date(start).getTime();
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <i className="fas fa-spinner fa-spin text-3xl text-cyan-400"></i>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-cyan-900/30 to-slate-900 p-6 rounded-2xl border border-cyan-500/30">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <i className="fas fa-robot text-cyan-400"></i>
                            Automatische Product Discovery
                        </h2>
                        <p className="text-slate-400 mt-1">
                            Ontdek automatisch nieuwe producten van Bol.com en importeer ze naar je database
                        </p>
                    </div>
                    
                    {/* API Status */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                        status?.bolSyncConfigured 
                            ? 'bg-green-600/20 border border-green-500/30' 
                            : 'bg-red-600/20 border border-red-500/30'
                    }`}>
                        <span className={`w-3 h-3 rounded-full ${
                            status?.bolSyncConfigured ? 'bg-green-400' : 'bg-red-400'
                        }`}></span>
                        <span className={`text-sm font-medium ${
                            status?.bolSyncConfigured ? 'text-green-300' : 'text-red-300'
                        }`}>
                            Bol.com API: {status?.bolSyncConfigured ? 'Geconfigureerd' : 'Niet geconfigureerd'}
                        </span>
                    </div>
                </div>
            </div>

            {/* API Warning */}
            {!status?.bolSyncConfigured && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <i className="fas fa-exclamation-triangle text-yellow-400 mt-0.5"></i>
                        <div>
                            <h4 className="font-medium text-yellow-300 mb-1">Bol.com API niet geconfigureerd</h4>
                            <p className="text-sm text-yellow-200/70">
                                Om automatische product discovery te gebruiken, configureer de volgende environment variabelen:
                                <code className="bg-yellow-900/50 px-2 py-0.5 rounded mx-1">BOL_CLIENT_ID</code> en
                                <code className="bg-yellow-900/50 px-2 py-0.5 rounded mx-1">BOL_CLIENT_SECRET</code>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center">
                            <i className="fas fa-search text-blue-400"></i>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{status?.stats.totalProcessed || 0}</div>
                            <div className="text-xs text-slate-400">Verwerkt (30d)</div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-600/30 flex items-center justify-center">
                            <i className="fas fa-check text-green-400"></i>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{status?.stats.successfulImports || 0}</div>
                            <div className="text-xs text-slate-400">Geïmporteerd</div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-600/30 flex items-center justify-center">
                            <i className="fas fa-forward text-yellow-400"></i>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{status?.stats.skippedProducts || 0}</div>
                            <div className="text-xs text-slate-400">Overgeslagen</div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-600/30 flex items-center justify-center">
                            <i className="fas fa-times text-red-400"></i>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-white">{status?.stats.failedImports || 0}</div>
                            <div className="text-xs text-slate-400">Mislukt</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-900/30 to-slate-900 p-4 border-b border-slate-800">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fas fa-cog text-purple-400"></i>
                            Configuratie
                        </h3>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Categories */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-3">
                                Bol.com Categorieën
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(BOL_CATEGORIES).map(([id, name]) => (
                                    <label
                                        key={id}
                                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                                            config.categories.includes(id)
                                                ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                                                : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={config.categories.includes(id)}
                                            onChange={() => toggleCategory(id)}
                                            className="rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="text-sm truncate">{name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-300">
                                Filters
                            </label>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        Min. Rating: {config.filters.minRating}
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="5"
                                        step="0.5"
                                        value={config.filters.minRating}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            filters: { ...prev.filters, minRating: parseFloat(e.target.value) }
                                        }))}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        Min. Reviews: {config.filters.minReviews}
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={config.filters.minReviews}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            filters: { ...prev.filters, minReviews: parseInt(e.target.value) }
                                        }))}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                    />
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.filters.inStockOnly}
                                    onChange={(e) => setConfig(prev => ({
                                        ...prev,
                                        filters: { ...prev.filters, inStockOnly: e.target.checked }
                                    }))}
                                    className="rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-slate-300 text-sm">Alleen op voorraad</span>
                            </label>
                        </div>

                        {/* Max Products */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Max producten per run: {config.maxProductsPerRun}
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="5"
                                value={config.maxProductsPerRun}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    maxProductsPerRun: parseInt(e.target.value)
                                }))}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>5</span>
                                <span>25</span>
                                <span>50</span>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Schedule Interval
                            </label>
                            <select
                                value={config.scheduleInterval || 'daily'}
                                onChange={(e) => setConfig(prev => ({
                                    ...prev,
                                    scheduleInterval: e.target.value as any
                                }))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500 cursor-pointer"
                            >
                                <option value="hourly">Elk uur</option>
                                <option value="daily">Dagelijks</option>
                                <option value="weekly">Wekelijks</option>
                            </select>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSaveConfig}
                            disabled={isSaving}
                            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                        >
                            {isSaving ? (
                                <><i className="fas fa-spinner fa-spin"></i> Opslaan...</>
                            ) : (
                                <><i className="fas fa-save"></i> Configuratie Opslaan</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Actions & Status Panel */}
                <div className="space-y-6">
                    {/* Manual Run */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-green-900/30 to-slate-900 p-4 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-play text-green-400"></i>
                                Manual Discovery
                            </h3>
                        </div>
                        <div className="p-6">
                            {isRunning ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 bg-cyan-900/20 border border-cyan-500/30 p-4 rounded-xl">
                                        <i className="fas fa-spinner fa-spin text-cyan-400"></i>
                                        <div>
                                            <div className="text-cyan-300 font-medium">Discovery actief...</div>
                                            <div className="text-xs text-slate-400">
                                                Run ID: {status?.currentRunId}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleStopAutomation}
                                        className="w-full bg-red-600/20 border border-red-500/50 text-red-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600/30 transition"
                                    >
                                        <i className="fas fa-stop"></i> Stop Discovery
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleStartDiscovery}
                                    disabled={!status?.bolSyncConfigured || config.categories.length === 0}
                                    className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                                >
                                    <i className="fas fa-play"></i> Nu Uitvoeren
                                </button>
                            )}
                            
                            <p className="text-xs text-slate-500 mt-3 text-center">
                                {config.categories.length} categorieën geselecteerd • Max {config.maxProductsPerRun} producten
                            </p>
                        </div>
                    </div>

                    {/* Scheduler Toggle */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-yellow-900/30 to-slate-900 p-4 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fas fa-clock text-yellow-400"></i>
                                Scheduler
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-white font-medium">Automatisch uitvoeren</div>
                                    <div className="text-xs text-slate-400">
                                        {config.scheduleInterval === 'hourly' && 'Elk uur'}
                                        {config.scheduleInterval === 'daily' && 'Dagelijks om 3:00'}
                                        {config.scheduleInterval === 'weekly' && 'Wekelijks om 3:00'}
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggleScheduler}
                                    disabled={!status?.bolSyncConfigured}
                                    className={`relative w-14 h-7 rounded-full transition-all ${
                                        status?.schedulerEnabled ? 'bg-green-500' : 'bg-slate-700'
                                    } ${!status?.bolSyncConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-all shadow-lg ${
                                        status?.schedulerEnabled ? 'left-8' : 'left-1'
                                    }`}></div>
                                </button>
                            </div>
                            
                            {status?.schedulerEnabled && config.nextScheduledRun && (
                                <div className="text-sm text-slate-400 bg-slate-950 p-3 rounded-lg">
                                    <i className="fas fa-calendar-alt text-yellow-400 mr-2"></i>
                                    Volgende run: {formatDate(config.nextScheduledRun)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Last Run */}
                    {status?.lastRun && (
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="bg-slate-950 p-4 border-b border-slate-800">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <i className="fas fa-history text-slate-400"></i>
                                    Laatste Run
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className={`flex items-center gap-2 mb-3 ${
                                    status.lastRun.status === 'completed' ? 'text-green-400' :
                                    status.lastRun.status === 'failed' ? 'text-red-400' :
                                    status.lastRun.status === 'cancelled' ? 'text-yellow-400' :
                                    'text-cyan-400'
                                }`}>
                                    <i className={`fas ${
                                        status.lastRun.status === 'completed' ? 'fa-check-circle' :
                                        status.lastRun.status === 'failed' ? 'fa-times-circle' :
                                        status.lastRun.status === 'cancelled' ? 'fa-ban' :
                                        'fa-spinner fa-spin'
                                    }`}></i>
                                    <span className="font-medium capitalize">{status.lastRun.status}</span>
                                    <span className="text-slate-500 text-xs">
                                        ({status.lastRun.runType})
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="text-slate-400">
                                        <i className="fas fa-clock text-slate-500 mr-1"></i>
                                        {formatDate(status.lastRun.startedAt)}
                                    </div>
                                    <div className="text-slate-400">
                                        <i className="fas fa-hourglass-half text-slate-500 mr-1"></i>
                                        {formatDuration(status.lastRun.startedAt, status.lastRun.completedAt)}
                                    </div>
                                    <div className="text-green-400">
                                        <i className="fas fa-check mr-1"></i>
                                        {status.lastRun.productsImported} geïmporteerd
                                    </div>
                                    <div className="text-yellow-400">
                                        <i className="fas fa-forward mr-1"></i>
                                        {status.lastRun.productsSkipped} overgeslagen
                                    </div>
                                </div>
                                
                                {status.lastRun.errorMessage && (
                                    <div className="mt-3 text-xs text-red-400 bg-red-900/20 p-2 rounded">
                                        {status.lastRun.errorMessage}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* History Timeline */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <i className="fas fa-list text-slate-400"></i>
                        Recente Runs
                    </h3>
                    <button
                        onClick={fetchData}
                        className="text-slate-400 hover:text-white transition p-2"
                        title="Vernieuwen"
                    >
                        <i className="fas fa-sync-alt"></i>
                    </button>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto custom-scroll">
                    {history.length === 0 ? (
                        <div className="text-center text-slate-500 py-8">
                            <i className="fas fa-inbox text-3xl mb-2"></i>
                            <div>Nog geen runs uitgevoerd</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((run) => (
                                <div
                                    key={run.id}
                                    className={`flex items-start gap-4 p-4 rounded-xl border ${
                                        run.status === 'running' 
                                            ? 'bg-cyan-900/10 border-cyan-500/30' 
                                            : 'bg-slate-950 border-slate-800'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        run.status === 'completed' ? 'bg-green-600/30' :
                                        run.status === 'failed' ? 'bg-red-600/30' :
                                        run.status === 'cancelled' ? 'bg-yellow-600/30' :
                                        'bg-cyan-600/30'
                                    }`}>
                                        <i className={`fas ${
                                            run.status === 'completed' ? 'fa-check text-green-400' :
                                            run.status === 'failed' ? 'fa-times text-red-400' :
                                            run.status === 'cancelled' ? 'fa-ban text-yellow-400' :
                                            'fa-spinner fa-spin text-cyan-400'
                                        }`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-medium capitalize">
                                                {run.status}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                run.runType === 'scheduled' 
                                                    ? 'bg-yellow-600/20 text-yellow-400' 
                                                    : 'bg-blue-600/20 text-blue-400'
                                            }`}>
                                                {run.runType === 'scheduled' ? 'Gepland' : 'Handmatig'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">
                                            {formatDate(run.startedAt)}
                                            {run.completedAt && ` • ${formatDuration(run.startedAt, run.completedAt)}`}
                                        </div>
                                        <div className="flex flex-wrap gap-3 mt-2 text-xs">
                                            <span className="text-slate-400">
                                                <i className="fas fa-search text-slate-500 mr-1"></i>
                                                {run.productsProcessed} verwerkt
                                            </span>
                                            <span className="text-green-400">
                                                <i className="fas fa-check mr-1"></i>
                                                {run.productsImported} nieuw
                                            </span>
                                            {run.productsSkipped > 0 && (
                                                <span className="text-yellow-400">
                                                    <i className="fas fa-forward mr-1"></i>
                                                    {run.productsSkipped} skip
                                                </span>
                                            )}
                                            {run.productsFailed > 0 && (
                                                <span className="text-red-400">
                                                    <i className="fas fa-times mr-1"></i>
                                                    {run.productsFailed} fout
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <i className="fas fa-info-circle text-cyan-400 mt-0.5"></i>
                    <div>
                        <h4 className="font-medium text-cyan-300 mb-1">Hoe werkt Product Discovery?</h4>
                        <ul className="text-sm text-cyan-200/70 space-y-1">
                            <li>• Selecteer Bol.com categorieën en stel filters in (rating, reviews, voorraad)</li>
                            <li>• Klik op "Nu Uitvoeren" voor een handmatige run, of activeer de scheduler</li>
                            <li>• Het systeem haalt populaire producten op, past filters toe, en importeert nieuwe producten</li>
                            <li>• Duplicaten worden automatisch overgeslagen (op basis van EAN)</li>
                            <li>• Rate limiting wordt gerespecteerd (2 seconden tussen API calls)</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Custom scrollbar styles */}
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
            `}</style>
        </div>
    );
};

export default AutomationPanel;

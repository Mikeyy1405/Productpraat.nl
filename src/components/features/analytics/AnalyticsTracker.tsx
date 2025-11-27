/**
 * Analytics Components
 * 
 * Analytics tracking and dashboard components.
 * Only renders when the 'analytics' feature is enabled.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

interface PageView {
    id: string;
    path: string;
    title: string;
    referrer?: string;
    timestamp: string;
    sessionId: string;
}

interface AnalyticsEvent {
    id: string;
    name: string;
    category: string;
    label?: string;
    value?: number;
    timestamp: string;
    sessionId: string;
}

interface AnalyticsData {
    pageViews: PageView[];
    events: AnalyticsEvent[];
}

const STORAGE_KEY = 'writgo_analytics_data';
const SESSION_KEY = 'writgo_analytics_session';

// Get or create session ID
const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
};

// Load analytics data from localStorage
export const loadAnalyticsData = (): AnalyticsData => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { pageViews: [], events: [] };
    } catch {
        return { pageViews: [], events: [] };
    }
};

// Save analytics data
const saveAnalyticsData = (data: AnalyticsData): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Track page view
export const trackPageView = (path: string, title: string): void => {
    const data = loadAnalyticsData();
    const pageView: PageView = {
        id: `pv-${Date.now()}`,
        path,
        title,
        referrer: document.referrer || undefined,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId()
    };
    data.pageViews.push(pageView);
    
    // Keep only last 1000 page views
    if (data.pageViews.length > 1000) {
        data.pageViews = data.pageViews.slice(-1000);
    }
    
    saveAnalyticsData(data);
};

// Track event
export const trackEvent = (name: string, category: string, label?: string, value?: number): void => {
    const data = loadAnalyticsData();
    const event: AnalyticsEvent = {
        id: `ev-${Date.now()}`,
        name,
        category,
        label,
        value,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId()
    };
    data.events.push(event);
    
    // Keep only last 1000 events
    if (data.events.length > 1000) {
        data.events = data.events.slice(-1000);
    }
    
    saveAnalyticsData(data);
};

interface AnalyticsTrackerProps {
    children?: React.ReactNode;
}

export const AnalyticsTracker: React.FC<AnalyticsTrackerProps> = ({ children }) => {
    const enabled = useFeature('analytics');

    useEffect(() => {
        if (!enabled) return;

        // Track initial page view
        trackPageView(window.location.pathname, document.title);

        // Track page views on navigation
        const handlePopState = () => {
            trackPageView(window.location.pathname, document.title);
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [enabled]);

    return <>{children}</>;
};

interface AnalyticsDashboardProps {
    className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
    className = ''
}) => {
    const enabled = useFeature('analytics');
    const [data, setData] = useState<AnalyticsData>(() => loadAnalyticsData());
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
    const [activeTab, setActiveTab] = useState<'overview' | 'pages' | 'events'>('overview');

    useEffect(() => {
        // Refresh data periodically
        const interval = setInterval(() => {
            setData(loadAnalyticsData());
        }, 5000);
        
        return () => clearInterval(interval);
    }, []);

    const filteredData = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        
        switch (dateRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(0);
        }
        
        return {
            pageViews: data.pageViews.filter(pv => new Date(pv.timestamp) >= startDate),
            events: data.events.filter(ev => new Date(ev.timestamp) >= startDate)
        };
    }, [data, dateRange]);

    const stats = useMemo(() => {
        const uniqueSessions = new Set(filteredData.pageViews.map(pv => pv.sessionId)).size;
        const uniquePages = new Set(filteredData.pageViews.map(pv => pv.path)).size;
        
        // Page view counts by path
        const pageViewCounts: Record<string, number> = {};
        filteredData.pageViews.forEach(pv => {
            pageViewCounts[pv.path] = (pageViewCounts[pv.path] || 0) + 1;
        });
        
        // Event counts by name
        const eventCounts: Record<string, number> = {};
        filteredData.events.forEach(ev => {
            eventCounts[ev.name] = (eventCounts[ev.name] || 0) + 1;
        });
        
        // Top pages
        const topPages = Object.entries(pageViewCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        // Top events
        const topEvents = Object.entries(eventCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        return {
            totalPageViews: filteredData.pageViews.length,
            uniqueSessions,
            uniquePages,
            totalEvents: filteredData.events.length,
            topPages,
            topEvents,
            avgPagesPerSession: uniqueSessions > 0 ? (filteredData.pageViews.length / uniqueSessions).toFixed(1) : '0'
        };
    }, [filteredData]);

    if (!enabled) return null;

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fas fa-chart-line text-yellow-400"></i>
                    Analytics Dashboard
                </h2>
                
                <div className="flex gap-2">
                    {(['today', 'week', 'month', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                dateRange === range
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {range === 'today' ? 'Vandaag' : 
                             range === 'week' ? '7 dagen' : 
                             range === 'month' ? '30 dagen' : 'Alles'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{stats.totalPageViews}</div>
                    <div className="text-sm text-slate-400">Paginaweergaven</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{stats.uniqueSessions}</div>
                    <div className="text-sm text-slate-400">Unieke sessies</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{stats.avgPagesPerSession}</div>
                    <div className="text-sm text-slate-400">Pagina's / sessie</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{stats.totalEvents}</div>
                    <div className="text-sm text-slate-400">Events</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {(['overview', 'pages', 'events'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                            activeTab === tab
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {tab === 'overview' ? 'Overzicht' : 
                         tab === 'pages' ? 'Pagina\'s' : 'Events'}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Top pages */}
                        <div>
                            <h3 className="font-bold text-white mb-4">Populairste pagina's</h3>
                            {stats.topPages.length === 0 ? (
                                <p className="text-slate-500">Nog geen data beschikbaar</p>
                            ) : (
                                <div className="space-y-2">
                                    {stats.topPages.map(([path, count]) => (
                                        <div key={path} className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
                                                <div 
                                                    className="h-full bg-blue-600 flex items-center px-2"
                                                    style={{ width: `${(count / stats.topPages[0][1]) * 100}%` }}
                                                >
                                                    <span className="text-xs text-white truncate">{path}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-400 w-12 text-right">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Top events */}
                        <div>
                            <h3 className="font-bold text-white mb-4">Meest voorkomende events</h3>
                            {stats.topEvents.length === 0 ? (
                                <p className="text-slate-500">Nog geen events geregistreerd</p>
                            ) : (
                                <div className="space-y-2">
                                    {stats.topEvents.map(([name, count]) => (
                                        <div key={name} className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
                                                <div 
                                                    className="h-full bg-green-600 flex items-center px-2"
                                                    style={{ width: `${(count / stats.topEvents[0][1]) * 100}%` }}
                                                >
                                                    <span className="text-xs text-white truncate">{name}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-400 w-12 text-right">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'pages' && (
                    <div>
                        <h3 className="font-bold text-white mb-4">Alle paginaweergaven</h3>
                        {filteredData.pageViews.length === 0 ? (
                            <p className="text-slate-500">Nog geen paginaweergaven geregistreerd</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-800">
                                            <th className="text-left py-2 px-3">Pagina</th>
                                            <th className="text-left py-2 px-3">Titel</th>
                                            <th className="text-left py-2 px-3">Tijdstip</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.pageViews.slice(-50).reverse().map(pv => (
                                            <tr key={pv.id} className="border-b border-slate-800/50">
                                                <td className="py-2 px-3 text-white">{pv.path}</td>
                                                <td className="py-2 px-3 text-slate-400">{pv.title}</td>
                                                <td className="py-2 px-3 text-slate-500">
                                                    {new Date(pv.timestamp).toLocaleString('nl-NL')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'events' && (
                    <div>
                        <h3 className="font-bold text-white mb-4">Alle events</h3>
                        {filteredData.events.length === 0 ? (
                            <p className="text-slate-500">Nog geen events geregistreerd</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-slate-400 border-b border-slate-800">
                                            <th className="text-left py-2 px-3">Event</th>
                                            <th className="text-left py-2 px-3">Categorie</th>
                                            <th className="text-left py-2 px-3">Label</th>
                                            <th className="text-left py-2 px-3">Tijdstip</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredData.events.slice(-50).reverse().map(ev => (
                                            <tr key={ev.id} className="border-b border-slate-800/50">
                                                <td className="py-2 px-3 text-white">{ev.name}</td>
                                                <td className="py-2 px-3 text-slate-400">{ev.category}</td>
                                                <td className="py-2 px-3 text-slate-400">{ev.label || '-'}</td>
                                                <td className="py-2 px-3 text-slate-500">
                                                    {new Date(ev.timestamp).toLocaleString('nl-NL')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Clear data button */}
            <div className="mt-4 text-right">
                <button
                    onClick={() => {
                        if (confirm('Weet je zeker dat je alle analytics data wilt wissen?')) {
                            saveAnalyticsData({ pageViews: [], events: [] });
                            setData({ pageViews: [], events: [] });
                        }
                    }}
                    className="text-sm text-slate-500 hover:text-red-400 transition"
                >
                    <i className="fas fa-trash mr-1"></i>
                    Data wissen
                </button>
            </div>
        </div>
    );
};

export default AnalyticsTracker;

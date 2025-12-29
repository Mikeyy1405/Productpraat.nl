/**
 * Catalog Import Panel
 *
 * Admin panel for bulk importing products from Bol.com
 * across all categories with progress tracking
 */

import React, { useState, useEffect } from 'react';

// Types
interface Category {
    key: string;
    displayName: string;
    categoryId: string;
    searchTerm: string;
    group: string;
}

interface CategoryGroups {
    [group: string]: string[];
}

interface ImportResult {
    category: string;
    categoryName: string;
    status: 'success' | 'failed' | 'pending' | 'importing';
    count: number;
    error?: string;
    usedFallback?: boolean;
}

interface CatalogStats {
    totalCategories: number;
    bolApiConfigured: boolean;
    databaseConfigured: boolean;
    totalProducts?: number;
    bolProducts?: number;
    productsByCategory?: Record<string, number>;
}

const CatalogImportPanel: React.FC = () => {
    // State
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryGroups, setCategoryGroups] = useState<CategoryGroups>({});
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [productsPerCategory, setProductsPerCategory] = useState(20);
    const [isImporting, setIsImporting] = useState(false);
    const [importResults, setImportResults] = useState<ImportResult[]>([]);
    const [stats, setStats] = useState<CatalogStats | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch categories and stats on mount
    useEffect(() => {
        fetchCategories();
        fetchStats();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/catalog/categories');
            const data = await response.json();
            setCategories(data.categories || []);
            setCategoryGroups(data.groups || {});
        } catch (err) {
            setError('Kon categorieën niet laden');
            console.error('Failed to fetch categories:', err);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/catalog/stats');
            const data = await response.json();
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    // Toggle category selection
    const toggleCategory = (categoryKey: string) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryKey)) {
                next.delete(categoryKey);
            } else {
                next.add(categoryKey);
            }
            return next;
        });
    };

    // Select all categories in a group
    const selectGroup = (group: string) => {
        const groupCategories = categoryGroups[group] || [];
        setSelectedCategories(prev => {
            const next = new Set(prev);
            groupCategories.forEach(cat => next.add(cat));
            return next;
        });
    };

    // Deselect all categories in a group
    const deselectGroup = (group: string) => {
        const groupCategories = categoryGroups[group] || [];
        setSelectedCategories(prev => {
            const next = new Set(prev);
            groupCategories.forEach(cat => next.delete(cat));
            return next;
        });
    };

    // Select all categories
    const selectAll = () => {
        setSelectedCategories(new Set(categories.map(c => c.key)));
    };

    // Deselect all categories
    const deselectAll = () => {
        setSelectedCategories(new Set());
    };

    // Start import
    const startImport = async () => {
        if (selectedCategories.size === 0) {
            setError('Selecteer minimaal één categorie');
            return;
        }

        setIsImporting(true);
        setError(null);

        // Initialize results
        const initialResults: ImportResult[] = Array.from(selectedCategories).map(cat => ({
            category: cat,
            categoryName: categories.find(c => c.key === cat)?.displayName || cat,
            status: 'pending',
            count: 0,
        }));
        setImportResults(initialResults);

        try {
            // Import categories one by one for progress updates
            for (let i = 0; i < initialResults.length; i++) {
                const result = initialResults[i];

                // Update status to importing
                setImportResults(prev => prev.map((r, idx) =>
                    idx === i ? { ...r, status: 'importing' } : r
                ));

                try {
                    const response = await fetch('/api/catalog/import-category', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            categoryKey: result.category,
                            limit: productsPerCategory,
                        }),
                    });

                    const data = await response.json();

                    setImportResults(prev => prev.map((r, idx) =>
                        idx === i ? {
                            ...r,
                            status: data.success ? 'success' : 'failed',
                            count: data.count || 0,
                            error: data.error,
                            usedFallback: data.usedFallback,
                        } : r
                    ));
                } catch (err) {
                    setImportResults(prev => prev.map((r, idx) =>
                        idx === i ? {
                            ...r,
                            status: 'failed',
                            error: err instanceof Error ? err.message : 'Import failed',
                        } : r
                    ));
                }

                // Small delay between categories
                if (i < initialResults.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Refresh stats after import
            fetchStats();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    // Calculate totals
    const totalSelected = selectedCategories.size;
    const totalImported = importResults.reduce((sum, r) => sum + r.count, 0);
    const successCount = importResults.filter(r => r.status === 'success').length;
    const failedCount = importResults.filter(r => r.status === 'failed').length;

    return (
        <div className="bg-slate-900 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="text-3xl">📦</span>
                        Catalogus Import
                    </h2>
                    <p className="text-slate-400 mt-1">
                        Importeer producten van Bol.com naar je catalogus
                    </p>
                </div>

                {stats && (
                    <div className="flex gap-4 text-sm">
                        <div className="bg-slate-800 px-4 py-2 rounded-lg">
                            <div className="text-slate-400">Categorieën</div>
                            <div className="text-white font-bold">{stats.totalCategories}</div>
                        </div>
                        <div className="bg-slate-800 px-4 py-2 rounded-lg">
                            <div className="text-slate-400">Producten</div>
                            <div className="text-white font-bold">{stats.bolProducts || 0}</div>
                        </div>
                        <div className={`px-4 py-2 rounded-lg ${stats.bolApiConfigured ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            <div className="text-slate-400">Bol.com API</div>
                            <div className={stats.bolApiConfigured ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                {stats.bolApiConfigured ? 'Actief' : 'Niet geconfigureerd'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-2 text-red-400">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Settings */}
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-6">
                    <div>
                        <label className="text-sm text-slate-400 block mb-1">
                            Producten per categorie
                        </label>
                        <select
                            value={productsPerCategory}
                            onChange={(e) => setProductsPerCategory(Number(e.target.value))}
                            disabled={isImporting}
                            className="bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                        >
                            <option value={5}>5 producten</option>
                            <option value={10}>10 producten</option>
                            <option value={20}>20 producten</option>
                            <option value={50}>50 producten</option>
                            <option value={100}>100 producten (max)</option>
                        </select>
                    </div>

                    <div className="flex-1" />

                    <div className="flex gap-2">
                        <button
                            onClick={selectAll}
                            disabled={isImporting}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 text-sm"
                        >
                            Alles selecteren
                        </button>
                        <button
                            onClick={deselectAll}
                            disabled={isImporting}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 text-sm"
                        >
                            Niets selecteren
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Groups */}
            <div className="space-y-4 mb-6">
                {Object.entries(categoryGroups).map(([group, groupCategories]) => {
                    const selectedInGroup = groupCategories.filter(c => selectedCategories.has(c)).length;
                    const allSelected = selectedInGroup === groupCategories.length;

                    return (
                        <div key={group} className="bg-slate-800/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-white flex items-center gap-2">
                                    {group}
                                    <span className="text-sm text-slate-400 font-normal">
                                        ({selectedInGroup}/{groupCategories.length})
                                    </span>
                                </h3>
                                <button
                                    onClick={() => allSelected ? deselectGroup(group) : selectGroup(group)}
                                    disabled={isImporting}
                                    className="text-sm text-[#1877F2] hover:text-blue-400 disabled:opacity-50"
                                >
                                    {allSelected ? 'Deselecteer groep' : 'Selecteer groep'}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {groupCategories.map(catKey => {
                                    const category = categories.find(c => c.key === catKey);
                                    const isSelected = selectedCategories.has(catKey);
                                    const result = importResults.find(r => r.category === catKey);

                                    return (
                                        <button
                                            key={catKey}
                                            onClick={() => toggleCategory(catKey)}
                                            disabled={isImporting}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                                                disabled:cursor-not-allowed
                                                ${isSelected
                                                    ? 'bg-[#1877F2] text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }
                                                ${result?.status === 'success' ? 'ring-2 ring-green-500' : ''}
                                                ${result?.status === 'failed' ? 'ring-2 ring-red-500' : ''}
                                                ${result?.status === 'importing' ? 'animate-pulse' : ''}
                                            `}
                                        >
                                            {category?.displayName || catKey}
                                            {result?.status === 'success' && (
                                                <span className="ml-1 text-green-300">✓ {result.count}</span>
                                            )}
                                            {result?.status === 'failed' && (
                                                <span className="ml-1 text-red-300">✗</span>
                                            )}
                                            {result?.status === 'importing' && (
                                                <span className="ml-1">...</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Import Progress */}
            {importResults.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-white mb-3">Import Voortgang</h3>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-white">{totalImported}</div>
                            <div className="text-xs text-slate-400">Producten geïmporteerd</div>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-green-400">{successCount}</div>
                            <div className="text-xs text-slate-400">Succesvol</div>
                        </div>
                        <div className="bg-red-500/10 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-red-400">{failedCount}</div>
                            <div className="text-xs text-slate-400">Mislukt</div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-slate-300">
                                {importResults.filter(r => r.status === 'pending' || r.status === 'importing').length}
                            </div>
                            <div className="text-xs text-slate-400">Wachtend</div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-[#1877F2] to-green-500 transition-all duration-500"
                            style={{
                                width: `${((successCount + failedCount) / importResults.length) * 100}%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Import Button */}
            <div className="flex justify-end">
                <button
                    onClick={startImport}
                    disabled={isImporting || selectedCategories.size === 0}
                    className={`
                        px-8 py-3 rounded-lg font-bold text-white transition-all
                        flex items-center gap-2
                        ${isImporting
                            ? 'bg-slate-600 cursor-not-allowed'
                            : 'bg-[#1877F2] hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/20'
                        }
                        disabled:opacity-50
                    `}
                >
                    {isImporting ? (
                        <>
                            <span className="animate-spin">⏳</span>
                            Importeren...
                        </>
                    ) : (
                        <>
                            <span>🚀</span>
                            Start Import ({totalSelected} categorieën, ~{totalSelected * productsPerCategory} producten)
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CatalogImportPanel;

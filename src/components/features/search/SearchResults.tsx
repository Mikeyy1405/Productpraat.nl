/**
 * SearchResults Component
 * 
 * Displays search results with filtering options.
 * Only renders when the 'search' feature is enabled.
 */

import React, { useState, useMemo } from 'react';
import { useFeature, useTemplate } from '../../../cms';

interface SearchResult {
    id: string;
    type: 'product' | 'article' | 'page';
    title: string;
    description?: string;
    url: string;
    image?: string;
    category?: string;
    date?: string;
    score?: number;
}

interface SearchResultsProps {
    query: string;
    results: SearchResult[];
    onResultClick?: (result: SearchResult) => void;
    isLoading?: boolean;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
    query,
    results,
    onResultClick,
    isLoading = false
}) => {
    const enabled = useFeature('search');
    const { type: templateType } = useTemplate();
    
    const [activeFilter, setActiveFilter] = useState<'all' | 'product' | 'article' | 'page'>('all');
    const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'alphabetical'>('relevance');

    const filteredResults = useMemo(() => {
        let filtered = activeFilter === 'all' 
            ? results 
            : results.filter(r => r.type === activeFilter);

        // Sort results
        switch (sortBy) {
            case 'date':
                filtered = [...filtered].sort((a, b) => 
                    new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
                );
                break;
            case 'alphabetical':
                filtered = [...filtered].sort((a, b) => 
                    a.title.localeCompare(b.title)
                );
                break;
            case 'relevance':
            default:
                filtered = [...filtered].sort((a, b) => 
                    (b.score || 0) - (a.score || 0)
                );
                break;
        }

        return filtered;
    }, [results, activeFilter, sortBy]);

    const resultCounts = useMemo(() => ({
        all: results.length,
        product: results.filter(r => r.type === 'product').length,
        article: results.filter(r => r.type === 'article').length,
        page: results.filter(r => r.type === 'page').length,
    }), [results]);

    const getTypeIcon = (type: SearchResult['type']) => {
        switch (type) {
            case 'product': return 'fa-box';
            case 'article': return 'fa-newspaper';
            case 'page': return 'fa-file-alt';
            default: return 'fa-search';
        }
    };

    const getTypeLabel = (type: SearchResult['type']) => {
        switch (type) {
            case 'product': return 'Product';
            case 'article': return 'Artikel';
            case 'page': return 'Pagina';
            default: return '';
        }
    };

    if (!enabled) return null;

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                    Zoekresultaten voor "{query}"
                </h2>
                <p className="text-slate-400">
                    {results.length} {results.length === 1 ? 'resultaat' : 'resultaten'} gevonden
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {/* Type filters */}
                <div className="flex flex-wrap gap-2">
                    {(['all', 'product', 'article', 'page'] as const).map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                                activeFilter === filter
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {filter === 'all' ? 'Alles' : getTypeLabel(filter)} ({resultCounts[filter]})
                        </button>
                    ))}
                </div>

                {/* Sort dropdown */}
                <div className="ml-auto">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="relevance">Relevantie</option>
                        <option value="date">Datum</option>
                        <option value="alphabetical">Alfabetisch</option>
                    </select>
                </div>
            </div>

            {/* Loading state */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <i className="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && filteredResults.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <i className="fas fa-search text-4xl text-slate-600 mb-4"></i>
                    <h3 className="text-xl font-bold text-white mb-2">Geen resultaten gevonden</h3>
                    <p className="text-slate-400">
                        Probeer andere zoektermen of pas de filters aan.
                    </p>
                </div>
            )}

            {/* Results list */}
            {!isLoading && filteredResults.length > 0 && (
                <div className="space-y-4">
                    {filteredResults.map(result => (
                        <div
                            key={result.id}
                            onClick={() => onResultClick?.(result)}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-600 cursor-pointer transition-all duration-300 group"
                        >
                            <div className="flex items-start gap-4">
                                {/* Image or icon */}
                                {result.image ? (
                                    <img 
                                        src={result.image} 
                                        alt={result.title}
                                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                                        <i className={`fas ${getTypeIcon(result.type)} text-2xl text-slate-500`}></i>
                                    </div>
                                )}

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            result.type === 'product' ? 'bg-green-600/20 text-green-400' :
                                            result.type === 'article' ? 'bg-purple-600/20 text-purple-400' :
                                            'bg-slate-600/20 text-slate-400'
                                        }`}>
                                            {getTypeLabel(result.type)}
                                        </span>
                                        {result.category && (
                                            <span className="text-xs text-slate-500">{result.category}</span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition mb-1 line-clamp-1">
                                        {result.title}
                                    </h3>
                                    {result.description && (
                                        <p className="text-slate-400 text-sm line-clamp-2">
                                            {result.description}
                                        </p>
                                    )}
                                    {result.date && (
                                        <div className="mt-2 text-xs text-slate-500">
                                            <i className="fas fa-calendar mr-1"></i>
                                            {new Date(result.date).toLocaleDateString('nl-NL')}
                                        </div>
                                    )}
                                </div>

                                {/* Arrow */}
                                <i className="fas fa-chevron-right text-slate-600 group-hover:text-blue-400 transition flex-shrink-0"></i>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchResults;

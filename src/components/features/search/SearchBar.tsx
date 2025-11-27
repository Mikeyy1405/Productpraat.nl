/**
 * SearchBar Component
 * 
 * Live search bar with autocomplete functionality.
 * Only renders when the 'search' feature is enabled.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

interface SearchResult {
    id: string;
    type: 'product' | 'article' | 'page';
    title: string;
    description?: string;
    url: string;
    image?: string;
}

interface SearchBarProps {
    onSearch?: (query: string) => void;
    onResultClick?: (result: SearchResult) => void;
    placeholder?: string;
    className?: string;
    showAutocomplete?: boolean;
    searchData?: SearchResult[];
}

export const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    onResultClick,
    placeholder = 'Zoek producten, artikelen...',
    className = '',
    showAutocomplete = true,
    searchData = []
}) => {
    const enabled = useFeature('search');
    const { settings } = useFeatureToggle('search');
    const { type: templateType } = useTemplate();
    
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!showAutocomplete || query.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            const lowerQuery = query.toLowerCase();
            const filtered = searchData.filter(item =>
                item.title.toLowerCase().includes(lowerQuery) ||
                (item.description && item.description.toLowerCase().includes(lowerQuery))
            ).slice(0, 8);
            setResults(filtered);
            setIsOpen(filtered.length > 0);
            setIsLoading(false);
            setSelectedIndex(-1);
        }, 300);

        return () => clearTimeout(timer);
    }, [query, searchData, showAutocomplete]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim() && onSearch) {
            onSearch(query.trim());
            setIsOpen(false);
        }
    }, [query, onSearch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, -1));
                break;
            case 'Enter':
                if (selectedIndex >= 0 && results[selectedIndex]) {
                    e.preventDefault();
                    handleResultClick(results[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    }, [isOpen, results, selectedIndex]);

    const handleResultClick = useCallback((result: SearchResult) => {
        if (onResultClick) {
            onResultClick(result);
        }
        setQuery(result.title);
        setIsOpen(false);
    }, [onResultClick]);

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
        <div ref={containerRef} className={`relative ${className}`}>
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => results.length > 0 && setIsOpen(true)}
                        placeholder={placeholder}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all duration-300"
                        aria-label="Zoeken"
                        aria-autocomplete="list"
                        aria-expanded={isOpen}
                        role="combobox"
                    />
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    {isLoading && (
                        <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-blue-500"></i>
                    )}
                </div>
            </form>

            {/* Autocomplete dropdown */}
            {isOpen && showAutocomplete && (
                <div 
                    className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden animate-fade-in"
                    role="listbox"
                >
                    {results.map((result, index) => (
                        <div
                            key={result.id}
                            onClick={() => handleResultClick(result)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`flex items-center gap-3 p-3 cursor-pointer transition-all duration-200 ${
                                index === selectedIndex ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                            }`}
                            role="option"
                            aria-selected={index === selectedIndex}
                        >
                            {result.image ? (
                                <img 
                                    src={result.image} 
                                    alt={result.title}
                                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                                    <i className={`fas ${getTypeIcon(result.type)} text-slate-400`}></i>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate">{result.title}</div>
                                {result.description && (
                                    <div className="text-sm text-slate-500 truncate">{result.description}</div>
                                )}
                            </div>
                            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded flex-shrink-0">
                                {getTypeLabel(result.type)}
                            </span>
                        </div>
                    ))}
                    
                    {/* Search all results link */}
                    <div 
                        onClick={handleSubmit as any}
                        className="p-3 border-t border-slate-800 text-center text-blue-400 hover:bg-slate-800/50 cursor-pointer transition"
                    >
                        <i className="fas fa-search mr-2"></i>
                        Alle resultaten voor "{query}"
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchBar;

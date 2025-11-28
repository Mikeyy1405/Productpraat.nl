/**
 * Shop Page Component
 * 
 * Full shop interface with product grid, filters, search, and pagination.
 * Displays Bol.com products with affiliate links.
 * 
 * @module src/pages/ShopPage
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShopProductCard } from '../components/shop/ProductCard';
import { FilterSidebar, type Filters } from '../components/shop/FilterSidebar';
import { DealsSection } from '../components/shop/DealsSection';
import { CategoryNav } from '../components/shop/CategoryNav';
import type { DbProduct, DbCategory } from '../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

interface ShopPageProps {
    initialCategory?: string;
    initialSearch?: string;
    onNavigateHome?: () => void;
}

interface SearchResult {
    products: DbProduct[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 24;

const SORT_OPTIONS = [
    { value: 'relevance', label: 'Relevantie' },
    { value: 'popularity', label: 'Populariteit' },
    { value: 'price_asc', label: 'Prijs (laag-hoog)' },
    { value: 'price_desc', label: 'Prijs (hoog-laag)' },
    { value: 'rating', label: 'Best beoordeeld' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const ShopPage: React.FC<ShopPageProps> = ({
    initialCategory,
    initialSearch,
    onNavigateHome,
}) => {
    // State
    const [products, setProducts] = useState<DbProduct[]>([]);
    const [categories, setCategories] = useState<DbCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState(initialSearch || '');
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    
    // Filters state
    const [filters, setFilters] = useState<Filters>({
        categories: initialCategory ? [initialCategory] : [],
        priceRange: [0, 5000],
        rating: 0,
        inStock: false,
        brands: [],
        sortBy: 'popularity',
    });

    // Fetch products
    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            const params = new URLSearchParams();
            
            if (searchTerm) {
                params.set('q', searchTerm);
            }
            if (filters.categories.length > 0) {
                params.set('category', filters.categories.join(','));
            }
            if (filters.priceRange[0] > 0) {
                params.set('minPrice', String(filters.priceRange[0]));
            }
            if (filters.priceRange[1] < 5000) {
                params.set('maxPrice', String(filters.priceRange[1]));
            }
            if (filters.rating > 0) {
                params.set('minRating', String(filters.rating));
            }
            if (filters.inStock) {
                params.set('inStock', 'true');
            }
            if (filters.sortBy) {
                params.set('sortBy', filters.sortBy);
            }
            params.set('page', String(currentPage));
            params.set('limit', String(DEFAULT_PAGE_SIZE));
            
            const response = await fetch(`/api/products/search?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }
            
            const data: SearchResult = await response.json();
            
            setProducts(data.products);
            setTotalCount(data.totalCount);
            setTotalPages(data.totalPages);
        } catch (err) {
            console.error('Failed to fetch products:', err);
            setError('Kon producten niet laden. Probeer het later opnieuw.');
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, filters, currentPage]);

    // Fetch categories
    const fetchCategories = useCallback(async () => {
        try {
            const response = await fetch('/api/categories');
            
            if (!response.ok) {
                throw new Error('Failed to fetch categories');
            }
            
            const data = await response.json();
            setCategories(data.categories || []);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    }, []);

    // Initial data load
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // Handle search
    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault();
        setCurrentPage(1);
        fetchProducts();
    };

    // Handle filter change
    const handleFilterChange = (newFilters: Filters) => {
        setFilters(newFilters);
        setCurrentPage(1);
    };

    // Handle page change
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Handle category select
    const handleCategorySelect = (categoryId: string) => {
        setFilters(prev => ({
            ...prev,
            categories: [categoryId],
        }));
        setCurrentPage(1);
    };

    // Pagination numbers
    const paginationNumbers = useMemo(() => {
        const pages: number[] = [];
        const maxVisible = 5;
        
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        return pages;
    }, [currentPage, totalPages]);

    // Loading skeleton
    const renderSkeleton = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden animate-pulse">
                    <div className="h-48 bg-slate-800" />
                    <div className="p-4 space-y-3">
                        <div className="h-4 bg-slate-800 rounded w-3/4" />
                        <div className="h-4 bg-slate-800 rounded w-1/2" />
                        <div className="h-8 bg-slate-800 rounded w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );

    // Empty state
    const renderEmpty = () => (
        <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
                <i className="fas fa-search text-3xl text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Geen producten gevonden</h3>
            <p className="text-slate-400 mb-6">
                Probeer andere zoektermen of filters
            </p>
            <button
                onClick={() => {
                    setSearchTerm('');
                    setFilters({
                        categories: [],
                        priceRange: [0, 5000],
                        rating: 0,
                        inStock: false,
                        brands: [],
                        sortBy: 'popularity',
                    });
                }}
                className="bg-[#1877F2] hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
            >
                Filters wissen
            </button>
        </div>
    );

    // Error state
    const renderError = () => (
        <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-900/20 flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Er ging iets mis</h3>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
                onClick={fetchProducts}
                className="bg-[#1877F2] hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
            >
                Opnieuw proberen
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Category Navigation */}
            <CategoryNav
                categories={categories}
                selectedCategory={filters.categories[0]}
                onSelectCategory={handleCategorySelect}
            />

            {/* Deals Section */}
            <DealsSection />

            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div>
                        <nav className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                            <button
                                onClick={onNavigateHome}
                                className="hover:text-white transition"
                            >
                                Home
                            </button>
                            <i className="fas fa-chevron-right text-xs text-slate-600" />
                            <span className="text-white font-medium">Shop</span>
                        </nav>
                        <h1 className="text-3xl font-bold text-white">
                            {searchTerm ? `Zoekresultaten: "${searchTerm}"` : 'Alle Producten'}
                        </h1>
                        <p className="text-slate-400 mt-1">
                            {totalCount.toLocaleString('nl-NL')} producten gevonden
                        </p>
                    </div>

                    {/* Search & Sort */}
                    <div className="flex flex-col sm:flex-row gap-4 mt-4 lg:mt-0">
                        {/* Search */}
                        <form onSubmit={handleSearch} className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Zoek producten..."
                                className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 pl-10 text-white placeholder-slate-500 focus:outline-none focus:border-[#1877F2] transition"
                            />
                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        </form>

                        {/* Sort */}
                        <select
                            value={filters.sortBy}
                            onChange={(e) => handleFilterChange({ ...filters, sortBy: e.target.value as Filters['sortBy'] })}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#1877F2] transition cursor-pointer"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        {/* Mobile filter toggle */}
                        <button
                            onClick={() => setShowMobileFilters(true)}
                            className="lg:hidden bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white flex items-center gap-2"
                        >
                            <i className="fas fa-filter" />
                            Filters
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex gap-8">
                    {/* Sidebar - Desktop */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <FilterSidebar
                            filters={filters}
                            categories={categories}
                            onFilterChange={handleFilterChange}
                        />
                    </aside>

                    {/* Mobile Filters Overlay */}
                    {showMobileFilters && (
                        <div className="fixed inset-0 z-50 lg:hidden">
                            <div
                                className="absolute inset-0 bg-black/60"
                                onClick={() => setShowMobileFilters(false)}
                            />
                            <div className="absolute right-0 top-0 h-full w-80 max-w-full bg-slate-950 overflow-y-auto">
                                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-white">Filters</h3>
                                    <button
                                        onClick={() => setShowMobileFilters(false)}
                                        className="text-slate-400 hover:text-white"
                                    >
                                        <i className="fas fa-times text-xl" />
                                    </button>
                                </div>
                                <div className="p-4">
                                    <FilterSidebar
                                        filters={filters}
                                        categories={categories}
                                        onFilterChange={(newFilters) => {
                                            handleFilterChange(newFilters);
                                            setShowMobileFilters(false);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Product Grid */}
                    <div className="flex-1">
                        {isLoading ? (
                            renderSkeleton()
                        ) : error ? (
                            renderError()
                        ) : products.length === 0 ? (
                            renderEmpty()
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {products.map((product) => (
                                        <ShopProductCard key={product.id} product={product} />
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-12">
                                        <button
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-600 transition"
                                        >
                                            <i className="fas fa-chevron-left" />
                                        </button>

                                        {paginationNumbers[0] > 1 && (
                                            <>
                                                <button
                                                    onClick={() => handlePageChange(1)}
                                                    className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 text-white hover:border-slate-600 transition"
                                                >
                                                    1
                                                </button>
                                                {paginationNumbers[0] > 2 && (
                                                    <span className="text-slate-500">...</span>
                                                )}
                                            </>
                                        )}

                                        {paginationNumbers.map((page) => (
                                            <button
                                                key={page}
                                                onClick={() => handlePageChange(page)}
                                                className={`w-10 h-10 rounded-lg border transition ${
                                                    page === currentPage
                                                        ? 'bg-[#1877F2] border-[#1877F2] text-white'
                                                        : 'bg-slate-900 border-slate-700 text-white hover:border-slate-600'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}

                                        {paginationNumbers[paginationNumbers.length - 1] < totalPages && (
                                            <>
                                                {paginationNumbers[paginationNumbers.length - 1] < totalPages - 1 && (
                                                    <span className="text-slate-500">...</span>
                                                )}
                                                <button
                                                    onClick={() => handlePageChange(totalPages)}
                                                    className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 text-white hover:border-slate-600 transition"
                                                >
                                                    {totalPages}
                                                </button>
                                            </>
                                        )}

                                        <button
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-600 transition"
                                        >
                                            <i className="fas fa-chevron-right" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopPage;

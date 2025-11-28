/**
 * Filter Sidebar Component
 * 
 * Sidebar with filters for the shop page including categories, price range,
 * rating, stock status, and brands.
 * 
 * @module src/components/shop/FilterSidebar
 */

import React, { useState, useMemo } from 'react';
import type { DbCategory } from '../../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

export interface Filters {
    categories: string[];
    priceRange: [number, number];
    rating: number;
    inStock: boolean;
    brands: string[];
    sortBy: 'relevance' | 'popularity' | 'price_asc' | 'price_desc' | 'rating';
}

interface FilterSidebarProps {
    filters: Filters;
    categories: DbCategory[];
    onFilterChange: (filters: Filters) => void;
    availableBrands?: string[];
    priceMin?: number;
    priceMax?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RATING_OPTIONS = [
    { value: 4, label: '4+ sterren' },
    { value: 3, label: '3+ sterren' },
    { value: 2, label: '2+ sterren' },
    { value: 1, label: '1+ ster' },
];

const PRICE_PRESETS = [
    { label: 'Tot €50', min: 0, max: 50 },
    { label: '€50 - €100', min: 50, max: 100 },
    { label: '€100 - €250', min: 100, max: 250 },
    { label: '€250 - €500', min: 250, max: 500 },
    { label: '€500 - €1000', min: 500, max: 1000 },
    { label: 'Boven €1000', min: 1000, max: 10000 },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
    filters,
    categories,
    onFilterChange,
    availableBrands = [],
    priceMin = 0,
    priceMax = 5000,
}) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        categories: true,
        price: true,
        rating: true,
        availability: true,
        brands: false,
    });

    // Build category tree
    const categoryTree = useMemo(() => {
        const rootCategories = categories.filter(c => !c.parent_id);
        
        const buildTree = (parentId: string | null): DbCategory[] => {
            return categories
                .filter(c => c.parent_id === parentId)
                .map(c => ({
                    ...c,
                    children: buildTree(c.id),
                }));
        };
        
        return rootCategories.map(c => ({
            ...c,
            children: buildTree(c.id),
        }));
    }, [categories]);

    // Toggle section
    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    // Handle category toggle
    const handleCategoryToggle = (categoryId: string) => {
        const newCategories = filters.categories.includes(categoryId)
            ? filters.categories.filter(id => id !== categoryId)
            : [...filters.categories, categoryId];
        
        onFilterChange({
            ...filters,
            categories: newCategories,
        });
    };

    // Handle price preset
    const handlePricePreset = (min: number, max: number) => {
        onFilterChange({
            ...filters,
            priceRange: [min, max],
        });
    };

    // Handle rating change
    const handleRatingChange = (rating: number) => {
        onFilterChange({
            ...filters,
            rating: filters.rating === rating ? 0 : rating,
        });
    };

    // Handle stock toggle
    const handleStockToggle = () => {
        onFilterChange({
            ...filters,
            inStock: !filters.inStock,
        });
    };

    // Handle brand toggle
    const handleBrandToggle = (brand: string) => {
        const newBrands = filters.brands.includes(brand)
            ? filters.brands.filter(b => b !== brand)
            : [...filters.brands, brand];
        
        onFilterChange({
            ...filters,
            brands: newBrands,
        });
    };

    // Clear all filters
    const handleClearFilters = () => {
        onFilterChange({
            categories: [],
            priceRange: [priceMin, priceMax],
            rating: 0,
            inStock: false,
            brands: [],
            sortBy: 'popularity',
        });
    };

    // Check if any filters are active
    const hasActiveFilters = 
        filters.categories.length > 0 ||
        filters.priceRange[0] > priceMin ||
        filters.priceRange[1] < priceMax ||
        filters.rating > 0 ||
        filters.inStock ||
        filters.brands.length > 0;

    // Render category item
    const renderCategoryItem = (category: DbCategory & { children?: DbCategory[] }, level: number = 0) => (
        <div key={category.id} style={{ paddingLeft: `${level * 12}px` }}>
            <label className="flex items-center gap-2 py-1.5 cursor-pointer group">
                <input
                    type="checkbox"
                    checked={filters.categories.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#1877F2] focus:ring-[#1877F2] focus:ring-offset-slate-900"
                />
                <span className="text-sm text-slate-300 group-hover:text-white transition flex-1">
                    {category.name}
                </span>
                {category.product_count && category.product_count > 0 && (
                    <span className="text-xs text-slate-500">
                        ({category.product_count})
                    </span>
                )}
            </label>
            {category.children?.map(child => renderCategoryItem(child as DbCategory & { children?: DbCategory[] }, level + 1))}
        </div>
    );

    // Render section header
    const renderSectionHeader = (title: string, section: string) => (
        <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between py-3 text-left"
        >
            <span className="text-sm font-bold text-white uppercase tracking-wider">
                {title}
            </span>
            <i className={`fas fa-chevron-${expandedSections[section] ? 'up' : 'down'} text-slate-500 text-xs`} />
        </button>
    );

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sticky top-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Filters</h3>
                {hasActiveFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="text-sm text-[#1877F2] hover:text-blue-400 transition"
                    >
                        Wissen
                    </button>
                )}
            </div>

            {/* Categories */}
            <div className="border-b border-slate-800">
                {renderSectionHeader('Categorieën', 'categories')}
                {expandedSections.categories && (
                    <div className="pb-4 max-h-60 overflow-y-auto custom-scrollbar">
                        {categoryTree.length > 0 ? (
                            categoryTree.map(cat => renderCategoryItem(cat as DbCategory & { children?: DbCategory[] }))
                        ) : (
                            <p className="text-sm text-slate-500 italic">
                                Geen categorieën beschikbaar
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Price Range */}
            <div className="border-b border-slate-800">
                {renderSectionHeader('Prijs', 'price')}
                {expandedSections.price && (
                    <div className="pb-4 space-y-2">
                        {PRICE_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePricePreset(preset.min, preset.max)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                                    filters.priceRange[0] === preset.min && filters.priceRange[1] === preset.max
                                        ? 'bg-[#1877F2] text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                        
                        {/* Custom range inputs */}
                        <div className="flex items-center gap-2 mt-3">
                            <input
                                type="number"
                                value={filters.priceRange[0]}
                                onChange={(e) => onFilterChange({
                                    ...filters,
                                    priceRange: [parseInt(e.target.value) || 0, filters.priceRange[1]],
                                })}
                                placeholder="Min"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1877F2]"
                            />
                            <span className="text-slate-500">-</span>
                            <input
                                type="number"
                                value={filters.priceRange[1]}
                                onChange={(e) => onFilterChange({
                                    ...filters,
                                    priceRange: [filters.priceRange[0], parseInt(e.target.value) || 5000],
                                })}
                                placeholder="Max"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1877F2]"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Rating */}
            <div className="border-b border-slate-800">
                {renderSectionHeader('Beoordeling', 'rating')}
                {expandedSections.rating && (
                    <div className="pb-4 space-y-2">
                        {RATING_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleRatingChange(option.value)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                                    filters.rating === option.value
                                        ? 'bg-[#1877F2] text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                <div className="flex gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <i
                                            key={i}
                                            className={`fas fa-star text-xs ${
                                                i < option.value ? 'text-amber-400' : 'text-slate-600'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Availability */}
            <div className="border-b border-slate-800">
                {renderSectionHeader('Beschikbaarheid', 'availability')}
                {expandedSections.availability && (
                    <div className="pb-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div
                                onClick={handleStockToggle}
                                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                                    filters.inStock ? 'bg-[#1877F2]' : 'bg-slate-700'
                                }`}
                            >
                                <div
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                                        filters.inStock ? 'translate-x-5' : 'translate-x-1'
                                    }`}
                                />
                            </div>
                            <span className="text-sm text-slate-300 group-hover:text-white transition">
                                Alleen op voorraad
                            </span>
                        </label>
                    </div>
                )}
            </div>

            {/* Brands */}
            {availableBrands.length > 0 && (
                <div>
                    {renderSectionHeader('Merken', 'brands')}
                    {expandedSections.brands && (
                        <div className="pb-4 max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                            {availableBrands.map((brand) => (
                                <label key={brand} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={filters.brands.includes(brand)}
                                        onChange={() => handleBrandToggle(brand)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#1877F2] focus:ring-[#1877F2] focus:ring-offset-slate-900"
                                    />
                                    <span className="text-sm text-slate-300 group-hover:text-white transition">
                                        {brand}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500 mb-2">Actieve filters:</p>
                    <div className="flex flex-wrap gap-2">
                        {filters.categories.map(catId => {
                            const cat = categories.find(c => c.id === catId);
                            return cat ? (
                                <span
                                    key={catId}
                                    className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs"
                                >
                                    {cat.name}
                                    <button
                                        onClick={() => handleCategoryToggle(catId)}
                                        className="hover:text-white"
                                    >
                                        <i className="fas fa-times" />
                                    </button>
                                </span>
                            ) : null;
                        })}
                        {(filters.priceRange[0] > priceMin || filters.priceRange[1] < priceMax) && (
                            <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs">
                                €{filters.priceRange[0]} - €{filters.priceRange[1]}
                                <button
                                    onClick={() => onFilterChange({
                                        ...filters,
                                        priceRange: [priceMin, priceMax],
                                    })}
                                    className="hover:text-white"
                                >
                                    <i className="fas fa-times" />
                                </button>
                            </span>
                        )}
                        {filters.rating > 0 && (
                            <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs">
                                {filters.rating}+ sterren
                                <button
                                    onClick={() => onFilterChange({
                                        ...filters,
                                        rating: 0,
                                    })}
                                    className="hover:text-white"
                                >
                                    <i className="fas fa-times" />
                                </button>
                            </span>
                        )}
                        {filters.inStock && (
                            <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs">
                                Op voorraad
                                <button
                                    onClick={handleStockToggle}
                                    className="hover:text-white"
                                >
                                    <i className="fas fa-times" />
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterSidebar;

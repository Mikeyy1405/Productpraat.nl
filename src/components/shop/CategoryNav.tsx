/**
 * Category Navigation Component
 * 
 * Mega menu navigation for shop categories with hover subcategories
 * and product counts.
 * 
 * @module src/components/shop/CategoryNav
 */

import React, { useState, useRef, useEffect } from 'react';
import type { DbCategory } from '../../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

interface CategoryNavProps {
    categories: DbCategory[];
    selectedCategory?: string;
    onSelectCategory: (categoryId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Category icons mapping
 */
const CATEGORY_ICONS: Record<string, string> = {
    // Electronics
    'elektronica': 'fa-plug',
    'computer': 'fa-laptop',
    'gaming': 'fa-gamepad',
    'telefonie': 'fa-mobile-alt',
    'tv': 'fa-tv',
    'audio': 'fa-headphones',
    'foto': 'fa-camera',
    'video': 'fa-video',
    
    // Home & Living
    'wonen': 'fa-couch',
    'slapen': 'fa-bed',
    'tuin': 'fa-seedling',
    'keuken': 'fa-utensils',
    'huishouden': 'fa-home',
    'klussen': 'fa-tools',
    
    // Fashion & Beauty
    'mode': 'fa-tshirt',
    'beauty': 'fa-magic',
    'sport': 'fa-running',
    'sieraden': 'fa-gem',
    
    // Kids & Baby
    'baby': 'fa-baby',
    'speelgoed': 'fa-puzzle-piece',
    'kinderen': 'fa-child',
    
    // Books & Media
    'boeken': 'fa-book',
    'muziek': 'fa-music',
    'film': 'fa-film',
    
    // Default
    'default': 'fa-tag',
};

/**
 * Get icon for a category based on its name
 */
function getCategoryIcon(categoryName: string): string {
    const lowerName = categoryName.toLowerCase();
    
    for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
        if (lowerName.includes(key)) {
            return icon;
        }
    }
    
    return CATEGORY_ICONS.default;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CategoryNav: React.FC<CategoryNavProps> = ({
    categories,
    selectedCategory,
    onSelectCategory,
}) => {
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Build category tree
    const rootCategories = categories.filter(c => !c.parent_id);
    
    const getChildren = (parentId: string): DbCategory[] => {
        return categories.filter(c => c.parent_id === parentId);
    };

    // Handle mouse enter with delay
    const handleMouseEnter = (categoryId: string) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setHoveredCategory(categoryId);
    };

    // Handle mouse leave with delay
    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setHoveredCategory(null);
        }, 150);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(event.target as Node)) {
                setHoveredCategory(null);
                setShowMobileMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Handle category click
    const handleCategoryClick = (categoryId: string) => {
        onSelectCategory(categoryId);
        setHoveredCategory(null);
        setShowMobileMenu(false);
    };

    return (
        <nav ref={navRef} className="bg-slate-900 border-b border-slate-800 relative z-40">
            <div className="container mx-auto px-4">
                {/* Desktop Navigation */}
                <div className="hidden lg:flex items-center gap-1 py-2 overflow-x-auto">
                    {/* All Products */}
                    <button
                        onClick={() => handleCategoryClick('')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                            !selectedCategory
                                ? 'bg-[#1877F2] text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <i className="fas fa-th-large" />
                        Alle producten
                    </button>

                    {/* Root Categories */}
                    {rootCategories.map((category) => {
                        const children = getChildren(category.id);
                        const hasChildren = children.length > 0;
                        const isSelected = selectedCategory === category.id;
                        const isHovered = hoveredCategory === category.id;

                        return (
                            <div
                                key={category.id}
                                className="relative"
                                onMouseEnter={() => handleMouseEnter(category.id)}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button
                                    onClick={() => handleCategoryClick(category.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                                        isSelected
                                            ? 'bg-[#1877F2] text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    <i className={`fas ${getCategoryIcon(category.name)} text-xs`} />
                                    {category.name}
                                    {hasChildren && (
                                        <i className={`fas fa-chevron-down text-xs transition-transform ${
                                            isHovered ? 'rotate-180' : ''
                                        }`} />
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {hasChildren && isHovered && (
                                    <div
                                        className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-2 min-w-[200px] z-50"
                                        onMouseEnter={() => handleMouseEnter(category.id)}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        {children.map((child) => (
                                            <button
                                                key={child.id}
                                                onClick={() => handleCategoryClick(child.id)}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center justify-between"
                                            >
                                                <span>{child.name}</span>
                                                {child.product_count && child.product_count > 0 && (
                                                    <span className="text-xs text-slate-500">
                                                        {child.product_count}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Mobile Navigation */}
                <div className="lg:hidden py-3">
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 rounded-lg text-white"
                    >
                        <span className="flex items-center gap-2">
                            <i className="fas fa-bars" />
                            {selectedCategory 
                                ? categories.find(c => c.id === selectedCategory)?.name || 'Categorieën'
                                : 'Alle categorieën'
                            }
                        </span>
                        <i className={`fas fa-chevron-down transition-transform ${
                            showMobileMenu ? 'rotate-180' : ''
                        }`} />
                    </button>

                    {/* Mobile Menu Dropdown */}
                    {showMobileMenu && (
                        <div className="absolute left-0 right-0 top-full bg-slate-900 border-t border-slate-800 shadow-xl z-50 max-h-[60vh] overflow-y-auto">
                            <div className="container mx-auto px-4 py-4">
                                {/* All Products */}
                                <button
                                    onClick={() => handleCategoryClick('')}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                                        !selectedCategory
                                            ? 'bg-[#1877F2] text-white'
                                            : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <i className="fas fa-th-large mr-2" />
                                    Alle producten
                                </button>

                                {/* Categories */}
                                {rootCategories.map((category) => {
                                    const children = getChildren(category.id);
                                    const isSelected = selectedCategory === category.id;

                                    return (
                                        <div key={category.id} className="mt-1">
                                            <button
                                                onClick={() => handleCategoryClick(category.id)}
                                                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${
                                                    isSelected
                                                        ? 'bg-[#1877F2] text-white'
                                                        : 'text-slate-300 hover:bg-slate-800'
                                                }`}
                                            >
                                                <i className={`fas ${getCategoryIcon(category.name)} mr-2`} />
                                                {category.name}
                                            </button>

                                            {/* Subcategories */}
                                            {children.length > 0 && (
                                                <div className="ml-6 mt-1 space-y-1">
                                                    {children.map((child) => (
                                                        <button
                                                            key={child.id}
                                                            onClick={() => handleCategoryClick(child.id)}
                                                            className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${
                                                                selectedCategory === child.id
                                                                    ? 'bg-[#1877F2]/20 text-[#1877F2]'
                                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                            }`}
                                                        >
                                                            {child.name}
                                                            {child.product_count && child.product_count > 0 && (
                                                                <span className="text-xs text-slate-500 ml-2">
                                                                    ({child.product_count})
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default CategoryNav;

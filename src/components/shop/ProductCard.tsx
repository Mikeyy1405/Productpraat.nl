/**
 * Shop Product Card Component
 * 
 * Product card for the shop grid display. Shows product image, title, price,
 * rating, stock status, and affiliate link.
 * 
 * @module src/components/shop/ProductCard
 */

import React, { useState } from 'react';
import type { DbProduct } from '../../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

interface ShopProductCardProps {
    product: DbProduct;
    onAddToFavorites?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get stock status info
 */
function getStockStatus(product: DbProduct): { label: string; color: string; icon: string } {
    if (!product.in_stock) {
        return { label: 'Uitverkocht', color: 'text-red-500', icon: '🔴' };
    }
    
    const delivery = product.delivery_description?.toLowerCase() || '';
    
    if (delivery.includes('vandaag') || delivery.includes('morgen')) {
        return { label: 'Op voorraad', color: 'text-emerald-500', icon: '🟢' };
    }
    
    if (delivery.includes('werkdag') || delivery.includes('week')) {
        return { label: 'Beperkt op voorraad', color: 'text-amber-500', icon: '🟠' };
    }
    
    return { label: 'Op voorraad', color: 'text-emerald-500', icon: '🟢' };
}

/**
 * Format price for display
 */
function formatPrice(price?: number | null): string {
    if (price === null || price === undefined) {
        return '-';
    }
    return price.toLocaleString('nl-NL', {
        style: 'currency',
        currency: 'EUR',
    });
}

/**
 * Generate affiliate URL
 */
function getAffiliateUrl(product: DbProduct): string {
    const baseUrl = product.url;
    const partnerId = (window as { __ENV__?: Record<string, string> }).__ENV__?.BOL_PARTNER_ID || 
                      (window as { __ENV__?: Record<string, string> }).__ENV__?.BOL_AFFILIATE_ID;
    
    if (!partnerId) {
        return baseUrl;
    }
    
    try {
        const url = new URL(baseUrl);
        url.searchParams.set('Referrer', `productpraat_${partnerId}`);
        return url.toString();
    } catch {
        return baseUrl;
    }
}

/**
 * Render star rating
 */
function renderStars(rating?: number | null): JSX.Element[] {
    const stars: JSX.Element[] = [];
    const ratingValue = rating || 0;
    
    for (let i = 1; i <= 5; i++) {
        if (i <= ratingValue) {
            stars.push(<i key={i} className="fas fa-star text-amber-400" />);
        } else if (i - 0.5 <= ratingValue) {
            stars.push(<i key={i} className="fas fa-star-half-alt text-amber-400" />);
        } else {
            stars.push(<i key={i} className="far fa-star text-slate-600" />);
        }
    }
    
    return stars;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ShopProductCard: React.FC<ShopProductCardProps> = ({
    product,
    onAddToFavorites,
}) => {
    const [imgError, setImgError] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    
    const stockStatus = getStockStatus(product);
    const hasDiscount = (product.discount_percentage || 0) > 0;
    const affiliateUrl = getAffiliateUrl(product);
    
    // Fallback image
    const imageSrc = imgError || !product.main_image_url
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(product.title?.substring(0, 2) || 'P')}&background=1e293b&color=94a3b8&size=400`
        : product.main_image_url;

    // Handle click tracking
    const handleBuyClick = async (e: React.MouseEvent) => {
        // Track click
        try {
            await fetch('/api/bol/track-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productEan: product.ean,
                    affiliateUrl,
                    referrer: window.location.href,
                }),
            });
        } catch {
            // Silently ignore tracking errors
        }
        
        // Open link in new tab
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div
            className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-slate-700 transition-all duration-300 group h-full relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Discount Badge */}
            {hasDiscount && (
                <div className="absolute top-3 left-3 z-10 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg">
                    -{product.discount_percentage}%
                </div>
            )}

            {/* Favorite Button */}
            {onAddToFavorites && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAddToFavorites();
                    }}
                    className="absolute top-3 right-3 z-10 w-8 h-8 bg-slate-900/80 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white transition opacity-0 group-hover:opacity-100"
                >
                    <i className="far fa-heart" />
                </button>
            )}

            {/* Image */}
            <div className="h-48 bg-white p-4 flex items-center justify-center relative overflow-hidden">
                <img
                    src={imageSrc}
                    alt={product.title}
                    onError={() => setImgError(true)}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Quick view overlay */}
                {isHovered && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium">
                            Bekijk product
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
                {/* Title */}
                <h3 className="text-sm font-bold text-white mb-2 line-clamp-2 min-h-[40px] leading-tight group-hover:text-[#1877F2] transition">
                    {product.title}
                </h3>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-0.5 text-xs">
                        {renderStars(product.average_rating)}
                    </div>
                    {product.total_ratings > 0 && (
                        <span className="text-xs text-slate-500">
                            ({product.total_ratings.toLocaleString('nl-NL')})
                        </span>
                    )}
                </div>

                {/* Stock Status */}
                <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs">{stockStatus.icon}</span>
                    <span className={`text-xs font-medium ${stockStatus.color}`}>
                        {stockStatus.label}
                    </span>
                </div>

                {/* Delivery Info */}
                {product.delivery_description && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-1">
                        <i className="fas fa-truck mr-1" />
                        {product.delivery_description}
                    </p>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Price */}
                <div className="mt-auto pt-4 border-t border-slate-800">
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-xl font-extrabold text-white">
                            {formatPrice(product.price)}
                        </span>
                        {hasDiscount && product.strikethrough_price && (
                            <span className="text-sm text-slate-500 line-through">
                                {formatPrice(product.strikethrough_price)}
                            </span>
                        )}
                    </div>

                    {/* Buy Button */}
                    <button
                        onClick={handleBuyClick}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm shadow-sm shadow-orange-900/20 transition flex items-center justify-center gap-2"
                    >
                        Bekijk op Bol.com
                        <i className="fas fa-external-link-alt text-xs" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShopProductCard;

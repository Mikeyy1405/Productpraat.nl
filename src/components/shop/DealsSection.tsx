/**
 * Deals Section Component
 * 
 * Featured section for displaying current deals, Black Friday offers,
 * flash deals, and products with significant discounts.
 * 
 * @module src/components/shop/DealsSection
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { DbProduct } from '../../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

interface DealsSectionProps {
    maxDeals?: number;
    showCountdown?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

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
 * Calculate time remaining for a deal
 */
function getTimeRemaining(endDate: Date): { hours: number; minutes: number; seconds: number } {
    const total = endDate.getTime() - Date.now();
    
    if (total <= 0) {
        return { hours: 0, minutes: 0, seconds: 0 };
    }
    
    return {
        hours: Math.floor((total / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((total / 1000 / 60) % 60),
        seconds: Math.floor((total / 1000) % 60),
    };
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

// ============================================================================
// COMPONENT
// ============================================================================

export const DealsSection: React.FC<DealsSectionProps> = ({
    maxDeals = 6,
    showCountdown = true,
}) => {
    const [deals, setDeals] = useState<DbProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

    // Fetch deals
    const fetchDeals = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await fetch(`/api/products/deals?limit=${maxDeals}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch deals');
            }
            
            const data = await response.json();
            setDeals(data.products || []);
        } catch (err) {
            console.error('Failed to fetch deals:', err);
            setError('Kon deals niet laden');
            setDeals([]);
        } finally {
            setIsLoading(false);
        }
    }, [maxDeals]);

    // Load deals on mount
    useEffect(() => {
        fetchDeals();
    }, [fetchDeals]);

    // Countdown timer (deals end at midnight)
    useEffect(() => {
        if (!showCountdown) return;
        
        // Set end time to midnight tonight
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        
        const updateCountdown = () => {
            setCountdown(getTimeRemaining(endDate));
        };
        
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        
        return () => clearInterval(interval);
    }, [showCountdown]);

    // Handle deal click
    const handleDealClick = async (product: DbProduct) => {
        const affiliateUrl = getAffiliateUrl(product);
        
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
        
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    };

    // Don't render if no deals
    if (!isLoading && deals.length === 0) {
        return null;
    }

    // Loading skeleton
    if (isLoading) {
        return (
            <section className="bg-gradient-to-r from-red-900/20 via-orange-900/20 to-red-900/20 border-y border-orange-500/20">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-8 w-48 bg-slate-800 rounded animate-pulse" />
                        <div className="h-6 w-32 bg-slate-800 rounded animate-pulse" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-slate-900 rounded-xl p-4 animate-pulse">
                                <div className="h-24 bg-slate-800 rounded mb-3" />
                                <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
                                <div className="h-6 bg-slate-800 rounded w-1/2" />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-gradient-to-r from-red-900/20 via-orange-900/20 to-red-900/20 border-y border-orange-500/20">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                            <i className="fas fa-fire text-white text-lg" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <span className="text-orange-400">🔥</span>
                                Deals van de dag
                            </h2>
                            <p className="text-sm text-slate-400">
                                De beste kortingen van dit moment
                            </p>
                        </div>
                    </div>

                    {/* Countdown */}
                    {showCountdown && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">Nog geldig:</span>
                            <div className="flex gap-1">
                                <div className="bg-slate-900 border border-orange-500/30 rounded px-2 py-1 min-w-[2.5rem] text-center">
                                    <span className="text-lg font-mono font-bold text-orange-400">
                                        {String(countdown.hours).padStart(2, '0')}
                                    </span>
                                </div>
                                <span className="text-orange-400 font-bold">:</span>
                                <div className="bg-slate-900 border border-orange-500/30 rounded px-2 py-1 min-w-[2.5rem] text-center">
                                    <span className="text-lg font-mono font-bold text-orange-400">
                                        {String(countdown.minutes).padStart(2, '0')}
                                    </span>
                                </div>
                                <span className="text-orange-400 font-bold">:</span>
                                <div className="bg-slate-900 border border-orange-500/30 rounded px-2 py-1 min-w-[2.5rem] text-center">
                                    <span className="text-lg font-mono font-bold text-orange-400">
                                        {String(countdown.seconds).padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <div className="text-center py-8">
                        <p className="text-slate-400">{error}</p>
                        <button
                            onClick={fetchDeals}
                            className="mt-2 text-[#1877F2] hover:text-blue-400"
                        >
                            Opnieuw proberen
                        </button>
                    </div>
                )}

                {/* Deals Grid */}
                {!error && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {deals.map((deal) => (
                            <div
                                key={deal.id}
                                onClick={() => handleDealClick(deal)}
                                className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-orange-500/50 hover:-translate-y-1 transition-all group relative"
                            >
                                {/* Discount Badge */}
                                <div className="absolute -top-2 -right-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
                                    -{deal.discount_percentage}%
                                </div>

                                {/* Image */}
                                <div className="h-24 flex items-center justify-center mb-3">
                                    <img
                                        src={deal.main_image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(deal.title?.substring(0, 2) || 'D')}&background=1e293b&color=94a3b8&size=100`}
                                        alt={deal.title}
                                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                                        loading="lazy"
                                    />
                                </div>

                                {/* Title */}
                                <h3 className="text-sm font-medium text-white line-clamp-2 mb-2 min-h-[40px]">
                                    {deal.title}
                                </h3>

                                {/* Price */}
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-bold text-orange-400">
                                        {formatPrice(deal.price)}
                                    </span>
                                    {deal.strikethrough_price && (
                                        <span className="text-xs text-slate-500 line-through">
                                            {formatPrice(deal.strikethrough_price)}
                                        </span>
                                    )}
                                </div>

                                {/* Hover Action */}
                                <div className="absolute inset-0 bg-orange-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="bg-orange-500 text-white px-3 py-1 rounded-lg text-sm font-bold">
                                        Bekijk deal
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* View All Link */}
                {deals.length > 0 && (
                    <div className="text-center mt-6">
                        <a
                            href="/shop?deals=true"
                            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-medium transition"
                        >
                            Bekijk alle deals
                            <i className="fas fa-arrow-right text-sm" />
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
};

export default DealsSection;

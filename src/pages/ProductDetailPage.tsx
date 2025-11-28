/**
 * Product Detail Page Component
 * 
 * Full product detail page with image gallery, specifications,
 * ratings, and buy button with affiliate tracking.
 * 
 * @module src/pages/ProductDetailPage
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { DbProduct, ProductSpecification, DbProductImage, DbCategory } from '../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

interface ProductDetailPageProps {
    ean: string;
    onNavigateBack?: () => void;
    onNavigateCategory?: (categoryId: string) => void;
}

interface ProductDetails extends DbProduct {
    images: DbProductImage[];
    specifications: ProductSpecification[];
    categories: DbCategory[];
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
 * Get stock status info
 */
function getStockStatus(product: DbProduct): { label: string; color: string; bgColor: string } {
    if (!product.in_stock) {
        return { label: 'Tijdelijk uitverkocht', color: 'text-red-500', bgColor: 'bg-red-500/10' };
    }
    
    const delivery = product.delivery_description?.toLowerCase() || '';
    
    if (delivery.includes('vandaag') || delivery.includes('morgen')) {
        return { label: 'Op voorraad', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
    }
    
    return { label: 'Op voorraad', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
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
function renderStars(rating?: number | null, size: string = 'text-base'): JSX.Element[] {
    const stars: JSX.Element[] = [];
    const ratingValue = rating || 0;
    
    for (let i = 1; i <= 5; i++) {
        if (i <= ratingValue) {
            stars.push(<i key={i} className={`fas fa-star text-amber-400 ${size}`} />);
        } else if (i - 0.5 <= ratingValue) {
            stars.push(<i key={i} className={`fas fa-star-half-alt text-amber-400 ${size}`} />);
        } else {
            stars.push(<i key={i} className={`far fa-star text-slate-600 ${size}`} />);
        }
    }
    
    return stars;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
    ean,
    onNavigateBack,
    onNavigateCategory,
}) => {
    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [showFullDescription, setShowFullDescription] = useState(false);

    // Fetch product details
    const fetchProduct = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await fetch(`/api/products/${ean}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Product niet gevonden');
                }
                throw new Error('Failed to fetch product');
            }
            
            const data = await response.json();
            setProduct(data);
        } catch (err) {
            console.error('Failed to fetch product:', err);
            setError(err instanceof Error ? err.message : 'Kon product niet laden');
        } finally {
            setIsLoading(false);
        }
    }, [ean]);

    useEffect(() => {
        fetchProduct();
    }, [fetchProduct]);

    // Handle buy click
    const handleBuyClick = async () => {
        if (!product) return;
        
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

    // Group specifications by group_title
    const groupedSpecs = product?.specifications.reduce((groups, spec) => {
        const group = spec.groupTitle || 'Algemeen';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(spec);
        return groups;
    }, {} as Record<string, ProductSpecification[]>) || {};

    // All images (main + additional)
    const allImages = product ? [
        { url: product.main_image_url || '', display_order: 0 },
        ...(product.images || []),
    ].filter(img => img.url) : [];

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950">
                <div className="container mx-auto px-4 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-slate-900 rounded-xl p-8 animate-pulse">
                            <div className="h-96 bg-slate-800 rounded-lg" />
                        </div>
                        <div className="space-y-4 animate-pulse">
                            <div className="h-8 bg-slate-800 rounded w-3/4" />
                            <div className="h-6 bg-slate-800 rounded w-1/2" />
                            <div className="h-12 bg-slate-800 rounded w-1/3" />
                            <div className="h-32 bg-slate-800 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !product) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-900/20 flex items-center justify-center">
                        <i className="fas fa-exclamation-triangle text-3xl text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        {error || 'Product niet gevonden'}
                    </h2>
                    <button
                        onClick={onNavigateBack}
                        className="bg-[#1877F2] hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
                    >
                        Terug naar shop
                    </button>
                </div>
            </div>
        );
    }

    const stockStatus = getStockStatus(product);
    const hasDiscount = (product.discount_percentage || 0) > 0;

    return (
        <div className="min-h-screen bg-slate-950">
            <div className="container mx-auto px-4 py-8">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                    <button onClick={onNavigateBack} className="hover:text-white transition">
                        <i className="fas fa-arrow-left mr-2" />
                        Shop
                    </button>
                    {product.categories?.[0] && (
                        <>
                            <i className="fas fa-chevron-right text-xs text-slate-600" />
                            <button
                                onClick={() => onNavigateCategory?.(product.categories[0].id)}
                                className="hover:text-white transition"
                            >
                                {product.categories[0].name}
                            </button>
                        </>
                    )}
                    <i className="fas fa-chevron-right text-xs text-slate-600" />
                    <span className="text-white font-medium truncate max-w-xs">
                        {product.title}
                    </span>
                </nav>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Image Gallery */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        {/* Main Image */}
                        <div className="relative aspect-square bg-white rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                            {hasDiscount && (
                                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold shadow-lg z-10">
                                    -{product.discount_percentage}%
                                </div>
                            )}
                            <img
                                src={allImages[selectedImage]?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.title?.substring(0, 2) || 'P')}&background=1e293b&color=94a3b8&size=400`}
                                alt={product.title}
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>

                        {/* Thumbnails */}
                        {allImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {allImages.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImage(index)}
                                        className={`flex-shrink-0 w-16 h-16 rounded-lg bg-white p-1 border-2 transition ${
                                            selectedImage === index
                                                ? 'border-[#1877F2]'
                                                : 'border-transparent hover:border-slate-600'
                                        }`}
                                    >
                                        <img
                                            src={img.url}
                                            alt=""
                                            className="w-full h-full object-contain"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <div className="space-y-6">
                        {/* Title & Rating */}
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                                {product.title}
                            </h1>
                            
                            {/* Rating */}
                            <div className="flex items-center gap-3">
                                <div className="flex gap-0.5">
                                    {renderStars(product.average_rating, 'text-lg')}
                                </div>
                                <span className="text-lg font-bold text-white">
                                    {product.average_rating?.toFixed(1) || '-'}
                                </span>
                                <span className="text-slate-400">
                                    ({product.total_ratings?.toLocaleString('nl-NL') || 0} reviews)
                                </span>
                            </div>
                        </div>

                        {/* Price */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-4xl font-extrabold text-white">
                                    {formatPrice(product.price)}
                                </span>
                                {hasDiscount && product.strikethrough_price && (
                                    <span className="text-xl text-slate-500 line-through">
                                        {formatPrice(product.strikethrough_price)}
                                    </span>
                                )}
                            </div>

                            {/* Stock Status */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${stockStatus.bgColor} mb-4`}>
                                <span className={`w-2 h-2 rounded-full ${
                                    stockStatus.color.includes('emerald') ? 'bg-emerald-500' : 
                                    stockStatus.color.includes('amber') ? 'bg-amber-500' : 'bg-red-500'
                                }`} />
                                <span className={`text-sm font-medium ${stockStatus.color}`}>
                                    {stockStatus.label}
                                </span>
                            </div>

                            {/* Delivery */}
                            {product.delivery_description && (
                                <p className="text-slate-400 mb-6">
                                    <i className="fas fa-truck mr-2 text-[#1877F2]" />
                                    {product.delivery_description}
                                </p>
                            )}

                            {/* Buy Button */}
                            <button
                                onClick={handleBuyClick}
                                disabled={!product.in_stock}
                                className={`w-full py-4 rounded-xl text-lg font-bold transition flex items-center justify-center gap-2 ${
                                    product.in_stock
                                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <i className="fas fa-shopping-cart" />
                                Koop op Bol.com
                                <i className="fas fa-external-link-alt text-sm" />
                            </button>

                            <p className="text-xs text-slate-500 text-center mt-3">
                                Je wordt doorgestuurd naar Bol.com om je aankoop af te ronden
                            </p>
                        </div>

                        {/* Description */}
                        {product.description && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">Beschrijving</h3>
                                <div className={`text-slate-300 prose prose-invert max-w-none ${
                                    !showFullDescription ? 'line-clamp-4' : ''
                                }`}>
                                    <p>{product.description}</p>
                                </div>
                                {product.description.length > 300 && (
                                    <button
                                        onClick={() => setShowFullDescription(!showFullDescription)}
                                        className="text-[#1877F2] hover:text-blue-400 text-sm mt-3 font-medium"
                                    >
                                        {showFullDescription ? 'Minder tonen' : 'Meer lezen'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Custom Review Summary */}
                        {product.custom_review_summary && (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-white mb-4">
                                    <i className="fas fa-comments mr-2 text-[#1877F2]" />
                                    Wat anderen zeggen
                                </h3>
                                <p className="text-slate-300 italic">
                                    "{product.custom_review_summary}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Specifications */}
                {Object.keys(groupedSpecs).length > 0 && (
                    <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-xl font-bold text-white mb-6">Specificaties</h3>
                        
                        <div className="space-y-6">
                            {Object.entries(groupedSpecs).map(([group, specs]) => (
                                <div key={group}>
                                    <h4 className="text-sm font-bold text-[#1877F2] uppercase tracking-wider mb-3">
                                        {group}
                                    </h4>
                                    <div className="divide-y divide-slate-800">
                                        {specs.map((spec, index) => (
                                            <div
                                                key={index}
                                                className="flex justify-between py-3"
                                            >
                                                <span className="text-slate-400">{spec.name}</span>
                                                <span className="text-white font-medium text-right">
                                                    {spec.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Back Button */}
                <div className="mt-8 text-center">
                    <button
                        onClick={onNavigateBack}
                        className="text-slate-400 hover:text-white transition"
                    >
                        <i className="fas fa-arrow-left mr-2" />
                        Terug naar shop
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductDetailPage;

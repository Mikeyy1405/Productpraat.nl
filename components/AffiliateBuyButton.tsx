/**
 * AffiliateBuyButton Component
 * 
 * A React component that handles affiliate link tracking and opens the affiliate URL.
 * When clicked, it:
 * 1. Tracks the click via the /api/affiliate/track endpoint
 * 2. Opens the affiliate URL in a new tab
 * 
 * Uses existing Tailwind CSS styles from the project.
 * 
 * @module components/AffiliateBuyButton
 */

import React, { useState, useCallback } from 'react';
import { AffiliateLink, AffiliateNetworkId } from '../types';

/**
 * Props for the AffiliateBuyButton component
 */
export interface AffiliateBuyButtonProps {
    /** Product ID for tracking */
    productId: string;
    /** The affiliate URL to open */
    affiliateUrl: string;
    /** Optional: Network ID for display purposes */
    networkId?: AffiliateNetworkId;
    /** Optional: Shop name to display */
    shopName?: string;
    /** Optional: Price to display */
    price?: number | string;
    /** Optional: Custom button text (default: "Bekijk product") */
    buttonText?: string;
    /** Optional: Button variant */
    variant?: 'primary' | 'secondary' | 'outline';
    /** Optional: Button size */
    size?: 'sm' | 'md' | 'lg';
    /** Optional: Full width button */
    fullWidth?: boolean;
    /** Optional: Show loading state */
    showLoading?: boolean;
    /** Optional: Custom class names */
    className?: string;
    /** Optional: Callback when click is tracked */
    onTrackingComplete?: (success: boolean) => void;
}

/**
 * Network-specific icons
 */
const NETWORK_ICONS: Record<string, string> = {
    bol: 'fa-shopping-cart',
    tradetracker: 'fa-link',
    daisycon: 'fa-external-link-alt',
    awin: 'fa-globe',
    paypro: 'fa-download',
    plugpay: 'fa-credit-card',
    default: 'fa-external-link-alt',
};

/**
 * Allowed URL patterns for affiliate networks
 * Used to validate URLs before opening them
 */
const ALLOWED_URL_PATTERNS: RegExp[] = [
    /^https?:\/\/(www\.)?bol\.com/i,
    /^https?:\/\/(www\.)?coolblue\.(nl|be)/i,
    /^https?:\/\/(www\.)?mediamarkt\.(nl|de)/i,
    /^https?:\/\/(www\.)?zalando\.(nl|be|de)/i,
    /^https?:\/\/(www\.)?amazon\.(nl|de|com|co\.uk)/i,
    /^https?:\/\/(www\.)?wehkamp\.nl/i,
    /^https?:\/\/(www\.)?tradetracker\./i,
    /^https?:\/\/(www\.)?daisycon\./i,
    /^https?:\/\/(www\.)?awin/i,
    /^https?:\/\/(www\.)?paypro\.nl/i,
    /^https?:\/\/(www\.)?plug(and)?pay\.nl/i,
    /^https:\/\//i, // Allow any HTTPS URL as fallback
];

/**
 * Validate if a URL is safe to open
 * Must be HTTP/HTTPS and optionally match known patterns
 */
const isValidAffiliateUrl = (url: string): boolean => {
    try {
        const parsedUrl = new URL(url);
        // Only allow http and https protocols
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false;
        }
        // Check against allowed patterns
        return ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
    } catch {
        return false;
    }
};

/**
 * Get button styles based on variant and size
 */
const getButtonStyles = (
    variant: 'primary' | 'secondary' | 'outline',
    size: 'sm' | 'md' | 'lg',
    fullWidth: boolean,
    isLoading: boolean
): string => {
    const baseStyles = [
        'inline-flex items-center justify-center',
        'font-bold rounded-xl',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
    ].join(' ');
    
    const variantStyles = {
        primary: [
            'bg-gradient-to-r from-green-600 to-emerald-500',
            'hover:from-green-500 hover:to-emerald-400',
            'text-white shadow-lg shadow-green-600/20',
            'focus:ring-green-500',
        ].join(' '),
        secondary: 'bg-slate-700 hover:bg-slate-600 text-white focus:ring-slate-500',
        outline: [
            'bg-transparent border-2 border-green-500',
            'text-green-400 hover:bg-green-500/10',
            'focus:ring-green-500',
        ].join(' '),
    };
    
    const sizeStyles = {
        sm: 'px-3 py-2 text-sm gap-2',
        md: 'px-5 py-3 text-base gap-2',
        lg: 'px-6 py-4 text-lg gap-3',
    };
    
    const widthStyle = fullWidth ? 'w-full' : '';
    const loadingStyle = isLoading ? 'opacity-75 cursor-wait' : '';
    
    return [baseStyles, variantStyles[variant], sizeStyles[size], widthStyle, loadingStyle]
        .filter(Boolean)
        .join(' ');
};

/**
 * Track click via API
 */
const trackAffiliateClick = async (
    productId: string,
    url: string
): Promise<{ success: boolean; linkId?: string; clickId?: string }> => {
    try {
        const response = await fetch('/api/affiliate/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId,
                url,
            }),
        });
        
        if (!response.ok) {
            console.warn('[AffiliateBuyButton] Tracking request failed:', response.status);
            return { success: false };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn('[AffiliateBuyButton] Error tracking click:', error);
        return { success: false };
    }
};

/**
 * AffiliateBuyButton Component
 * 
 * Renders a button that tracks clicks and opens affiliate links.
 * 
 * @example
 * ```tsx
 * <AffiliateBuyButton
 *     productId="product-123"
 *     affiliateUrl="https://www.bol.com/nl/p/product/123"
 *     shopName="Bol.com"
 *     price={299.99}
 *     variant="primary"
 *     size="lg"
 * />
 * ```
 */
export const AffiliateBuyButton: React.FC<AffiliateBuyButtonProps> = ({
    productId,
    affiliateUrl,
    networkId,
    shopName,
    price,
    buttonText = 'Bekijk product',
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    showLoading = true,
    className = '',
    onTrackingComplete,
}) => {
    const [isTracking, setIsTracking] = useState(false);
    
    /**
     * Handle button click
     * Validates the URL, tracks the click, and opens the affiliate URL
     */
    const handleClick = useCallback(async () => {
        if (isTracking) return;
        
        // Validate the URL before opening
        if (!isValidAffiliateUrl(affiliateUrl)) {
            console.error('[AffiliateBuyButton] Invalid or unsafe affiliate URL:', affiliateUrl);
            if (onTrackingComplete) {
                onTrackingComplete(false);
            }
            return;
        }
        
        setIsTracking(true);
        
        try {
            // Track the click (fire and forget - don't block opening the URL)
            const trackingPromise = trackAffiliateClick(productId, affiliateUrl);
            
            // Open the URL immediately (don't wait for tracking)
            // URL has been validated above as a safe HTTP/HTTPS URL
            window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
            
            // Wait for tracking to complete for the callback
            const result = await trackingPromise;
            
            if (onTrackingComplete) {
                onTrackingComplete(result.success);
            }
        } finally {
            setIsTracking(false);
        }
    }, [productId, affiliateUrl, isTracking, onTrackingComplete]);
    
    // Get the icon based on network
    const iconClass = networkId 
        ? NETWORK_ICONS[networkId] || NETWORK_ICONS.default
        : NETWORK_ICONS.default;
    
    // Format price for display
    const formattedPrice = price
        ? typeof price === 'number'
            ? `€${price.toFixed(2).replace('.', ',')}`
            : price
        : null;
    
    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isTracking && showLoading}
            className={`${getButtonStyles(variant, size, fullWidth, isTracking && showLoading)} ${className}`}
            aria-label={`${buttonText}${shopName ? ` bij ${shopName}` : ''}`}
        >
            {isTracking && showLoading ? (
                <i className="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
            ) : (
                <i className={`fas ${iconClass}`} aria-hidden="true"></i>
            )}
            
            <span className="flex items-center gap-2">
                {buttonText}
                {shopName && (
                    <span className="text-xs opacity-80">bij {shopName}</span>
                )}
            </span>
            
            {formattedPrice && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-sm font-semibold">
                    {formattedPrice}
                </span>
            )}
        </button>
    );
};

/**
 * AffiliateBuyButtonGroup Component
 * 
 * Renders multiple affiliate buy buttons for products with multiple shop options.
 * 
 * @example
 * ```tsx
 * <AffiliateBuyButtonGroup
 *     productId="product-123"
 *     links={[
 *         { url: 'https://bol.com/...', shopName: 'Bol.com', price: 299 },
 *         { url: 'https://coolblue.nl/...', shopName: 'Coolblue', price: 289 },
 *     ]}
 * />
 * ```
 */
export interface AffiliateBuyButtonGroupProps {
    /** Product ID for tracking */
    productId: string;
    /** Array of affiliate links */
    links: Array<{
        url: string;
        shopName?: string;
        price?: number | string;
        networkId?: AffiliateNetworkId;
        isPrimary?: boolean;
    }>;
    /** Optional: Maximum number of buttons to show (default: 3) */
    maxButtons?: number;
    /** Optional: Custom class names */
    className?: string;
}

export const AffiliateBuyButtonGroup: React.FC<AffiliateBuyButtonGroupProps> = ({
    productId,
    links,
    maxButtons = 3,
    className = '',
}) => {
    if (!links || links.length === 0) {
        return null;
    }
    
    // Sort links: primary first, then by price
    const sortedLinks = [...links].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        
        const priceA = typeof a.price === 'number' ? a.price : 0;
        const priceB = typeof b.price === 'number' ? b.price : 0;
        return priceA - priceB;
    });
    
    const visibleLinks = sortedLinks.slice(0, maxButtons);
    const hasMore = sortedLinks.length > maxButtons;
    
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {/* Primary button (first link) */}
            {visibleLinks[0] && (
                <AffiliateBuyButton
                    productId={productId}
                    affiliateUrl={visibleLinks[0].url}
                    shopName={visibleLinks[0].shopName}
                    price={visibleLinks[0].price}
                    networkId={visibleLinks[0].networkId}
                    variant="primary"
                    size="lg"
                    fullWidth
                    buttonText="Bekijk beste prijs"
                />
            )}
            
            {/* Secondary buttons */}
            {visibleLinks.slice(1).map((link, index) => (
                <AffiliateBuyButton
                    key={`${link.url}-${index}`}
                    productId={productId}
                    affiliateUrl={link.url}
                    shopName={link.shopName}
                    price={link.price}
                    networkId={link.networkId}
                    variant="outline"
                    size="sm"
                    fullWidth
                    buttonText="Vergelijk"
                />
            ))}
            
            {/* Show more indicator */}
            {hasMore && (
                <div className="text-xs text-slate-500 text-center mt-1">
                    +{sortedLinks.length - maxButtons} andere winkels
                </div>
            )}
        </div>
    );
};

export default AffiliateBuyButton;

/**
 * Wishlist Components
 * 
 * Wishlist functionality with add/remove and cart integration.
 * Only renders when the 'cart_wishlist' feature is enabled.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface WishlistItem {
    id: string;
    productId: string;
    name: string;
    price: number;
    image?: string;
    addedAt: string;
}

const STORAGE_KEY = 'writgo_wishlist_data';

// Load wishlist from localStorage
export const loadWishlist = (): WishlistItem[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save wishlist to localStorage
export const saveWishlist = (items: WishlistItem[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

// Add to wishlist
export const addToWishlist = (item: Omit<WishlistItem, 'id' | 'addedAt'>): boolean => {
    const items = loadWishlist();
    if (items.some(i => i.productId === item.productId)) {
        return false; // Already in wishlist
    }
    
    const newItem: WishlistItem = {
        ...item,
        id: `wishlist-${Date.now()}`,
        addedAt: new Date().toISOString()
    };
    
    saveWishlist([...items, newItem]);
    return true;
};

// Remove from wishlist
export const removeFromWishlist = (productId: string): void => {
    const items = loadWishlist();
    saveWishlist(items.filter(i => i.productId !== productId));
};

// Check if in wishlist
export const isInWishlist = (productId: string): boolean => {
    const items = loadWishlist();
    return items.some(i => i.productId === productId);
};

interface WishlistButtonProps {
    productId: string;
    productName: string;
    productPrice: number;
    productImage?: string;
    variant?: 'icon' | 'button' | 'minimal';
    className?: string;
    onAdd?: () => void;
    onRemove?: () => void;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({
    productId,
    productName,
    productPrice,
    productImage,
    variant = 'icon',
    className = '',
    onAdd,
    onRemove
}) => {
    const enabled = useFeature('cart_wishlist');
    const [isWished, setIsWished] = useState(() => isInWishlist(productId));
    const [isAnimating, setIsAnimating] = useState(false);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 300);
        
        if (isWished) {
            removeFromWishlist(productId);
            setIsWished(false);
            onRemove?.();
        } else {
            addToWishlist({
                productId,
                name: productName,
                price: productPrice,
                image: productImage
            });
            setIsWished(true);
            onAdd?.();
        }
    }, [isWished, productId, productName, productPrice, productImage, onAdd, onRemove]);

    if (!enabled) return null;

    // Minimal variant
    if (variant === 'minimal') {
        return (
            <button
                onClick={handleClick}
                className={`text-slate-400 hover:text-red-400 transition ${isWished ? 'text-red-500' : ''} ${className}`}
                title={isWished ? 'Verwijderen uit verlanglijst' : 'Toevoegen aan verlanglijst'}
            >
                <i className={`${isWished ? 'fas' : 'far'} fa-heart ${isAnimating ? 'animate-bounce' : ''}`}></i>
            </button>
        );
    }

    // Icon variant
    if (variant === 'icon') {
        return (
            <button
                onClick={handleClick}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                    isWished 
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                        : 'bg-slate-800 text-slate-400 hover:text-red-400'
                } ${className}`}
                title={isWished ? 'Verwijderen uit verlanglijst' : 'Toevoegen aan verlanglijst'}
            >
                <i className={`${isWished ? 'fas' : 'far'} fa-heart ${isAnimating ? 'animate-bounce' : ''}`}></i>
            </button>
        );
    }

    // Button variant
    return (
        <button
            onClick={handleClick}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
                isWished 
                    ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-red-400 hover:border-red-500/50'
            } ${className}`}
        >
            <i className={`${isWished ? 'fas' : 'far'} fa-heart ${isAnimating ? 'animate-bounce' : ''}`}></i>
            <span>{isWished ? 'In verlanglijst' : 'Toevoegen aan verlanglijst'}</span>
        </button>
    );
};

interface WishlistCounterProps {
    className?: string;
    onClick?: () => void;
}

export const WishlistCounter: React.FC<WishlistCounterProps> = ({
    className = '',
    onClick
}) => {
    const enabled = useFeature('cart_wishlist');
    const [count, setCount] = useState(0);

    useEffect(() => {
        const updateCount = () => {
            setCount(loadWishlist().length);
        };
        
        updateCount();
        
        // Listen for storage changes
        window.addEventListener('storage', updateCount);
        
        // Poll for changes (for same-tab updates)
        const interval = setInterval(updateCount, 1000);
        
        return () => {
            window.removeEventListener('storage', updateCount);
            clearInterval(interval);
        };
    }, []);

    if (!enabled) return null;

    return (
        <button
            onClick={onClick}
            className={`relative text-slate-400 hover:text-red-400 transition ${className}`}
            title="Verlanglijst"
        >
            <i className="far fa-heart text-xl"></i>
            {count > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {count > 99 ? '99+' : count}
                </span>
            )}
        </button>
    );
};

interface WishlistPageProps {
    onProductClick?: (productId: string) => void;
    onMoveToCart?: (item: WishlistItem) => void;
    className?: string;
}

export const WishlistPage: React.FC<WishlistPageProps> = ({
    onProductClick,
    onMoveToCart,
    className = ''
}) => {
    const enabled = useFeature('cart_wishlist');
    const [items, setItems] = useState<WishlistItem[]>(() => loadWishlist());
    const [shareUrl, setShareUrl] = useState('');
    const [showShareSuccess, setShowShareSuccess] = useState(false);

    const handleRemove = useCallback((productId: string) => {
        removeFromWishlist(productId);
        setItems(loadWishlist());
    }, []);

    const handleClearAll = useCallback(() => {
        if (confirm('Weet je zeker dat je je hele verlanglijst wilt leegmaken?')) {
            saveWishlist([]);
            setItems([]);
        }
    }, []);

    const handleShare = useCallback(() => {
        // Create shareable URL (in a real app, this would be a proper share link)
        const shareData = btoa(JSON.stringify(items.map(i => i.productId)));
        const url = `${window.location.origin}?wishlist=${shareData}`;
        
        navigator.clipboard.writeText(url);
        setShareUrl(url);
        setShowShareSuccess(true);
        setTimeout(() => setShowShareSuccess(false), 3000);
    }, [items]);

    if (!enabled) return null;

    const totalValue = items.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <i className="fas fa-heart text-red-500"></i>
                        Mijn Verlanglijst
                    </h2>
                    <p className="text-slate-400 mt-1">
                        {items.length} {items.length === 1 ? 'product' : 'producten'} • Totale waarde: €{totalValue.toFixed(2)}
                    </p>
                </div>
                
                {items.length > 0 && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleShare}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-2 rounded-lg transition flex items-center gap-2"
                        >
                            <i className="fas fa-share-alt"></i>
                            <span>Delen</span>
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg transition flex items-center gap-2"
                        >
                            <i className="fas fa-trash"></i>
                            <span>Leegmaken</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Share success message */}
            {showShareSuccess && (
                <div className="bg-green-600/20 border border-green-500/50 rounded-xl p-4 mb-6 flex items-center gap-3 animate-fade-in">
                    <i className="fas fa-check-circle text-green-400"></i>
                    <span className="text-green-300">Link gekopieerd naar klembord!</span>
                </div>
            )}

            {/* Empty state */}
            {items.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                    <i className="far fa-heart text-5xl text-slate-600 mb-4"></i>
                    <h3 className="text-xl font-bold text-white mb-2">Je verlanglijst is leeg</h3>
                    <p className="text-slate-400 mb-6">
                        Voeg producten toe aan je verlanglijst om ze later terug te vinden.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => (
                        <div 
                            key={item.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition group"
                        >
                            {/* Product image */}
                            <div 
                                className="relative aspect-video bg-slate-800 cursor-pointer"
                                onClick={() => onProductClick?.(item.productId)}
                            >
                                {item.image ? (
                                    <img 
                                        src={item.image} 
                                        alt={item.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <i className="fas fa-image text-4xl text-slate-600"></i>
                                    </div>
                                )}
                                
                                {/* Remove button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(item.productId);
                                    }}
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-900/80 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                            
                            {/* Product info */}
                            <div className="p-4">
                                <h3 
                                    className="font-bold text-white mb-2 line-clamp-2 cursor-pointer hover:text-blue-400 transition"
                                    onClick={() => onProductClick?.(item.productId)}
                                >
                                    {item.name}
                                </h3>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-xl font-bold text-blue-400">
                                        €{item.price.toFixed(2)}
                                    </span>
                                    
                                    {onMoveToCart && (
                                        <button
                                            onClick={() => onMoveToCart(item)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                                        >
                                            <i className="fas fa-shopping-cart"></i>
                                            In winkelwagen
                                        </button>
                                    )}
                                </div>
                                
                                <div className="text-xs text-slate-500 mt-2">
                                    Toegevoegd op {new Date(item.addedAt).toLocaleDateString('nl-NL')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WishlistButton;

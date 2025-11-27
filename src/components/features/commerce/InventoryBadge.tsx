/**
 * Inventory Management Components
 * 
 * Stock level indicators and inventory badges.
 * Only renders when the 'inventory_management' feature is enabled.
 */

import React from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface InventoryInfo {
    productId: string;
    stockLevel: number;
    lowStockThreshold?: number;
    reservedStock?: number;
}

const STORAGE_KEY = 'writgo_inventory_data';

// Load inventory from localStorage
export const loadInventory = (): Record<string, InventoryInfo> => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

// Save inventory to localStorage
export const saveInventory = (inventory: Record<string, InventoryInfo>): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
};

// Update stock level
export const updateStockLevel = (productId: string, change: number): void => {
    const inventory = loadInventory();
    if (inventory[productId]) {
        inventory[productId].stockLevel = Math.max(0, inventory[productId].stockLevel + change);
        saveInventory(inventory);
    }
};

// Set stock level
export const setStockLevel = (productId: string, level: number, lowThreshold: number = 5): void => {
    const inventory = loadInventory();
    inventory[productId] = {
        productId,
        stockLevel: Math.max(0, level),
        lowStockThreshold: lowThreshold,
        reservedStock: inventory[productId]?.reservedStock || 0
    };
    saveInventory(inventory);
};

// Get stock info
export const getStockInfo = (productId: string): InventoryInfo | null => {
    const inventory = loadInventory();
    return inventory[productId] || null;
};

interface InventoryBadgeProps {
    productId: string;
    showCount?: boolean;
    variant?: 'badge' | 'text' | 'detailed';
    className?: string;
}

export const InventoryBadge: React.FC<InventoryBadgeProps> = ({
    productId,
    showCount = false,
    variant = 'badge',
    className = ''
}) => {
    const enabled = useFeature('inventory_management');
    const { settings } = useFeatureToggle('inventory_management');
    const { type: templateType } = useTemplate();

    const stockInfo = getStockInfo(productId);
    
    if (!enabled) return null;

    // If no stock info, show nothing or assume in stock
    if (!stockInfo) {
        return null;
    }

    const { stockLevel, lowStockThreshold = 5 } = stockInfo;
    const isOutOfStock = stockLevel === 0;
    const isLowStock = stockLevel > 0 && stockLevel <= lowStockThreshold;
    const isInStock = stockLevel > lowStockThreshold;

    // Text variant
    if (variant === 'text') {
        if (isOutOfStock) {
            return (
                <span className={`text-red-400 font-medium ${className}`}>
                    Niet op voorraad
                </span>
            );
        }
        if (isLowStock) {
            return (
                <span className={`text-orange-400 font-medium ${className}`}>
                    Nog {stockLevel} op voorraad
                </span>
            );
        }
        return (
            <span className={`text-green-400 font-medium ${className}`}>
                Op voorraad {showCount && `(${stockLevel})`}
            </span>
        );
    }

    // Detailed variant
    if (variant === 'detailed') {
        if (isOutOfStock) {
            return (
                <div className={`bg-red-600/20 border border-red-500/50 rounded-xl p-4 ${className}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                            <i className="fas fa-times-circle text-red-400"></i>
                        </div>
                        <div>
                            <div className="font-bold text-red-400">Uitverkocht</div>
                            <div className="text-sm text-slate-400">Dit product is momenteel niet beschikbaar</div>
                        </div>
                    </div>
                </div>
            );
        }
        if (isLowStock) {
            return (
                <div className={`bg-orange-600/20 border border-orange-500/50 rounded-xl p-4 ${className}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <i className="fas fa-exclamation-triangle text-orange-400"></i>
                        </div>
                        <div>
                            <div className="font-bold text-orange-400">Bijna uitverkocht</div>
                            <div className="text-sm text-slate-400">Nog maar {stockLevel} stuks op voorraad</div>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className={`bg-green-600/20 border border-green-500/50 rounded-xl p-4 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <i className="fas fa-check-circle text-green-400"></i>
                    </div>
                    <div>
                        <div className="font-bold text-green-400">Op voorraad</div>
                        <div className="text-sm text-slate-400">
                            {showCount ? `${stockLevel} stuks beschikbaar` : 'Direct leverbaar'}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Badge variant (default)
    if (isOutOfStock) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-600/20 text-red-400 border border-red-500/30 ${className}`}>
                <i className="fas fa-times-circle"></i>
                Uitverkocht
            </span>
        );
    }
    if (isLowStock) {
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-600/20 text-orange-400 border border-orange-500/30 ${className}`}>
                <i className="fas fa-exclamation-triangle"></i>
                Nog {stockLevel}
            </span>
        );
    }
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-600/20 text-green-400 border border-green-500/30 ${className}`}>
            <i className="fas fa-check-circle"></i>
            Op voorraad
        </span>
    );
};

interface StockIndicatorProps {
    productId: string;
    className?: string;
}

export const StockIndicator: React.FC<StockIndicatorProps> = ({
    productId,
    className = ''
}) => {
    const enabled = useFeature('inventory_management');
    const stockInfo = getStockInfo(productId);

    if (!enabled || !stockInfo) return null;

    const { stockLevel, lowStockThreshold = 5 } = stockInfo;
    const maxDisplay = lowStockThreshold * 4; // Max for visual bar
    const percentage = Math.min((stockLevel / maxDisplay) * 100, 100);
    
    const getColor = () => {
        if (stockLevel === 0) return 'bg-red-500';
        if (stockLevel <= lowStockThreshold) return 'bg-orange-500';
        return 'bg-green-500';
    };

    return (
        <div className={`${className}`}>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Voorraad</span>
                <span>{stockLevel} stuks</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${getColor()} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

export default InventoryBadge;

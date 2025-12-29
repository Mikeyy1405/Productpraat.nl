/**
 * Product Comparison Component
 *
 * Allows users to compare up to 4 products side-by-side
 * with detailed specs, pros/cons, and AI-generated insights
 */

import React, { useState, useMemo } from 'react';
import { Product } from '../../../types';

interface ProductComparisonProps {
    products: Product[];
    onRemoveProduct?: (productId: string) => void;
    onProductClick?: (product: Product) => void;
    maxProducts?: number;
}

interface ComparisonCategory {
    name: string;
    icon: string;
    specs: string[];
}

// Define comparison categories with their specs
const COMPARISON_CATEGORIES: ComparisonCategory[] = [
    {
        name: 'Algemeen',
        icon: '📋',
        specs: ['Merk', 'Model', 'Type', 'Kleur', 'Gewicht', 'Afmetingen'],
    },
    {
        name: 'Prestaties',
        icon: '⚡',
        specs: ['Processor', 'Geheugen', 'Opslag', 'Snelheid', 'Vermogen', 'Capaciteit'],
    },
    {
        name: 'Scherm',
        icon: '🖥️',
        specs: ['Schermdiagonaal', 'Resolutie', 'Verversingssnelheid', 'Paneel', 'HDR'],
    },
    {
        name: 'Connectiviteit',
        icon: '📡',
        specs: ['WiFi', 'Bluetooth', 'USB', 'HDMI', 'Ethernet', 'NFC'],
    },
    {
        name: 'Batterij',
        icon: '🔋',
        specs: ['Batterijduur', 'Batterijcapaciteit', 'Oplaadtijd', 'Snelladen'],
    },
];

const ProductComparison: React.FC<ProductComparisonProps> = ({
    products,
    onRemoveProduct,
    onProductClick,
    maxProducts = 4,
}) => {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(['Algemeen', 'Prestaties'])
    );

    // Get all unique spec keys from all products
    const allSpecKeys = useMemo(() => {
        const keys = new Set<string>();
        products.forEach(product => {
            if (product.specs) {
                Object.keys(product.specs).forEach(key => keys.add(key));
            }
            if (product.specifications) {
                product.specifications.forEach(spec => keys.add(spec.label));
            }
        });
        return Array.from(keys).sort();
    }, [products]);

    // Get spec value for a product
    const getSpecValue = (product: Product, specKey: string): string => {
        // Check specs object first
        if (product.specs && product.specs[specKey]) {
            return product.specs[specKey];
        }
        // Check specifications array
        if (product.specifications) {
            const spec = product.specifications.find(
                s => s.label.toLowerCase() === specKey.toLowerCase()
            );
            if (spec) return spec.value;
        }
        return '-';
    };

    // Calculate overall score
    const getOverallScore = (product: Product): number => {
        if (product.score) return product.score;
        if (product.rating) return product.rating;
        if (product.scores) {
            const { quality, priceValue, usability, design } = product.scores;
            return Math.round(((quality + priceValue + usability + design) / 4) * 10) / 10;
        }
        return 0;
    };

    // Get winner for a specific spec
    const getWinnerForSpec = (specKey: string): string | null => {
        if (products.length < 2) return null;

        const values = products.map(p => ({
            id: p.id,
            value: getSpecValue(p, specKey),
        }));

        // Try to parse numeric values for comparison
        const numericValues = values.map(v => ({
            ...v,
            numeric: parseFloat(v.value.replace(/[^0-9.,]/g, '').replace(',', '.')),
        }));

        const validNumeric = numericValues.filter(v => !isNaN(v.numeric));
        if (validNumeric.length >= 2) {
            // For specs like price, lower is better
            const lowerIsBetter = specKey.toLowerCase().includes('prijs') ||
                                  specKey.toLowerCase().includes('gewicht') ||
                                  specKey.toLowerCase().includes('verbruik');

            const winner = lowerIsBetter
                ? validNumeric.reduce((a, b) => a.numeric < b.numeric ? a : b)
                : validNumeric.reduce((a, b) => a.numeric > b.numeric ? a : b);

            return winner.id;
        }

        return null;
    };

    const toggleCategory = (categoryName: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryName)) {
                next.delete(categoryName);
            } else {
                next.add(categoryName);
            }
            return next;
        });
    };

    if (products.length === 0) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                    Geen producten om te vergelijken
                </h3>
                <p className="text-slate-400">
                    Voeg producten toe aan de vergelijking om ze naast elkaar te zien.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden">
            {/* Header with products */}
            <div className="grid gap-4 p-4 bg-slate-800/50" style={{
                gridTemplateColumns: `200px repeat(${products.length}, 1fr)`,
            }}>
                <div className="font-semibold text-slate-400 flex items-end pb-2">
                    Vergelijk {products.length} producten
                </div>
                {products.map(product => (
                    <div key={product.id} className="relative group">
                        {onRemoveProduct && (
                            <button
                                onClick={() => onRemoveProduct(product.id)}
                                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full
                                           opacity-0 group-hover:opacity-100 transition-opacity z-10
                                           flex items-center justify-center text-sm hover:bg-red-600"
                                title="Verwijderen uit vergelijking"
                            >
                                ×
                            </button>
                        )}
                        <div
                            className="bg-slate-700/50 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-colors"
                            onClick={() => onProductClick?.(product)}
                        >
                            <img
                                src={product.image || product.imageUrl || '/placeholder.png'}
                                alt={product.title || `${product.brand} ${product.model}`}
                                className="w-full h-32 object-contain mb-2 rounded"
                            />
                            <h4 className="font-medium text-white text-sm line-clamp-2">
                                {product.title || `${product.brand} ${product.model}`}
                            </h4>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[#1877F2] font-bold">
                                    €{typeof product.price === 'number'
                                        ? product.price.toFixed(2).replace('.', ',')
                                        : product.price}
                                </span>
                                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-sm font-medium">
                                    {getOverallScore(product)}/10
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Scores comparison */}
            <div className="border-t border-slate-700">
                <div className="p-4 bg-slate-800/30">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <span>⭐</span> Scores Vergelijking
                    </h3>
                    <div className="space-y-3">
                        {['Kwaliteit', 'Prijs-kwaliteit', 'Gebruiksgemak', 'Design'].map((scoreName, idx) => {
                            const scoreKey = ['quality', 'priceValue', 'usability', 'design'][idx];
                            const maxScore = Math.max(...products.map(p =>
                                p.scores?.[scoreKey as keyof typeof p.scores] || 0
                            ));

                            return (
                                <div key={scoreName} className="grid gap-4" style={{
                                    gridTemplateColumns: `200px repeat(${products.length}, 1fr)`,
                                }}>
                                    <div className="text-sm text-slate-400">{scoreName}</div>
                                    {products.map(product => {
                                        const score = product.scores?.[scoreKey as keyof typeof product.scores] || 0;
                                        const isWinner = score === maxScore && products.length > 1;

                                        return (
                                            <div key={product.id} className="flex items-center gap-2">
                                                <div className="flex-1 bg-slate-700 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${
                                                            isWinner ? 'bg-green-500' : 'bg-[#1877F2]'
                                                        }`}
                                                        style={{ width: `${(score / 10) * 100}%` }}
                                                    />
                                                </div>
                                                <span className={`text-sm font-medium min-w-[2rem] ${
                                                    isWinner ? 'text-green-400' : 'text-white'
                                                }`}>
                                                    {score || '-'}
                                                </span>
                                                {isWinner && (
                                                    <span className="text-green-400 text-xs">👑</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Pros & Cons */}
            <div className="border-t border-slate-700">
                <div className="grid gap-4 p-4" style={{
                    gridTemplateColumns: `200px repeat(${products.length}, 1fr)`,
                }}>
                    <div className="font-semibold text-white">Voordelen</div>
                    {products.map(product => (
                        <div key={product.id} className="space-y-1">
                            {(product.pros || []).slice(0, 4).map((pro, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="text-green-400 mt-0.5">✓</span>
                                    <span className="text-slate-300">{pro}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
                <div className="grid gap-4 p-4 pt-0" style={{
                    gridTemplateColumns: `200px repeat(${products.length}, 1fr)`,
                }}>
                    <div className="font-semibold text-white">Nadelen</div>
                    {products.map(product => (
                        <div key={product.id} className="space-y-1">
                            {(product.cons || []).slice(0, 3).map((con, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="text-red-400 mt-0.5">✗</span>
                                    <span className="text-slate-300">{con}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Specifications */}
            <div className="border-t border-slate-700">
                <div className="p-4">
                    <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                        <span>📊</span> Specificaties
                    </h3>
                </div>

                {/* All specs in a simple table */}
                <div className="divide-y divide-slate-700/50">
                    {allSpecKeys.map(specKey => {
                        const winner = getWinnerForSpec(specKey);

                        return (
                            <div
                                key={specKey}
                                className="grid gap-4 px-4 py-2 hover:bg-slate-800/30"
                                style={{
                                    gridTemplateColumns: `200px repeat(${products.length}, 1fr)`,
                                }}
                            >
                                <div className="text-sm text-slate-400 font-medium">
                                    {specKey}
                                </div>
                                {products.map(product => {
                                    const value = getSpecValue(product, specKey);
                                    const isWinner = winner === product.id;

                                    return (
                                        <div
                                            key={product.id}
                                            className={`text-sm ${
                                                isWinner
                                                    ? 'text-green-400 font-medium'
                                                    : 'text-white'
                                            }`}
                                        >
                                            {value}
                                            {isWinner && <span className="ml-1">✓</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Verdict */}
            <div className="border-t border-slate-700 p-4">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <span>🏆</span> Conclusie
                </h3>
                <div className="grid gap-4" style={{
                    gridTemplateColumns: `repeat(${products.length}, 1fr)`,
                }}>
                    {products.map(product => {
                        const score = getOverallScore(product);
                        const isWinner = score === Math.max(...products.map(getOverallScore));

                        return (
                            <div
                                key={product.id}
                                className={`p-4 rounded-lg ${
                                    isWinner
                                        ? 'bg-green-500/10 border border-green-500/30'
                                        : 'bg-slate-800/50'
                                }`}
                            >
                                {isWinner && products.length > 1 && (
                                    <div className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                                        <span>👑</span> Beste Keuze
                                    </div>
                                )}
                                <h4 className="font-medium text-white mb-2">
                                    {product.title || `${product.brand} ${product.model}`}
                                </h4>
                                <p className="text-sm text-slate-400 line-clamp-3">
                                    {product.reviewContent?.verdict || product.description ||
                                     'Geen verdict beschikbaar.'}
                                </p>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-[#1877F2] font-bold text-lg">
                                        €{typeof product.price === 'number'
                                            ? product.price.toFixed(2).replace('.', ',')
                                            : product.price}
                                    </span>
                                    <button
                                        onClick={() => onProductClick?.(product)}
                                        className="bg-[#1877F2] text-white px-4 py-2 rounded-lg text-sm
                                                   hover:bg-blue-600 transition-colors"
                                    >
                                        Bekijk Product
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ProductComparison;

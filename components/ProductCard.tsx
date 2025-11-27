
import React, { useState } from 'react';
import { Product } from '../types';
import { getProductUrl } from '../services/urlService';

interface ProductCardProps {
    product: Product;
    isCompareSelected: boolean;
    onToggleCompare: (id: string) => void;
    onClick: (id: string) => void;
    variant?: 'list' | 'grid';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, isCompareSelected, onToggleCompare, onClick, variant = 'list' }) => {
    const [imgError, setImgError] = useState(false);
    
    // Generate the SEO-friendly product URL
    const productUrl = getProductUrl(product);
    
    let scoreClass = 'border-red-500 text-red-500';
    if (product.score >= 7.5) scoreClass = 'border-emerald-500 text-emerald-500';
    else if (product.score >= 6.0) scoreClass = 'border-amber-500 text-amber-500';

    const renderSeal = () => {
        if (product.predicate === 'test') {
            return (
                <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full flex flex-col items-center justify-center text-center font-extrabold text-[10px] leading-tight shadow-lg transform -rotate-6 border-2 border-slate-900 z-10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white uppercase group-hover:scale-110 transition">
                    <span>Beste<br/>uit de<br/>test</span>
                </div>
            );
        }
        if (product.predicate === 'buy') {
            return (
                <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full flex flex-col items-center justify-center text-center font-extrabold text-[10px] leading-tight shadow-lg transform -rotate-6 border-2 border-slate-900 z-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white uppercase group-hover:scale-110 transition">
                    <span>Beste<br/>Koop</span>
                </div>
            );
        }
        return null;
    };

    const handleProductClick = (e: React.MouseEvent) => {
        e.preventDefault();
        onClick(product.id);
    };

    const handleDealClick = (e: React.MouseEvent) => {
        const link = product.affiliateLink || product.affiliateUrl;
        if (link && link !== '#') {
            e.stopPropagation();
            window.open(link, '_blank', 'noopener,noreferrer');
        } else {
            e.stopPropagation();
            onClick(product.id);
        }
    };

    const imgSrc = imgError || !product.image 
        ? 'https://placehold.co/400x400/f1f5f9/94a3b8?text=Geen+Afbeelding' 
        : product.image;

    // --- GRID VARIANT (Shop Style / Vertical) ---
    if (variant === 'grid') {
        return (
            <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-slate-700 transition-all duration-300 group h-full relative">
                {/* Seal */}
                {renderSeal()}

                {/* Image Section */}
                <a 
                    href={productUrl}
                    onClick={handleProductClick}
                    className="h-48 bg-white p-4 flex items-center justify-center cursor-pointer relative overflow-hidden"
                >
                    <img 
                        src={imgSrc} 
                        alt={product.model} 
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-105 transition duration-500" 
                    />
                    {/* Score Badge floating in image area for Grid */}
                    <div className={`absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 bg-slate-900 shadow-sm ${scoreClass}`}>
                        {product.score.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                </a>

                {/* Info Section */}
                <div className="p-5 flex flex-col flex-1">
                    <div className="mb-1 text-[10px] text-[#1877F2] uppercase font-bold tracking-wider">{product.brand}</div>
                    <a 
                        href={productUrl}
                        onClick={handleProductClick}
                        className="text-base font-bold text-white mb-2 cursor-pointer hover:text-[#1877F2] transition leading-tight line-clamp-2"
                    >
                        {product.model}
                    </a>
                    
                    <div className="flex flex-wrap gap-y-1 gap-x-3 text-xs text-slate-400 mb-4 line-clamp-2">
                        {Object.entries(product.specs).slice(0, 2).map(([k, v]) => (
                            <span key={k}>{k}: <span className="text-slate-300">{v}</span></span>
                        ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-800 flex flex-col gap-3">
                         <div className="flex justify-between items-center">
                            <div className="text-xl font-extrabold text-white">€ {product.price},-</div>
                            <div 
                                onClick={() => onToggleCompare(product.id)}
                                className="cursor-pointer text-slate-500 hover:text-[#1877F2]"
                                title="Vergelijken"
                            >
                                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${isCompareSelected ? 'bg-[#1877F2] border-[#1877F2] text-white' : 'border-slate-700 bg-slate-800'}`}>
                                    <i className={`fas ${isCompareSelected ? 'fa-check' : 'fa-balance-scale'} text-xs`}></i>
                                </div>
                            </div>
                         </div>
                        <button 
                            onClick={handleDealClick}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg text-xs shadow-sm shadow-orange-900/20 transition flex items-center justify-center gap-2"
                        >
                            Bekijk deal <i className="fas fa-chevron-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- LIST VARIANT (Detailed / Horizontal) ---
    return (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_180px] gap-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-slate-700 transition-all duration-300 group">
            {/* Image Section */}
            <a 
                href={productUrl}
                onClick={handleProductClick}
                className="relative p-6 flex items-center justify-center bg-white lg:border-r border-slate-800 min-h-[200px] cursor-pointer"
            >
                {renderSeal()}
                <img 
                    src={imgSrc} 
                    alt={product.model} 
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="max-w-full max-h-32 object-contain mix-blend-multiply group-hover:scale-105 transition duration-500" 
                />
            </a>

            {/* Info Section */}
            <div className="p-6 flex flex-col justify-center">
                <div className="mb-1 text-[10px] text-[#1877F2] uppercase font-bold tracking-wider">{product.brand}</div>
                <a 
                    href={productUrl}
                    onClick={handleProductClick}
                    className="text-lg font-bold text-white mb-2 cursor-pointer hover:text-[#1877F2] transition leading-tight"
                >
                    {product.brand} {product.model}
                </a>
                
                {product.description && (
                    <a href={productUrl} onClick={handleProductClick} className="text-xs text-slate-400 mb-4 italic line-clamp-2 cursor-pointer">
                        "{product.description}"
                    </a>
                )}

                <a href={productUrl} onClick={handleProductClick} className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400 mb-4 cursor-pointer">
                    {Object.entries(product.specs).slice(0, 3).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span className="font-medium text-slate-300">{k}:</span> {v}
                        </div>
                    ))}
                </a>

                <div className="space-y-1.5 mt-auto pt-4 border-t border-slate-800">
                    {product.pros.slice(0, 2).map((pro, i) => (
                        <div key={i} className="text-xs flex items-center text-slate-300 font-medium">
                            <i className="fas fa-check text-emerald-500 mr-2 w-4"></i> {pro}
                        </div>
                    ))}
                    {product.cons.slice(0, 1).map((con, i) => (
                        <div key={i} className="text-xs flex items-center text-slate-300 font-medium">
                            <i className="fas fa-times text-red-500 mr-2 w-4"></i> {con}
                        </div>
                    ))}
                </div>
            </div>

            {/* Price & Action Section */}
            <div className="p-5 flex flex-col items-center justify-center bg-slate-950 gap-4 lg:border-l border-slate-800">
                <div className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-xl bg-slate-900 shadow-sm border-4 ${scoreClass} group-hover:shadow-md transition`}>
                        {product.score.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-1">ProductPraat Score</span>
                </div>
                
                <div className="text-center w-full space-y-2">
                    <div className="text-xl font-extrabold text-white">€ {product.price},-</div>
                    <button 
                        onClick={handleDealClick}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm shadow-sm shadow-orange-900/20 transition flex items-center justify-center gap-2"
                    >
                        Bekijk deal <i className="fas fa-chevron-right text-xs"></i>
                    </button>
                    
                    <div 
                        onClick={() => onToggleCompare(product.id)}
                        className="flex items-center justify-center gap-2 cursor-pointer text-sm text-slate-500 hover:text-[#1877F2] select-none pt-1"
                    >
                        <div className={`w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all ${isCompareSelected ? 'bg-[#1877F2] border-[#1877F2] text-white' : 'bg-transparent border-slate-600'}`}>
                            {isCompareSelected && <i className="fas fa-check text-xs"></i>}
                        </div>
                        <span className="font-medium hover:text-white transition">Vergelijken</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

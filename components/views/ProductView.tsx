import React from 'react';
import { Product, CATEGORIES } from '../../types';
import { UserReviewSection } from '../UserReviewSection';

interface ProductViewProps {
    product: Product;
    onNavigateHome: () => void;
    onNavigateCategory: (category: string) => void;
}

export const ProductView: React.FC<ProductViewProps> = ({
    product,
    onNavigateHome,
    onNavigateCategory
}) => {
    return (
        <div className="container mx-auto px-4 py-8 bg-slate-950">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6" aria-label="Breadcrumb">
                <button onClick={onNavigateHome} className="hover:text-white transition">Home</button>
                <i className="fas fa-chevron-right text-xs text-slate-600" aria-hidden="true"></i>
                <button onClick={() => onNavigateCategory(product.category)} className="hover:text-white transition">
                    {CATEGORIES[product.category]?.name || product.category}
                </button>
                <i className="fas fa-chevron-right text-xs text-slate-600" aria-hidden="true"></i>
                <span className="text-white font-medium">{product.brand} {product.model}</span>
            </nav>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Image Gallery */}
                <div className="space-y-4">
                    <div className="bg-white p-8 rounded-xl border border-slate-800">
                        <img 
                            src={product.image} 
                            alt={`${product.brand} ${product.model}`}
                            className="max-w-full max-h-96 object-contain mx-auto" 
                            referrerPolicy="no-referrer" 
                        />
                    </div>
                    {product.images && product.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {product.images.slice(0, 5).map((img, idx) => (
                                <div 
                                    key={idx}
                                    className="flex-shrink-0 w-20 h-20 bg-white rounded-lg border-2 border-slate-700 overflow-hidden"
                                >
                                    <img 
                                        src={img} 
                                        alt={`${product.brand} ${product.model} - afbeelding ${idx + 1}`}
                                        className="w-full h-full object-contain" 
                                        referrerPolicy="no-referrer"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div>
                    <h1 className="text-4xl font-bold text-white mb-4">{product.brand} {product.model}</h1>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="text-4xl font-bold text-[#1877F2]">{product.score}</div>
                        {product.bolReviewsRaw && product.bolReviewsRaw.totalReviews > 0 && (
                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <i 
                                            key={star} 
                                            className={`fas fa-star text-sm ${
                                                star <= Math.round(product.bolReviewsRaw?.averageRating ?? 0) 
                                                    ? 'text-yellow-400' 
                                                    : 'text-slate-600'
                                            }`}
                                        ></i>
                                    ))}
                                </div>
                                <span className="text-sm text-slate-400">
                                    ({product.bolReviewsRaw.totalReviews} reviews)
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {/* Price */}
                    <div className="text-3xl font-bold text-white mb-4">
                        €{product.price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </div>
                    
                    {/* Pros and Cons */}
                    {(product.pros?.length > 0 || product.cons?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {product.pros && product.pros.length > 0 && (
                                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                                    <h3 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                                        <i className="fas fa-plus-circle"></i> Pluspunten
                                    </h3>
                                    <ul className="space-y-1">
                                        {product.pros.map((pro, idx) => (
                                            <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                                                <i className="fas fa-check text-xs mt-1.5 text-green-400"></i>
                                                <span>{pro}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {product.cons && product.cons.length > 0 && (
                                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                    <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                                        <i className="fas fa-minus-circle"></i> Minpunten
                                    </h3>
                                    <ul className="space-y-1">
                                        {product.cons.map((con, idx) => (
                                            <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                                                <i className="fas fa-times text-xs mt-1.5 text-red-400"></i>
                                                <span>{con}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {product.keywords && product.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {product.keywords.map((kw, i) => (
                                <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">{kw}</span>
                            ))}
                        </div>
                    )}
                    
                    <div dangerouslySetInnerHTML={{ __html: product.longDescription || '' }} className="prose prose-invert mb-8" />
                    
                    <a 
                        href={product.affiliateLink || product.affiliateUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full py-4 rounded-xl font-bold text-lg mb-8 flex items-center justify-center bg-[#1877F2] hover:bg-blue-600 text-white"
                    >
                        <i className="fas fa-external-link-alt mr-2"></i>Bekijk aanbieding
                    </a>
                    
                    <UserReviewSection productId={product.id} />
                </div>
            </div>
        </div>
    );
};

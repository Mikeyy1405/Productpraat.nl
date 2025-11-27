import React, { useState } from 'react';
import { Product, CATEGORIES } from '../../types';
import { UserReviewSection } from '../UserReviewSection';

interface ProductViewProps {
    product: Product;
    onNavigateHome: () => void;
    onNavigateCategory: (category: string) => void;
}

/** Get the primary product image with fallback */
const getProductImage = (product: Product): string => {
    return product.imageUrl || product.image || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(product.brand || 'Product')}&background=0f172a&color=3b82f6&size=400`;
};

/** Get gallery images, excluding duplicates of the main image */
const getGalleryImages = (product: Product): string[] => {
    const mainImage = getProductImage(product);
    const allImages = [
        ...(product.galleryImages || []),
        ...(product.images || [])
    ];
    // Filter out duplicates and the main image
    return Array.from(new Set(allImages)).filter(img => img && img !== mainImage);
};

export const ProductView: React.FC<ProductViewProps> = ({
    product,
    onNavigateHome,
    onNavigateCategory
}) => {
    const [mainImageError, setMainImageError] = useState(false);
    const [galleryErrors, setGalleryErrors] = useState<Record<number, boolean>>({});
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const primaryImage = getProductImage(product);
    const galleryImages = getGalleryImages(product);
    const displayImage = selectedImage || primaryImage;

    /** Handle image error with fallback */
    const handleMainImageError = () => {
        setMainImageError(true);
    };

    /** Handle gallery image error */
    const handleGalleryError = (index: number) => {
        setGalleryErrors(prev => ({ ...prev, [index]: true }));
    };

    /** Get fallback image */
    const getFallbackImage = () => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(product.brand || 'Product')}&background=0f172a&color=3b82f6&size=400`;
    };

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
                    <div className="bg-white p-8 rounded-xl border border-slate-800 relative">
                        <img 
                            src={mainImageError ? getFallbackImage() : displayImage}
                            alt={`${product.brand} ${product.model}`}
                            className="max-w-full max-h-96 object-contain mx-auto" 
                            referrerPolicy="no-referrer"
                            onError={handleMainImageError}
                            loading="lazy"
                        />
                        {mainImageError && (
                            <div className="absolute bottom-2 right-2 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                <i className="fas fa-image mr-1"></i> Afbeelding niet beschikbaar
                            </div>
                        )}
                    </div>
                    {galleryImages.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {/* Primary image thumbnail */}
                            <button
                                onClick={() => setSelectedImage(null)}
                                className={`flex-shrink-0 w-20 h-20 bg-white rounded-lg border-2 overflow-hidden transition ${
                                    !selectedImage ? 'border-[#1877F2]' : 'border-slate-700 hover:border-slate-500'
                                }`}
                            >
                                <img 
                                    src={mainImageError ? getFallbackImage() : primaryImage}
                                    alt={`${product.brand} ${product.model} - hoofdafbeelding`}
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                />
                            </button>
                            {/* Gallery thumbnails */}
                            {galleryImages.slice(0, 4).map((img, idx) => (
                                !galleryErrors[idx] && (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedImage(img)}
                                        className={`flex-shrink-0 w-20 h-20 bg-white rounded-lg border-2 overflow-hidden transition ${
                                            selectedImage === img ? 'border-[#1877F2]' : 'border-slate-700 hover:border-slate-500'
                                        }`}
                                    >
                                        <img 
                                            src={img} 
                                            alt={`${product.brand} ${product.model} - afbeelding ${idx + 2}`}
                                            className="w-full h-full object-contain" 
                                            referrerPolicy="no-referrer"
                                            loading="lazy"
                                            onError={() => handleGalleryError(idx)}
                                        />
                                    </button>
                                )
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
                    
                    {/* Tags/Keywords */}
                    {(product.tags && product.tags.length > 0) || (product.keywords && product.keywords.length > 0) ? (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {(product.tags || product.keywords || []).map((tag, i) => (
                                <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">{tag}</span>
                            ))}
                        </div>
                    ) : null}
                    
                    {/* Short Description */}
                    {product.description && (
                        <p className="text-slate-300 mb-6 leading-relaxed">{product.description}</p>
                    )}

                    {/* CTA Button */}
                    <a 
                        href={product.affiliateLink || product.affiliateUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full py-4 rounded-xl font-bold text-lg mb-8 flex items-center justify-center bg-[#1877F2] hover:bg-blue-600 text-white transition"
                    >
                        <i className="fas fa-external-link-alt mr-2"></i>Bekijk aanbieding
                    </a>
                </div>
            </div>

            {/* Scores Breakdown - Only show if scores are available */}
            {product.scores && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-chart-bar text-[#1877F2]"></i> Score Details
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(product.scores).map(([key, value]) => {
                            const labels: Record<string, string> = {
                                quality: 'Kwaliteit',
                                priceValue: 'Prijs-kwaliteit',
                                usability: 'Gebruiksgemak',
                                design: 'Design'
                            };
                            return (
                                <div key={key} className="bg-slate-800/50 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-[#1877F2]">{value}</div>
                                    <div className="text-xs text-slate-400 uppercase mt-1">{labels[key] || key}</div>
                                    <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-[#1877F2] to-blue-400 rounded-full transition-all duration-500" 
                                            style={{ width: `${(value as number) * 10}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Review Content Sections - Only show if reviewContent is available */}
            {product.reviewContent && (
                <div className="mt-8 space-y-6">
                    {product.reviewContent.whatIsIt && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <i className="fas fa-info-circle text-blue-400"></i> Wat is het?
                            </h2>
                            <p className="text-slate-300 leading-relaxed">{product.reviewContent.whatIsIt}</p>
                        </div>
                    )}
                    
                    {product.reviewContent.forWho && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <i className="fas fa-users text-green-400"></i> Voor wie?
                            </h2>
                            <p className="text-slate-300 leading-relaxed">{product.reviewContent.forWho}</p>
                        </div>
                    )}
                    
                    {product.reviewContent.keyFeatures && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <i className="fas fa-star text-yellow-400"></i> Belangrijkste Kenmerken
                            </h2>
                            <p className="text-slate-300 leading-relaxed">{product.reviewContent.keyFeatures}</p>
                        </div>
                    )}
                    
                    {product.reviewContent.whatToConsider && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <i className="fas fa-lightbulb text-orange-400"></i> Waar Let Je Op?
                            </h2>
                            <p className="text-slate-300 leading-relaxed">{product.reviewContent.whatToConsider}</p>
                        </div>
                    )}
                    
                    {product.reviewContent.verdict && (
                        <div className="bg-gradient-to-r from-blue-900/30 to-slate-900 border border-blue-500/30 rounded-xl p-6">
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <i className="fas fa-gavel text-[#1877F2]"></i> Ons Oordeel
                            </h2>
                            <p className="text-slate-300 leading-relaxed">{product.reviewContent.verdict}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Specifications Table */}
            {product.specifications && product.specifications.length > 0 && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-list-ul text-[#1877F2]"></i> Specificaties
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        {product.specifications.map((spec, idx) => (
                            <div key={idx} className="flex justify-between py-2 border-b border-slate-800 last:border-0">
                                <span className="text-slate-400">{spec.label}</span>
                                <span className="text-white font-medium">{spec.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Features List */}
            {product.features && product.features.length > 0 && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-check-double text-green-400"></i> Kenmerken
                    </h2>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {product.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-slate-300">
                                <i className="fas fa-check text-green-400 text-xs"></i>
                                {feature}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Target Audience */}
            {product.targetAudience && product.targetAudience.length > 0 && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-user-check text-[#1877F2]"></i> Geschikt Voor
                    </h2>
                    <div className="flex flex-wrap gap-3">
                        {product.targetAudience.map((audience, idx) => (
                            <span key={idx} className="bg-blue-900/30 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-lg text-sm">
                                {audience}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* FAQ Section */}
            {product.faq && product.faq.length > 0 && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-question-circle text-[#1877F2]"></i> Veelgestelde Vragen
                    </h2>
                    <div className="space-y-4">
                        {product.faq.map((item, idx) => (
                            <div key={idx} className="bg-slate-800/50 rounded-lg p-4">
                                <h3 className="font-bold text-white mb-2">{item.question}</h3>
                                <p className="text-slate-300 text-sm">{item.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Alternatives */}
            {product.alternatives && product.alternatives.length > 0 && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-exchange-alt text-orange-400"></i> Alternatieven
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {product.alternatives.map((alt, idx) => (
                            <span key={idx} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-sm">
                                {alt}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Review Author */}
            {product.reviewAuthor && (
                <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="flex items-center gap-4">
                        <img 
                            src={product.reviewAuthor.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(product.reviewAuthor.name)}&background=random&color=fff`}
                            alt={product.reviewAuthor.name}
                            className="w-14 h-14 rounded-full"
                            loading="lazy"
                        />
                        <div>
                            <div className="font-bold text-white">{product.reviewAuthor.name}</div>
                            <div className="text-sm text-[#1877F2]">{product.reviewAuthor.role}</div>
                            {product.reviewAuthor.summary && (
                                <p className="text-xs text-slate-400 mt-1">{product.reviewAuthor.summary}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Long Description (legacy support) */}
            {product.longDescription && (
                <div className="mt-8 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: product.longDescription }} />
            )}
            
            {/* User Reviews Section */}
            <UserReviewSection productId={product.id} />
        </div>
    );
};

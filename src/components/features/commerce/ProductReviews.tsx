/**
 * Product Reviews Component
 * 
 * Product review system with star ratings and review form.
 * Only renders when the 'product_reviews' feature is enabled.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface ProductReview {
    id: string;
    productId: string;
    author: string;
    email: string;
    rating: number; // 1-5
    title: string;
    content: string;
    pros?: string[];
    cons?: string[];
    images?: string[];
    verified: boolean;
    helpful: number;
    notHelpful: number;
    createdAt: string;
    isApproved: boolean;
}

const STORAGE_KEY = 'writgo_product_reviews';
const USER_HELPFUL_KEY = 'writgo_review_helpful';

// Load reviews from localStorage
export const loadProductReviews = (): ProductReview[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save reviews to localStorage
export const saveProductReviews = (reviews: ProductReview[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
};

// Get user helpful votes
const getUserHelpful = (): Record<string, boolean> => {
    try {
        const data = localStorage.getItem(USER_HELPFUL_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

// Save user helpful vote
const saveUserHelpful = (reviewId: string, helpful: boolean): void => {
    const votes = getUserHelpful();
    votes[reviewId] = helpful;
    localStorage.setItem(USER_HELPFUL_KEY, JSON.stringify(votes));
};

interface StarRatingProps {
    rating: number;
    size?: 'sm' | 'md' | 'lg';
    showValue?: boolean;
    interactive?: boolean;
    onChange?: (rating: number) => void;
}

export const StarRating: React.FC<StarRatingProps> = ({
    rating,
    size = 'md',
    showValue = false,
    interactive = false,
    onChange
}) => {
    const [hoverRating, setHoverRating] = useState(0);
    
    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-lg',
        lg: 'text-2xl'
    };

    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && onChange?.(star)}
                    onMouseEnter={() => interactive && setHoverRating(star)}
                    onMouseLeave={() => interactive && setHoverRating(0)}
                    className={`${sizeClasses[size]} ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
                >
                    <i className={`${
                        (hoverRating || rating) >= star ? 'fas' : 'far'
                    } fa-star ${
                        (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-slate-600'
                    } transition`}></i>
                </button>
            ))}
            {showValue && (
                <span className="ml-2 text-slate-400 font-medium">{rating.toFixed(1)}</span>
            )}
        </div>
    );
};

interface ReviewFormProps {
    productId: string;
    onSubmit: (review: Omit<ProductReview, 'id' | 'createdAt' | 'helpful' | 'notHelpful' | 'isApproved' | 'verified'>) => void;
    onCancel?: () => void;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
    productId,
    onSubmit,
    onCancel
}) => {
    const [formData, setFormData] = useState({
        author: '',
        email: '',
        rating: 0,
        title: '',
        content: '',
        pros: [''],
        cons: ['']
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.author.trim()) newErrors.author = 'Naam is verplicht';
        if (!formData.email.trim()) newErrors.email = 'E-mail is verplicht';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Ongeldig e-mailadres';
        if (formData.rating === 0) newErrors.rating = 'Selecteer een beoordeling';
        if (!formData.title.trim()) newErrors.title = 'Titel is verplicht';
        if (!formData.content.trim()) newErrors.content = 'Review is verplicht';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) return;
        
        setIsSubmitting(true);
        
        onSubmit({
            productId,
            author: formData.author.trim(),
            email: formData.email.trim(),
            rating: formData.rating,
            title: formData.title.trim(),
            content: formData.content.trim(),
            pros: formData.pros.filter(p => p.trim()),
            cons: formData.cons.filter(c => c.trim())
        });
        
        setFormData({
            author: '',
            email: '',
            rating: 0,
            title: '',
            content: '',
            pros: [''],
            cons: ['']
        });
        setIsSubmitting(false);
    };

    const addListItem = (field: 'pros' | 'cons') => {
        setFormData(prev => ({
            ...prev,
            [field]: [...prev[field], '']
        }));
    };

    const updateListItem = (field: 'pros' | 'cons', index: number, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].map((item, i) => i === index ? value : item)
        }));
    };

    const removeListItem = (field: 'pros' | 'cons', index: number) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index)
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-xl font-bold text-white">Schrijf een review</h3>
            
            {/* Rating */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Beoordeling *</label>
                <StarRating 
                    rating={formData.rating} 
                    size="lg" 
                    interactive 
                    onChange={(rating) => setFormData(prev => ({ ...prev, rating }))}
                />
                {errors.rating && <p className="mt-1 text-sm text-red-400">{errors.rating}</p>}
            </div>
            
            {/* Name and Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Naam *</label>
                    <input
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition ${
                            errors.author ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="Je naam"
                    />
                    {errors.author && <p className="mt-1 text-sm text-red-400">{errors.author}</p>}
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">E-mail *</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition ${
                            errors.email ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="je@email.nl"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
                </div>
            </div>
            
            {/* Title */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Titel *</label>
                <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition ${
                        errors.title ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                    }`}
                    placeholder="Korte samenvatting van je ervaring"
                />
                {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
            </div>
            
            {/* Review content */}
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Je review *</label>
                <textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition resize-none ${
                        errors.content ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                    }`}
                    placeholder="Vertel over je ervaring met dit product..."
                />
                {errors.content && <p className="mt-1 text-sm text-red-400">{errors.content}</p>}
            </div>
            
            {/* Pros and Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pros */}
                <div>
                    <label className="block text-sm font-medium text-green-400 mb-2">
                        <i className="fas fa-plus-circle mr-1"></i> Pluspunten
                    </label>
                    {formData.pros.map((pro, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={pro}
                                onChange={(e) => updateListItem('pros', index, e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-green-500 transition text-sm"
                                placeholder="Pluspunt"
                            />
                            {formData.pros.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeListItem('pros', index)}
                                    className="text-slate-500 hover:text-red-400 transition"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => addListItem('pros')}
                        className="text-sm text-green-400 hover:text-green-300 transition"
                    >
                        <i className="fas fa-plus mr-1"></i> Voeg pluspunt toe
                    </button>
                </div>
                
                {/* Cons */}
                <div>
                    <label className="block text-sm font-medium text-red-400 mb-2">
                        <i className="fas fa-minus-circle mr-1"></i> Minpunten
                    </label>
                    {formData.cons.map((con, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={con}
                                onChange={(e) => updateListItem('cons', index, e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 transition text-sm"
                                placeholder="Minpunt"
                            />
                            {formData.cons.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeListItem('cons', index)}
                                    className="text-slate-500 hover:text-red-400 transition"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => addListItem('cons')}
                        className="text-sm text-red-400 hover:text-red-300 transition"
                    >
                        <i className="fas fa-plus mr-1"></i> Voeg minpunt toe
                    </button>
                </div>
            </div>
            
            {/* Submit */}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                        <>
                            <i className="fas fa-paper-plane"></i>
                            Plaats review
                        </>
                    )}
                </button>
                
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-3 rounded-xl transition"
                    >
                        Annuleren
                    </button>
                )}
            </div>
        </form>
    );
};

interface ProductReviewsProps {
    productId: string;
    className?: string;
}

export const ProductReviews: React.FC<ProductReviewsProps> = ({
    productId,
    className = ''
}) => {
    const enabled = useFeature('product_reviews');
    const { settings } = useFeatureToggle('product_reviews');
    const { type: templateType } = useTemplate();
    
    const [allReviews, setAllReviews] = useState<ProductReview[]>(() => loadProductReviews());
    const [showForm, setShowForm] = useState(false);
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful'>('newest');
    const [filterRating, setFilterRating] = useState<number | null>(null);

    // Filter reviews for this product
    const productReviews = useMemo(() => {
        let reviews = allReviews.filter(r => r.productId === productId && r.isApproved);
        
        if (filterRating !== null) {
            reviews = reviews.filter(r => r.rating === filterRating);
        }
        
        switch (sortBy) {
            case 'oldest':
                reviews.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'highest':
                reviews.sort((a, b) => b.rating - a.rating);
                break;
            case 'lowest':
                reviews.sort((a, b) => a.rating - b.rating);
                break;
            case 'helpful':
                reviews.sort((a, b) => b.helpful - a.helpful);
                break;
            case 'newest':
            default:
                reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }
        
        return reviews;
    }, [allReviews, productId, sortBy, filterRating]);

    // Calculate stats
    const stats = useMemo(() => {
        const reviews = allReviews.filter(r => r.productId === productId && r.isApproved);
        const total = reviews.length;
        const avgRating = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
        const distribution = [5, 4, 3, 2, 1].map(rating => ({
            rating,
            count: reviews.filter(r => r.rating === rating).length,
            percentage: total > 0 ? (reviews.filter(r => r.rating === rating).length / total) * 100 : 0
        }));
        
        return { total, avgRating, distribution };
    }, [allReviews, productId]);

    const handleAddReview = useCallback((reviewData: Omit<ProductReview, 'id' | 'createdAt' | 'helpful' | 'notHelpful' | 'isApproved' | 'verified'>) => {
        const newReview: ProductReview = {
            ...reviewData,
            id: `review-${Date.now()}`,
            createdAt: new Date().toISOString(),
            helpful: 0,
            notHelpful: 0,
            isApproved: true,
            verified: false
        };
        
        const updatedReviews = [...allReviews, newReview];
        setAllReviews(updatedReviews);
        saveProductReviews(updatedReviews);
        setShowForm(false);
    }, [allReviews]);

    const handleHelpful = useCallback((reviewId: string, helpful: boolean) => {
        const userHelpful = getUserHelpful();
        if (userHelpful[reviewId] !== undefined) return; // Already voted
        
        setAllReviews(prev => {
            const updated = prev.map(r => {
                if (r.id !== reviewId) return r;
                return {
                    ...r,
                    helpful: helpful ? r.helpful + 1 : r.helpful,
                    notHelpful: helpful ? r.notHelpful : r.notHelpful + 1
                };
            });
            
            saveProductReviews(updated);
            saveUserHelpful(reviewId, helpful);
            return updated;
        });
    }, []);

    if (!enabled) return null;

    return (
        <div className={`${className}`}>
            {/* Header with stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Average rating */}
                    <div className="text-center md:text-left">
                        <div className="text-5xl font-bold text-white mb-2">
                            {stats.avgRating.toFixed(1)}
                        </div>
                        <StarRating rating={stats.avgRating} size="lg" />
                        <div className="text-sm text-slate-500 mt-2">
                            Gebaseerd op {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
                        </div>
                    </div>
                    
                    {/* Rating distribution */}
                    <div className="flex-1">
                        {stats.distribution.map(({ rating, count, percentage }) => (
                            <button
                                key={rating}
                                onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                                className={`flex items-center gap-2 w-full mb-2 group ${
                                    filterRating === rating ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                                }`}
                            >
                                <span className="text-sm text-slate-400 w-16">{rating} ster{rating !== 1 ? 'ren' : ''}</span>
                                <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full ${filterRating === rating ? 'bg-blue-500' : 'bg-yellow-400'} transition-all`}
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm text-slate-500 w-8">{count}</span>
                            </button>
                        ))}
                    </div>
                    
                    {/* Write review button */}
                    <div>
                        <button
                            onClick={() => setShowForm(!showForm)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition flex items-center gap-2"
                        >
                            <i className="fas fa-pen"></i>
                            Schrijf een review
                        </button>
                    </div>
                </div>
            </div>

            {/* Review form */}
            {showForm && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
                    <ReviewForm 
                        productId={productId} 
                        onSubmit={handleAddReview}
                        onCancel={() => setShowForm(false)}
                    />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                <h3 className="text-lg font-bold text-white">
                    Reviews ({productReviews.length})
                </h3>
                
                <div className="ml-auto">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="newest">Nieuwste eerst</option>
                        <option value="oldest">Oudste eerst</option>
                        <option value="highest">Hoogste score</option>
                        <option value="lowest">Laagste score</option>
                        <option value="helpful">Meest behulpzaam</option>
                    </select>
                </div>
                
                {filterRating !== null && (
                    <button
                        onClick={() => setFilterRating(null)}
                        className="text-sm text-blue-400 hover:text-blue-300 transition"
                    >
                        <i className="fas fa-times mr-1"></i>
                        Filter wissen
                    </button>
                )}
            </div>

            {/* Reviews list */}
            {productReviews.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                    <i className="fas fa-star text-4xl text-slate-600 mb-4"></i>
                    <h3 className="text-lg font-bold text-white mb-2">Nog geen reviews</h3>
                    <p className="text-slate-400 mb-4">Wees de eerste om dit product te reviewen!</p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition"
                    >
                        Schrijf een review
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {productReviews.map(review => {
                        const userHelpful = getUserHelpful();
                        const hasVoted = userHelpful[review.id] !== undefined;
                        
                        return (
                            <div key={review.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-bold text-white">{review.author}</span>
                                            {review.verified && (
                                                <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                                                    <i className="fas fa-check-circle"></i>
                                                    Geverifieerde aankoop
                                                </span>
                                            )}
                                        </div>
                                        <StarRating rating={review.rating} size="sm" />
                                    </div>
                                    <span className="text-sm text-slate-500">
                                        {new Date(review.createdAt).toLocaleDateString('nl-NL')}
                                    </span>
                                </div>
                                
                                {/* Title and content */}
                                <h4 className="font-bold text-white mb-2">{review.title}</h4>
                                <p className="text-slate-300 mb-4">{review.content}</p>
                                
                                {/* Pros and cons */}
                                {((review.pros && review.pros.length > 0) || (review.cons && review.cons.length > 0)) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {review.pros && review.pros.length > 0 && (
                                            <div>
                                                <div className="text-sm font-medium text-green-400 mb-1">Pluspunten</div>
                                                <ul className="space-y-1">
                                                    {review.pros.map((pro, i) => (
                                                        <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                                            <i className="fas fa-plus text-green-400 mt-1"></i>
                                                            {pro}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        
                                        {review.cons && review.cons.length > 0 && (
                                            <div>
                                                <div className="text-sm font-medium text-red-400 mb-1">Minpunten</div>
                                                <ul className="space-y-1">
                                                    {review.cons.map((con, i) => (
                                                        <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                                            <i className="fas fa-minus text-red-400 mt-1"></i>
                                                            {con}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Helpful */}
                                <div className="flex items-center gap-4 pt-3 border-t border-slate-800">
                                    <span className="text-sm text-slate-500">Was deze review behulpzaam?</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => !hasVoted && handleHelpful(review.id, true)}
                                            disabled={hasVoted}
                                            className={`text-sm px-3 py-1 rounded transition ${
                                                hasVoted 
                                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                                    : 'bg-slate-800 text-slate-400 hover:bg-green-600/20 hover:text-green-400'
                                            }`}
                                        >
                                            <i className="fas fa-thumbs-up mr-1"></i>
                                            Ja ({review.helpful})
                                        </button>
                                        <button
                                            onClick={() => !hasVoted && handleHelpful(review.id, false)}
                                            disabled={hasVoted}
                                            className={`text-sm px-3 py-1 rounded transition ${
                                                hasVoted 
                                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                                                    : 'bg-slate-800 text-slate-400 hover:bg-red-600/20 hover:text-red-400'
                                            }`}
                                        >
                                            <i className="fas fa-thumbs-down mr-1"></i>
                                            Nee ({review.notHelpful})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ProductReviews;

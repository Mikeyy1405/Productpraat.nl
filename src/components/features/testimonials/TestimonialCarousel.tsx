/**
 * Testimonials Components
 * 
 * Testimonial carousel and grid for displaying customer reviews.
 * Only renders when the 'testimonials' feature is enabled.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface Testimonial {
    id: string;
    name: string;
    role?: string;
    company?: string;
    content: string;
    rating: number; // 1-5
    avatar?: string;
    date?: string;
}

const STORAGE_KEY = 'writgo_testimonials_data';

// Load testimonials from localStorage
const loadTestimonials = (): Testimonial[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save testimonials to localStorage
export const saveTestimonials = (testimonials: Testimonial[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testimonials));
};

// Helper function to format role and company display
const formatRoleAndCompany = (role?: string, company?: string): string => {
    if (role && company) {
        return `${role} bij ${company}`;
    }
    return role || company || '';
};

interface TestimonialCardProps {
    testimonial: Testimonial;
    className?: string;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
    testimonial,
    className = ''
}) => {
    const renderStars = (rating: number) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                    <i
                        key={star}
                        className={`fas fa-star text-sm ${
                            star <= rating ? 'text-yellow-400' : 'text-slate-600'
                        }`}
                    ></i>
                ))}
            </div>
        );
    };

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
            {/* Quote icon */}
            <div className="mb-4">
                <i className="fas fa-quote-left text-2xl text-blue-600/50"></i>
            </div>
            
            {/* Rating */}
            <div className="mb-4">
                {renderStars(testimonial.rating)}
            </div>
            
            {/* Content */}
            <p className="text-slate-300 mb-6 leading-relaxed italic">
                "{testimonial.content}"
            </p>
            
            {/* Author */}
            <div className="flex items-center gap-3">
                {testimonial.avatar ? (
                    <img 
                        src={testimonial.avatar} 
                        alt={testimonial.name}
                        className="w-12 h-12 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                            {testimonial.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                <div>
                    <div className="font-bold text-white">{testimonial.name}</div>
                    {(testimonial.role || testimonial.company) && (
                        <div className="text-sm text-slate-500">
                            {formatRoleAndCompany(testimonial.role, testimonial.company)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface TestimonialCarouselProps {
    testimonials?: Testimonial[];
    title?: string;
    autoPlay?: boolean;
    autoPlayInterval?: number;
    className?: string;
}

export const TestimonialCarousel: React.FC<TestimonialCarouselProps> = ({
    testimonials: propTestimonials,
    title = 'Wat onze klanten zeggen',
    autoPlay = true,
    autoPlayInterval = 5000,
    className = ''
}) => {
    const enabled = useFeature('testimonials');
    const { settings } = useFeatureToggle('testimonials');
    const { type: templateType } = useTemplate();
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);
    
    // Use prop testimonials or load from storage
    const storedTestimonials = loadTestimonials();
    const allTestimonials = propTestimonials || storedTestimonials;

    const goTo = useCallback((index: number) => {
        if (index < 0) {
            setCurrentIndex(allTestimonials.length - 1);
        } else if (index >= allTestimonials.length) {
            setCurrentIndex(0);
        } else {
            setCurrentIndex(index);
        }
    }, [allTestimonials.length]);

    const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
    const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

    // Auto-play
    useEffect(() => {
        if (!isAutoPlaying || allTestimonials.length <= 1) return;
        
        const timer = setInterval(goNext, autoPlayInterval);
        return () => clearInterval(timer);
    }, [isAutoPlaying, goNext, autoPlayInterval, allTestimonials.length]);

    if (!enabled) return null;

    // Empty state
    if (allTestimonials.length === 0) {
        return (
            <div className={`bg-slate-900 border border-slate-800 rounded-xl p-8 text-center ${className}`}>
                <i className="fas fa-quote-right text-4xl text-slate-600 mb-4"></i>
                <h3 className="text-xl font-bold text-white mb-2">Nog geen testimonials</h3>
                <p className="text-slate-400">
                    Voeg klantbeoordelingen toe via het admin dashboard.
                </p>
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white">{title}</h2>
            </div>

            {/* Carousel */}
            <div 
                className="relative"
                onMouseEnter={() => setIsAutoPlaying(false)}
                onMouseLeave={() => setIsAutoPlaying(autoPlay)}
            >
                {/* Main content */}
                <div className="overflow-hidden">
                    <div 
                        className="flex transition-transform duration-500 ease-out"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {allTestimonials.map((testimonial) => (
                            <div 
                                key={testimonial.id}
                                className="w-full flex-shrink-0 px-4"
                            >
                                <TestimonialCard testimonial={testimonial} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation arrows */}
                {allTestimonials.length > 1 && (
                    <>
                        <button
                            onClick={goPrev}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition flex items-center justify-center"
                            aria-label="Vorige testimonial"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <button
                            onClick={goNext}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 transition flex items-center justify-center"
                            aria-label="Volgende testimonial"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </>
                )}

                {/* Dots */}
                {allTestimonials.length > 1 && (
                    <div className="flex justify-center gap-2 mt-6">
                        {allTestimonials.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goTo(index)}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                    index === currentIndex 
                                        ? 'bg-blue-500 w-6' 
                                        : 'bg-slate-600 hover:bg-slate-500'
                                }`}
                                aria-label={`Ga naar testimonial ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

interface TestimonialGridProps {
    testimonials?: Testimonial[];
    title?: string;
    columns?: 2 | 3 | 4;
    className?: string;
}

export const TestimonialGrid: React.FC<TestimonialGridProps> = ({
    testimonials: propTestimonials,
    title = 'Wat onze klanten zeggen',
    columns = 3,
    className = ''
}) => {
    const enabled = useFeature('testimonials');
    
    const storedTestimonials = loadTestimonials();
    const allTestimonials = propTestimonials || storedTestimonials;

    if (!enabled) return null;

    if (allTestimonials.length === 0) {
        return (
            <div className={`bg-slate-900 border border-slate-800 rounded-xl p-8 text-center ${className}`}>
                <i className="fas fa-quote-right text-4xl text-slate-600 mb-4"></i>
                <h3 className="text-xl font-bold text-white mb-2">Nog geen testimonials</h3>
                <p className="text-slate-400">
                    Voeg klantbeoordelingen toe via het admin dashboard.
                </p>
            </div>
        );
    }

    const gridCols = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-2 lg:grid-cols-3',
        4: 'md:grid-cols-2 lg:grid-cols-4',
    };

    return (
        <div className={`${className}`}>
            {title && (
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                </div>
            )}
            
            <div className={`grid grid-cols-1 ${gridCols[columns]} gap-6`}>
                {allTestimonials.map(testimonial => (
                    <TestimonialCard 
                        key={testimonial.id} 
                        testimonial={testimonial} 
                    />
                ))}
            </div>
        </div>
    );
};

export default TestimonialCarousel;

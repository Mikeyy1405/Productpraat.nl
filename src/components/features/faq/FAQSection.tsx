/**
 * FAQSection Component
 * 
 * Accordion-style FAQ section with search functionality.
 * Only renders when the 'faq_section' feature is enabled.
 */

import React, { useState, useMemo } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category?: string;
    order?: number;
}

interface FAQSectionProps {
    faqs?: FAQItem[];
    title?: string;
    showSearch?: boolean;
    showCategories?: boolean;
    className?: string;
}

const STORAGE_KEY = 'writgo_faq_data';

// Load FAQs from localStorage
const loadFAQs = (): FAQItem[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save FAQs to localStorage
const saveFAQs = (faqs: FAQItem[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(faqs));
};

export const FAQSection: React.FC<FAQSectionProps> = ({
    faqs: propFaqs,
    title = 'Veelgestelde Vragen',
    showSearch = true,
    showCategories = true,
    className = ''
}) => {
    const enabled = useFeature('faq_section');
    const { settings } = useFeatureToggle('faq_section');
    const { type: templateType } = useTemplate();
    
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    
    // Use prop FAQs or load from storage
    const storedFaqs = useMemo(() => loadFAQs(), []);
    const allFaqs = propFaqs || storedFaqs;

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(allFaqs.map(faq => faq.category || 'Algemeen'));
        return ['all', ...Array.from(cats)];
    }, [allFaqs]);

    // Filter FAQs
    const filteredFaqs = useMemo(() => {
        let filtered = allFaqs;
        
        // Filter by category
        if (activeCategory !== 'all') {
            filtered = filtered.filter(faq => (faq.category || 'Algemeen') === activeCategory);
        }
        
        // Filter by search term
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(faq => 
                faq.question.toLowerCase().includes(lower) ||
                faq.answer.toLowerCase().includes(lower)
            );
        }
        
        // Sort by order
        return [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [allFaqs, activeCategory, searchTerm]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const expandAll = () => {
        setExpandedIds(new Set(filteredFaqs.map(f => f.id)));
    };

    const collapseAll = () => {
        setExpandedIds(new Set());
    };

    if (!enabled) return null;

    // Empty state when no FAQs exist
    if (allFaqs.length === 0) {
        return (
            <div className={`bg-slate-900 border border-slate-800 rounded-xl p-8 text-center ${className}`}>
                <i className="fas fa-question-circle text-4xl text-slate-600 mb-4"></i>
                <h3 className="text-xl font-bold text-white mb-2">Nog geen FAQs</h3>
                <p className="text-slate-400">
                    Voeg veelgestelde vragen toe via het admin dashboard.
                </p>
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
            </div>

            {/* Search and controls */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
                {showSearch && (
                    <div className="relative flex-1 min-w-[200px]">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Zoek in FAQs..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
                        />
                        <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    </div>
                )}
                
                <div className="flex gap-2">
                    <button
                        onClick={expandAll}
                        className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition text-sm"
                    >
                        <i className="fas fa-chevron-down mr-1"></i> Alles openen
                    </button>
                    <button
                        onClick={collapseAll}
                        className="px-4 py-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition text-sm"
                    >
                        <i className="fas fa-chevron-up mr-1"></i> Alles sluiten
                    </button>
                </div>
            </div>

            {/* Category filter */}
            {showCategories && categories.length > 2 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                                activeCategory === cat
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {cat === 'all' ? 'Alle categorieën' : cat}
                        </button>
                    ))}
                </div>
            )}

            {/* FAQ items */}
            {filteredFaqs.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                    <p className="text-slate-400">Geen FAQs gevonden voor deze zoekopdracht.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredFaqs.map((faq) => {
                        const isExpanded = expandedIds.has(faq.id);
                        
                        return (
                            <div
                                key={faq.id}
                                className={`bg-slate-900 border rounded-xl overflow-hidden transition-all duration-300 ${
                                    isExpanded ? 'border-blue-500/50' : 'border-slate-800'
                                }`}
                            >
                                <button
                                    onClick={() => toggleExpand(faq.id)}
                                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition"
                                    aria-expanded={isExpanded}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            isExpanded ? 'bg-blue-600' : 'bg-slate-800'
                                        }`}>
                                            <i className={`fas fa-${isExpanded ? 'minus' : 'plus'} text-sm ${
                                                isExpanded ? 'text-white' : 'text-slate-400'
                                            }`}></i>
                                        </div>
                                        <span className={`font-medium ${isExpanded ? 'text-white' : 'text-slate-300'}`}>
                                            {faq.question}
                                        </span>
                                    </div>
                                    {faq.category && (
                                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded ml-2 flex-shrink-0">
                                            {faq.category}
                                        </span>
                                    )}
                                </button>
                                
                                {/* Answer */}
                                <div className={`overflow-hidden transition-all duration-300 ${
                                    isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                                }`}>
                                    <div className="px-4 pb-4 pt-0 pl-[60px]">
                                        <div className="text-slate-400 leading-relaxed whitespace-pre-wrap">
                                            {faq.answer}
                                        </div>
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

export default FAQSection;

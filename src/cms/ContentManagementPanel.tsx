/**
 * Content Management Panel
 * 
 * Admin interface for managing CMS content:
 * - Blog posts
 * - FAQs
 * - Testimonials
 * - Contact form submissions
 * - Newsletter subscribers
 * - Analytics dashboard
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useFeature, useFeatureToggle } from '../cms';
import { 
    loadBlogPosts, 
    saveBlogPosts,
    loadContactSubmissions,
    loadNewsletterSubscribers,
    loadAnalyticsData,
    AnalyticsDashboard
} from '../components/features';

// Import types
import type { BlogPost } from '../components/features/blog';
import type { FAQItem } from '../components/features/faq';
import type { Testimonial } from '../components/features/testimonials';

const FAQ_STORAGE_KEY = 'writgo_faq_data';
const TESTIMONIALS_STORAGE_KEY = 'writgo_testimonials_data';

// Load FAQs
const loadFAQs = (): FAQItem[] => {
    try {
        const data = localStorage.getItem(FAQ_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save FAQs
const saveFAQs = (faqs: FAQItem[]): void => {
    localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(faqs));
};

// Load testimonials
const loadTestimonials = (): Testimonial[] => {
    try {
        const data = localStorage.getItem(TESTIMONIALS_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save testimonials
const saveTestimonials = (testimonials: Testimonial[]): void => {
    localStorage.setItem(TESTIMONIALS_STORAGE_KEY, JSON.stringify(testimonials));
};

/**
 * Generate a URL-friendly slug from a title.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 */
const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
};

type ContentTab = 'blog' | 'faq' | 'testimonials' | 'contact' | 'newsletter' | 'analytics';

interface ContentManagementPanelProps {
    className?: string;
}

export const ContentManagementPanel: React.FC<ContentManagementPanelProps> = ({
    className = ''
}) => {
    const [activeTab, setActiveTab] = useState<ContentTab>('blog');
    
    const blogEnabled = useFeature('blog_posts');
    const faqEnabled = useFeature('faq_section');
    const testimonialsEnabled = useFeature('testimonials');
    const contactEnabled = useFeature('contact_form');
    const newsletterEnabled = useFeature('newsletter');
    const analyticsEnabled = useFeature('analytics');

    const tabs: { id: ContentTab; label: string; icon: string; enabled: boolean }[] = [
        { id: 'blog', label: 'Blog Posts', icon: 'fa-pen-fancy', enabled: blogEnabled },
        { id: 'faq', label: 'FAQ', icon: 'fa-question-circle', enabled: faqEnabled },
        { id: 'testimonials', label: 'Testimonials', icon: 'fa-quote-right', enabled: testimonialsEnabled },
        { id: 'contact', label: 'Contactformulier', icon: 'fa-envelope', enabled: contactEnabled },
        { id: 'newsletter', label: 'Newsletter', icon: 'fa-newspaper', enabled: newsletterEnabled },
        { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line', enabled: analyticsEnabled },
    ];

    const enabledTabs = tabs.filter(t => t.enabled);

    return (
        <div className={`${className}`}>
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
                {enabledTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition ${
                            activeTab === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        <i className={`fas ${tab.icon}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {enabledTabs.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                    <i className="fas fa-info-circle text-4xl text-slate-600 mb-4"></i>
                    <h3 className="text-xl font-bold text-white mb-2">Geen content features ingeschakeld</h3>
                    <p className="text-slate-400">Schakel content features in via de Features tab om content te beheren.</p>
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'blog' && blogEnabled && <BlogManager />}
            {activeTab === 'faq' && faqEnabled && <FAQManager />}
            {activeTab === 'testimonials' && testimonialsEnabled && <TestimonialsManager />}
            {activeTab === 'contact' && contactEnabled && <ContactSubmissionsViewer />}
            {activeTab === 'newsletter' && newsletterEnabled && <NewsletterManager />}
            {activeTab === 'analytics' && analyticsEnabled && <AnalyticsDashboard />}
        </div>
    );
};

// Blog Manager Component
const BlogManager: React.FC = () => {
    const [posts, setPosts] = useState<BlogPost[]>(() => loadBlogPosts());
    const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleSave = useCallback((post: BlogPost) => {
        const updated = editingPost
            ? posts.map(p => p.id === post.id ? post : p)
            : [...posts, { ...post, id: `post-${Date.now()}` }];
        
        setPosts(updated);
        saveBlogPosts(updated);
        setEditingPost(null);
        setIsCreating(false);
    }, [posts, editingPost]);

    const handleDelete = useCallback((id: string) => {
        if (confirm('Weet je zeker dat je dit artikel wilt verwijderen?')) {
            const updated = posts.filter(p => p.id !== id);
            setPosts(updated);
            saveBlogPosts(updated);
        }
    }, [posts]);

    if (isCreating || editingPost) {
        return (
            <BlogPostEditor
                post={editingPost || undefined}
                onSave={handleSave}
                onCancel={() => {
                    setEditingPost(null);
                    setIsCreating(false);
                }}
            />
        );
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Blog Posts ({posts.length})</h3>
                <button
                    onClick={() => setIsCreating(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                >
                    <i className="fas fa-plus"></i>
                    Nieuw artikel
                </button>
            </div>

            {posts.length === 0 ? (
                <div className="text-center py-8">
                    <i className="fas fa-pen-fancy text-4xl text-slate-600 mb-4"></i>
                    <p className="text-slate-400">Nog geen blog posts. Klik op "Nieuw artikel" om te beginnen.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map(post => (
                        <div key={post.id} className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
                            {post.featuredImage && (
                                <img src={post.featuredImage} alt="" className="w-16 h-16 rounded object-cover" />
                            )}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white truncate">{post.title}</h4>
                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                        post.status === 'published' ? 'bg-green-600/20 text-green-400' : 'bg-orange-600/20 text-orange-400'
                                    }`}>
                                        {post.status === 'published' ? 'Gepubliceerd' : 'Concept'}
                                    </span>
                                    <span>{new Date(post.publishedAt).toLocaleDateString('nl-NL')}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingPost(post)}
                                    className="p-2 text-slate-400 hover:text-white transition"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    onClick={() => handleDelete(post.id)}
                                    className="p-2 text-slate-400 hover:text-red-400 transition"
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Blog Post Editor
interface BlogPostEditorProps {
    post?: BlogPost;
    onSave: (post: BlogPost) => void;
    onCancel: () => void;
}

const BlogPostEditor: React.FC<BlogPostEditorProps> = ({ post, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<BlogPost>>(post || {
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        featuredImage: '',
        category: '',
        tags: [],
        author: { name: 'Admin' },
        status: 'draft',
        publishedAt: new Date().toISOString()
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const slug = formData.slug || generateSlug(formData.title || '');
        
        onSave({
            id: post?.id || '',
            title: formData.title || '',
            slug,
            content: formData.content || '',
            excerpt: formData.excerpt,
            featuredImage: formData.featuredImage,
            category: formData.category,
            tags: formData.tags,
            author: formData.author || { name: 'Admin' },
            status: formData.status || 'draft',
            publishedAt: formData.publishedAt || new Date().toISOString(),
            readingTime: Math.ceil((formData.content || '').split(/\s+/).length / 200)
        });
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-6">
                {post ? 'Artikel bewerken' : 'Nieuw artikel'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Titel *</label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Categorie</label>
                        <input
                            type="text"
                            value={formData.category || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'draft' | 'published' }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="draft">Concept</option>
                            <option value="published">Gepubliceerd</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Samenvatting</label>
                    <textarea
                        value={formData.excerpt || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Afbeelding URL</label>
                    <input
                        type="url"
                        value={formData.featuredImage || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, featuredImage: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                        placeholder="https://..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Inhoud (HTML) *</label>
                    <textarea
                        value={formData.content || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        rows={10}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 resize-none font-mono text-sm"
                        required
                    />
                </div>

                <div className="flex gap-2 pt-4">
                    <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
                    >
                        {post ? 'Opslaan' : 'Aanmaken'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-3 rounded-lg transition"
                    >
                        Annuleren
                    </button>
                </div>
            </form>
        </div>
    );
};

// FAQ Manager
const FAQManager: React.FC = () => {
    const [faqs, setFaqs] = useState<FAQItem[]>(() => loadFAQs());
    const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({ question: '', answer: '', category: '' });

    const handleSave = useCallback(() => {
        if (!formData.question || !formData.answer) return;
        
        const newFaq: FAQItem = {
            id: editingFaq?.id || `faq-${Date.now()}`,
            question: formData.question,
            answer: formData.answer,
            category: formData.category || undefined,
            order: editingFaq?.order || faqs.length
        };
        
        const updated = editingFaq
            ? faqs.map(f => f.id === newFaq.id ? newFaq : f)
            : [...faqs, newFaq];
        
        setFaqs(updated);
        saveFAQs(updated);
        setEditingFaq(null);
        setIsCreating(false);
        setFormData({ question: '', answer: '', category: '' });
    }, [faqs, editingFaq, formData]);

    const handleEdit = (faq: FAQItem) => {
        setEditingFaq(faq);
        setFormData({ question: faq.question, answer: faq.answer, category: faq.category || '' });
        setIsCreating(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Weet je zeker dat je deze FAQ wilt verwijderen?')) {
            const updated = faqs.filter(f => f.id !== id);
            setFaqs(updated);
            saveFAQs(updated);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">FAQs ({faqs.length})</h3>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Nieuwe FAQ
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-slate-800 rounded-lg p-4 mb-6">
                    <h4 className="font-bold text-white mb-4">{editingFaq ? 'FAQ bewerken' : 'Nieuwe FAQ'}</h4>
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={formData.question}
                            onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                            placeholder="Vraag"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                        />
                        <textarea
                            value={formData.answer}
                            onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                            placeholder="Antwoord"
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 resize-none"
                        />
                        <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="Categorie (optioneel)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSave}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition"
                            >
                                Opslaan
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingFaq(null);
                                    setFormData({ question: '', answer: '', category: '' });
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-400 py-2 rounded-lg transition"
                            >
                                Annuleren
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {faqs.length === 0 && !isCreating ? (
                <div className="text-center py-8">
                    <i className="fas fa-question-circle text-4xl text-slate-600 mb-4"></i>
                    <p className="text-slate-400">Nog geen FAQs. Voeg er een toe!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {faqs.map(faq => (
                        <div key={faq.id} className="flex items-start gap-4 p-4 bg-slate-800 rounded-lg">
                            <div className="flex-1">
                                <h4 className="font-bold text-white">{faq.question}</h4>
                                <p className="text-slate-400 text-sm mt-1 line-clamp-2">{faq.answer}</p>
                                {faq.category && (
                                    <span className="text-xs text-blue-400 mt-2 inline-block">{faq.category}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(faq)} className="p-2 text-slate-400 hover:text-white transition">
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button onClick={() => handleDelete(faq.id)} className="p-2 text-slate-400 hover:text-red-400 transition">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Testimonials Manager
const TestimonialsManager: React.FC = () => {
    const [testimonials, setTestimonials] = useState<Testimonial[]>(() => loadTestimonials());
    const [isCreating, setIsCreating] = useState(false);
    const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
    const [formData, setFormData] = useState({ name: '', role: '', company: '', content: '', rating: 5, avatar: '' });

    const handleSave = useCallback(() => {
        if (!formData.name || !formData.content) return;
        
        const newTestimonial: Testimonial = {
            id: editingItem?.id || `testimonial-${Date.now()}`,
            name: formData.name,
            role: formData.role || undefined,
            company: formData.company || undefined,
            content: formData.content,
            rating: formData.rating,
            avatar: formData.avatar || undefined,
            date: new Date().toISOString()
        };
        
        const updated = editingItem
            ? testimonials.map(t => t.id === newTestimonial.id ? newTestimonial : t)
            : [...testimonials, newTestimonial];
        
        setTestimonials(updated);
        saveTestimonials(updated);
        setEditingItem(null);
        setIsCreating(false);
        setFormData({ name: '', role: '', company: '', content: '', rating: 5, avatar: '' });
    }, [testimonials, editingItem, formData]);

    const handleEdit = (item: Testimonial) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            role: item.role || '',
            company: item.company || '',
            content: item.content,
            rating: item.rating,
            avatar: item.avatar || ''
        });
        setIsCreating(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Weet je zeker dat je deze testimonial wilt verwijderen?')) {
            const updated = testimonials.filter(t => t.id !== id);
            setTestimonials(updated);
            saveTestimonials(updated);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Testimonials ({testimonials.length})</h3>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                    >
                        <i className="fas fa-plus"></i>
                        Nieuwe testimonial
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="bg-slate-800 rounded-lg p-4 mb-6">
                    <h4 className="font-bold text-white mb-4">{editingItem ? 'Testimonial bewerken' : 'Nieuwe testimonial'}</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Naam *"
                                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                            />
                            <input
                                type="text"
                                value={formData.role}
                                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                                placeholder="Functie"
                                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                            />
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                                placeholder="Bedrijf"
                                className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
                            />
                        </div>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Testimonial tekst *"
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 resize-none"
                        />
                        <div className="flex items-center gap-4">
                            <label className="text-slate-400">Beoordeling:</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                                        className="text-xl"
                                    >
                                        <i className={`${formData.rating >= star ? 'fas' : 'far'} fa-star text-yellow-400`}></i>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition">
                                Opslaan
                            </button>
                            <button
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingItem(null);
                                    setFormData({ name: '', role: '', company: '', content: '', rating: 5, avatar: '' });
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-400 py-2 rounded-lg transition"
                            >
                                Annuleren
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {testimonials.length === 0 && !isCreating ? (
                <div className="text-center py-8">
                    <i className="fas fa-quote-right text-4xl text-slate-600 mb-4"></i>
                    <p className="text-slate-400">Nog geen testimonials. Voeg er een toe!</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {testimonials.map(item => (
                        <div key={item.id} className="flex items-start gap-4 p-4 bg-slate-800 rounded-lg">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-white">{item.name}</span>
                                    {item.role && <span className="text-slate-500">• {item.role}</span>}
                                </div>
                                <p className="text-slate-400 text-sm line-clamp-2">{item.content}</p>
                                <div className="flex gap-0.5 mt-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <i key={star} className={`fas fa-star text-xs ${item.rating >= star ? 'text-yellow-400' : 'text-slate-600'}`}></i>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-white transition">
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-400 transition">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Contact Submissions Viewer
const ContactSubmissionsViewer: React.FC = () => {
    const [submissions] = useState(() => loadContactSubmissions());
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-6">Contactformulier inzendingen ({submissions.length})</h3>

            {submissions.length === 0 ? (
                <div className="text-center py-8">
                    <i className="fas fa-envelope text-4xl text-slate-600 mb-4"></i>
                    <p className="text-slate-400">Nog geen inzendingen ontvangen.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {submissions.map((sub: any) => (
                        <div
                            key={sub.id}
                            onClick={() => setSelectedSubmission(selectedSubmission?.id === sub.id ? null : sub)}
                            className={`p-4 rounded-lg cursor-pointer transition ${
                                selectedSubmission?.id === sub.id ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-slate-800 hover:bg-slate-750'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-white">{sub.name}</div>
                                    <div className="text-sm text-slate-400">{sub.email}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-slate-500">{new Date(sub.submittedAt).toLocaleDateString('nl-NL')}</div>
                                    <span className={`text-xs px-2 py-0.5 rounded ${sub.read ? 'bg-slate-700 text-slate-400' : 'bg-blue-600/20 text-blue-400'}`}>
                                        {sub.read ? 'Gelezen' : 'Nieuw'}
                                    </span>
                                </div>
                            </div>
                            {selectedSubmission?.id === sub.id && (
                                <div className="mt-4 pt-4 border-t border-slate-700">
                                    <div className="text-sm text-slate-400 mb-2"><strong>Onderwerp:</strong> {sub.subject}</div>
                                    <div className="text-slate-300 whitespace-pre-wrap">{sub.message}</div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Newsletter Manager
const NewsletterManager: React.FC = () => {
    const [subscribers] = useState(() => loadNewsletterSubscribers());
    const activeSubscribers = subscribers.filter((s: any) => !s.unsubscribed);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Newsletter abonnees</h3>
                <div className="flex items-center gap-4">
                    <span className="text-slate-400">{activeSubscribers.length} actief</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">{subscribers.length - activeSubscribers.length} uitgeschreven</span>
                </div>
            </div>

            {subscribers.length === 0 ? (
                <div className="text-center py-8">
                    <i className="fas fa-newspaper text-4xl text-slate-600 mb-4"></i>
                    <p className="text-slate-400">Nog geen nieuwsbrief abonnees.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-800">
                                <th className="text-left py-2 px-3">E-mail</th>
                                <th className="text-left py-2 px-3">Aangemeld op</th>
                                <th className="text-left py-2 px-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscribers.map((sub: any) => (
                                <tr key={sub.id} className="border-b border-slate-800/50">
                                    <td className="py-2 px-3 text-white">{sub.email}</td>
                                    <td className="py-2 px-3 text-slate-400">
                                        {new Date(sub.subscribedAt).toLocaleDateString('nl-NL')}
                                    </td>
                                    <td className="py-2 px-3">
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            sub.unsubscribed ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'
                                        }`}>
                                            {sub.unsubscribed ? 'Uitgeschreven' : 'Actief'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ContentManagementPanel;

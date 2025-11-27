/**
 * Blog Components
 * 
 * Blog grid, post display, and editor components.
 * Only renders when the 'blog_posts' feature is enabled.
 */

import React, { useState, useMemo } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    featuredImage?: string;
    author: {
        name: string;
        avatar?: string;
    };
    category?: string;
    tags?: string[];
    publishedAt: string;
    updatedAt?: string;
    readingTime?: number;
    status: 'draft' | 'published';
}

const STORAGE_KEY = 'writgo_blog_posts';

// Load blog posts from localStorage
export const loadBlogPosts = (): BlogPost[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save blog posts
export const saveBlogPosts = (posts: BlogPost[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
};

/**
 * Calculate estimated reading time from HTML content.
 * Uses DOM parser for safe HTML stripping when available.
 */
const calculateReadingTime = (content: string): number => {
    let text = content;
    
    // Use DOM parser if available for safe HTML stripping
    if (typeof DOMParser !== 'undefined') {
        try {
            const doc = new DOMParser().parseFromString(content, 'text/html');
            text = doc.body.textContent || '';
        } catch {
            // Fallback: count words ignoring obvious tags
            text = content;
        }
    }
    
    const wordCount = text.split(/\s+/).filter(w => w.length > 0 && !w.startsWith('<')).length;
    return Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute
};

interface BlogGridProps {
    posts?: BlogPost[];
    columns?: 2 | 3 | 4;
    showExcerpt?: boolean;
    showAuthor?: boolean;
    showTags?: boolean;
    onPostClick?: (post: BlogPost) => void;
    className?: string;
}

export const BlogGrid: React.FC<BlogGridProps> = ({
    posts: propPosts,
    columns = 3,
    showExcerpt = true,
    showAuthor = true,
    showTags = true,
    onPostClick,
    className = ''
}) => {
    const enabled = useFeature('blog_posts');
    const { settings } = useFeatureToggle('blog_posts');
    
    const storedPosts = useMemo(() => loadBlogPosts(), []);
    const allPosts = (propPosts || storedPosts).filter(p => p.status === 'published');

    const gridCols = {
        2: 'md:grid-cols-2',
        3: 'md:grid-cols-2 lg:grid-cols-3',
        4: 'md:grid-cols-2 lg:grid-cols-4'
    };

    if (!enabled) return null;

    if (allPosts.length === 0) {
        return (
            <div className={`bg-slate-900 border border-slate-800 rounded-xl p-8 text-center ${className}`}>
                <i className="fas fa-pen-fancy text-4xl text-slate-600 mb-4"></i>
                <h3 className="text-xl font-bold text-white mb-2">Nog geen blog posts</h3>
                <p className="text-slate-400">Voeg blog posts toe via het admin dashboard.</p>
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-1 ${gridCols[columns]} gap-6 ${className}`}>
            {allPosts.map(post => (
                <article 
                    key={post.id}
                    onClick={() => onPostClick?.(post)}
                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-slate-700 transition group"
                >
                    {/* Featured Image */}
                    {post.featuredImage && (
                        <div className="aspect-video overflow-hidden">
                            <img 
                                src={post.featuredImage} 
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                    )}
                    
                    <div className="p-5">
                        {/* Category and reading time */}
                        <div className="flex items-center gap-2 mb-3 text-sm">
                            {post.category && (
                                <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                                    {post.category}
                                </span>
                            )}
                            {post.readingTime && (
                                <span className="text-slate-500">
                                    <i className="far fa-clock mr-1"></i>
                                    {post.readingTime} min
                                </span>
                            )}
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition">
                            {post.title}
                        </h3>
                        
                        {/* Excerpt */}
                        {showExcerpt && post.excerpt && (
                            <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                                {post.excerpt}
                            </p>
                        )}
                        
                        {/* Author and date */}
                        {showAuthor && (
                            <div className="flex items-center gap-3 mb-3">
                                {post.author.avatar ? (
                                    <img 
                                        src={post.author.avatar} 
                                        alt={post.author.name}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                        <span className="text-xs font-bold text-slate-400">
                                            {post.author.name.charAt(0)}
                                        </span>
                                    </div>
                                )}
                                <div>
                                    <div className="text-sm font-medium text-slate-300">{post.author.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(post.publishedAt).toLocaleDateString('nl-NL', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Tags */}
                        {showTags && post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {post.tags.slice(0, 3).map((tag, i) => (
                                    <span key={i} className="text-xs text-slate-500">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </article>
            ))}
        </div>
    );
};

interface BlogPostViewProps {
    post: BlogPost;
    onBack?: () => void;
    showRelated?: boolean;
    relatedPosts?: BlogPost[];
    onRelatedClick?: (post: BlogPost) => void;
    className?: string;
}

export const BlogPostView: React.FC<BlogPostViewProps> = ({
    post,
    onBack,
    showRelated = true,
    relatedPosts,
    onRelatedClick,
    className = ''
}) => {
    const enabled = useFeature('blog_posts');
    const { settings } = useFeatureToggle('blog_posts');

    if (!enabled) return null;

    return (
        <article className={`${className}`}>
            {/* Back button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-6 text-slate-400 hover:text-white transition flex items-center gap-2"
                >
                    <i className="fas fa-arrow-left"></i>
                    Terug naar overzicht
                </button>
            )}

            {/* Header */}
            <header className="mb-8">
                {/* Category */}
                {post.category && (
                    <span className="inline-block bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm mb-4">
                        {post.category}
                    </span>
                )}
                
                {/* Title */}
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
                    {post.title}
                </h1>
                
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                    {/* Author */}
                    <div className="flex items-center gap-2">
                        {post.author.avatar ? (
                            <img 
                                src={post.author.avatar} 
                                alt={post.author.name}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                <span className="text-xs font-bold">{post.author.name.charAt(0)}</span>
                            </div>
                        )}
                        <span className="font-medium text-slate-300">{post.author.name}</span>
                    </div>
                    
                    <span>•</span>
                    
                    {/* Date */}
                    <span>
                        <i className="far fa-calendar mr-1"></i>
                        {new Date(post.publishedAt).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </span>
                    
                    {/* Reading time */}
                    {post.readingTime && (
                        <>
                            <span>•</span>
                            <span>
                                <i className="far fa-clock mr-1"></i>
                                {post.readingTime} min leestijd
                            </span>
                        </>
                    )}
                </div>
            </header>

            {/* Featured image */}
            {post.featuredImage && (
                <div className="mb-8 rounded-xl overflow-hidden">
                    <img 
                        src={post.featuredImage} 
                        alt={post.title}
                        className="w-full h-64 md:h-96 object-cover"
                    />
                </div>
            )}

            {/* Content */}
            <div 
                className="prose prose-invert max-w-none blog-content mb-8"
                dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8 pt-6 border-t border-slate-800">
                    {post.tags.map((tag, i) => (
                        <span key={i} className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-sm">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Related posts */}
            {showRelated && relatedPosts && relatedPosts.length > 0 && (
                <section className="mt-12 pt-8 border-t border-slate-800">
                    <h2 className="text-2xl font-bold text-white mb-6">Gerelateerde artikelen</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedPosts.slice(0, 3).map(related => (
                            <div
                                key={related.id}
                                onClick={() => onRelatedClick?.(related)}
                                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-slate-700 transition group"
                            >
                                {related.featuredImage && (
                                    <img 
                                        src={related.featuredImage} 
                                        alt={related.title}
                                        className="h-32 w-full object-cover"
                                    />
                                )}
                                <div className="p-4">
                                    <h3 className="font-bold text-white text-sm line-clamp-2 group-hover:text-blue-400 transition">
                                        {related.title}
                                    </h3>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </article>
    );
};

interface BlogCategoriesProps {
    posts?: BlogPost[];
    selectedCategory?: string;
    onCategoryClick?: (category: string | null) => void;
    className?: string;
}

export const BlogCategories: React.FC<BlogCategoriesProps> = ({
    posts: propPosts,
    selectedCategory,
    onCategoryClick,
    className = ''
}) => {
    const enabled = useFeature('blog_posts');
    
    const storedPosts = useMemo(() => loadBlogPosts(), []);
    const allPosts = propPosts || storedPosts;
    
    const categories = useMemo(() => {
        const cats = new Map<string, number>();
        allPosts.forEach(post => {
            if (post.category) {
                cats.set(post.category, (cats.get(post.category) || 0) + 1);
            }
        });
        return Array.from(cats.entries()).sort((a, b) => b[1] - a[1]);
    }, [allPosts]);

    if (!enabled || categories.length === 0) return null;

    return (
        <div className={`${className}`}>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Categorieën</h3>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => onCategoryClick?.(null)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        !selectedCategory
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                    Alles ({allPosts.length})
                </button>
                {categories.map(([category, count]) => (
                    <button
                        key={category}
                        onClick={() => onCategoryClick?.(category)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {category} ({count})
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BlogGrid;

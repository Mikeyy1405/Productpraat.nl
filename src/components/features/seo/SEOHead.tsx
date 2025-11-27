/**
 * SEO Components
 * 
 * SEO head tags and structured data components.
 * Only renders when the 'seo_tools' feature is enabled.
 */

import React, { useEffect } from 'react';
import { useFeature, useFeatureToggle, useTemplate, useCMS } from '../../../cms';

interface SEOData {
    title?: string;
    description?: string;
    keywords?: string[];
    canonicalUrl?: string;
    ogImage?: string;
    ogType?: 'website' | 'article' | 'product';
    twitterCard?: 'summary' | 'summary_large_image';
    author?: string;
    publishedAt?: string;
    modifiedAt?: string;
    noIndex?: boolean;
}

interface SEOHeadProps extends SEOData {
    className?: string;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
    title,
    description,
    keywords = [],
    canonicalUrl,
    ogImage,
    ogType = 'website',
    twitterCard = 'summary_large_image',
    author,
    publishedAt,
    modifiedAt,
    noIndex = false
}) => {
    const enabled = useFeature('seo_tools');
    const { siteConfig } = useCMS();

    useEffect(() => {
        if (!enabled) return;

        // Update document title
        const siteTitle = siteConfig?.name || 'Website';
        const titleTemplate = siteConfig?.seo?.titleTemplate || `%s | ${siteTitle}`;
        const fullTitle = title ? titleTemplate.replace('%s', title) : siteTitle;
        document.title = fullTitle;

        // Update/create meta tags
        const updateMeta = (name: string, content: string, property = false) => {
            const attr = property ? 'property' : 'name';
            let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute(attr, name);
                document.head.appendChild(element);
            }
            element.content = content;
        };

        // Basic meta tags
        if (description) updateMeta('description', description);
        if (keywords.length > 0) updateMeta('keywords', keywords.join(', '));
        if (noIndex) updateMeta('robots', 'noindex,nofollow');
        if (author) updateMeta('author', author);

        // Open Graph tags
        updateMeta('og:title', fullTitle, true);
        if (description) updateMeta('og:description', description, true);
        updateMeta('og:type', ogType, true);
        if (canonicalUrl) updateMeta('og:url', canonicalUrl, true);
        if (ogImage) updateMeta('og:image', ogImage, true);

        // Twitter Card tags
        updateMeta('twitter:card', twitterCard);
        updateMeta('twitter:title', fullTitle);
        if (description) updateMeta('twitter:description', description);
        if (ogImage) updateMeta('twitter:image', ogImage);

        // Update canonical link
        if (canonicalUrl) {
            let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'canonical';
                document.head.appendChild(link);
            }
            link.href = canonicalUrl;
        }

        // Cleanup function not strictly needed but good practice
        return () => {
            // Optionally remove added tags on unmount
        };
    }, [enabled, title, description, keywords, canonicalUrl, ogImage, ogType, twitterCard, author, noIndex, siteConfig]);

    return null; // This component only handles side effects
};

interface StructuredDataProps {
    type: 'Organization' | 'WebSite' | 'Product' | 'Article' | 'BreadcrumbList' | 'FAQPage';
    data: Record<string, any>;
}

export const StructuredData: React.FC<StructuredDataProps> = ({
    type,
    data
}) => {
    const enabled = useFeature('seo_tools');

    useEffect(() => {
        if (!enabled) return;

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        
        const structuredData = {
            '@context': 'https://schema.org',
            '@type': type,
            ...data
        };
        
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);

        return () => {
            document.head.removeChild(script);
        };
    }, [enabled, type, data]);

    return null;
};

interface BreadcrumbItem {
    name: string;
    url: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
    items,
    className = ''
}) => {
    const enabled = useFeature('seo_tools');

    if (!enabled) return null;

    // Generate structured data for breadcrumbs
    const structuredData = {
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url
        }))
    };

    return (
        <>
            <StructuredData type="BreadcrumbList" data={structuredData} />
            
            <nav className={`flex items-center gap-2 text-sm ${className}`} aria-label="Breadcrumb">
                {items.map((item, index) => (
                    <React.Fragment key={item.url}>
                        {index > 0 && (
                            <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                        )}
                        {index === items.length - 1 ? (
                            <span className="text-white font-medium">{item.name}</span>
                        ) : (
                            <a href={item.url} className="text-slate-400 hover:text-white transition">
                                {item.name}
                            </a>
                        )}
                    </React.Fragment>
                ))}
            </nav>
        </>
    );
};

interface SEOSettingsEditorProps {
    initialData?: SEOData;
    onChange?: (data: SEOData) => void;
    className?: string;
}

export const SEOSettingsEditor: React.FC<SEOSettingsEditorProps> = ({
    initialData = {},
    onChange,
    className = ''
}) => {
    const enabled = useFeature('seo_tools');
    const [data, setData] = React.useState<SEOData>(initialData);

    const handleChange = (field: keyof SEOData, value: any) => {
        const newData = { ...data, [field]: value };
        setData(newData);
        onChange?.(newData);
    };

    if (!enabled) return null;

    return (
        <div className={`space-y-4 ${className}`}>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fas fa-search-plus text-yellow-400"></i>
                SEO Instellingen
            </h3>

            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    Meta Titel
                </label>
                <input
                    type="text"
                    value={data.title || ''}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                    placeholder="Pagina titel voor zoekmachines"
                />
                <p className="mt-1 text-xs text-slate-500">
                    {(data.title || '').length}/60 karakters (aanbevolen)
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    Meta Beschrijving
                </label>
                <textarea
                    value={data.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition resize-none"
                    placeholder="Korte beschrijving voor zoekmachines"
                />
                <p className="mt-1 text-xs text-slate-500">
                    {(data.description || '').length}/160 karakters (aanbevolen)
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    Keywords
                </label>
                <input
                    type="text"
                    value={(data.keywords || []).join(', ')}
                    onChange={(e) => handleChange('keywords', e.target.value.split(',').map(k => k.trim()))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                    placeholder="keyword1, keyword2, keyword3"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    Canonical URL
                </label>
                <input
                    type="url"
                    value={data.canonicalUrl || ''}
                    onChange={(e) => handleChange('canonicalUrl', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                    placeholder="https://example.com/page"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                    Open Graph Afbeelding
                </label>
                <input
                    type="url"
                    value={data.ogImage || ''}
                    onChange={(e) => handleChange('ogImage', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                    placeholder="https://example.com/image.jpg"
                />
            </div>

            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    id="noIndex"
                    checked={data.noIndex || false}
                    onChange={(e) => handleChange('noIndex', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="noIndex" className="text-sm text-slate-400">
                    Verberg deze pagina voor zoekmachines (noindex)
                </label>
            </div>
        </div>
    );
};

export default SEOHead;

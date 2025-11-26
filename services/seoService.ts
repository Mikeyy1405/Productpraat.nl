import { Product, CATEGORIES } from '../types';
import { getCanonicalUrl } from './urlService';

export const seoService = {
    /**
     * Update de document titel en meta description dynamisch
     */
    updateMeta: (title: string, description: string, image?: string, canonicalUrl?: string) => {
        // Update Title
        document.title = title;

        // Helper om meta tags te updaten of aan te maken
        const setMeta = (name: string, content: string, attribute = 'name') => {
            let element = document.querySelector(`meta[${attribute}="${name}"]`);
            if (!element) {
                element = document.createElement('meta');
                element.setAttribute(attribute, name);
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        // Standard SEO
        setMeta('description', description);

        // Open Graph (Social Media)
        setMeta('og:title', title, 'property');
        setMeta('og:description', description, 'property');
        setMeta('og:type', 'product', 'property');
        setMeta('og:site_name', 'ProductPraat.nl', 'property');
        setMeta('og:locale', 'nl_NL', 'property');
        if (image) setMeta('og:image', image, 'property');
        if (canonicalUrl) setMeta('og:url', canonicalUrl, 'property');

        // Twitter Card
        setMeta('twitter:card', 'summary_large_image', 'name');
        setMeta('twitter:title', title, 'name');
        setMeta('twitter:description', description, 'name');
        setMeta('twitter:site', '@ProductPraat', 'name');
        if (image) setMeta('twitter:image', image, 'name');

        // Canonical URL
        if (canonicalUrl) {
            seoService.setCanonicalUrl(canonicalUrl);
        }
    },

    /**
     * Set the canonical URL for the current page
     */
    setCanonicalUrl: (url: string) => {
        let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'canonical';
            document.head.appendChild(link);
        }
        link.href = url;
    },

    /**
     * Remove the canonical URL
     */
    clearCanonicalUrl: () => {
        const link = document.querySelector('link[rel="canonical"]');
        if (link) link.remove();
    },

    /**
     * Injecteer Schema.org JSON-LD data voor Rich Snippets in Google (Sterren, Prijs, Voorraad)
     */
    setProductSchema: (product: Product) => {
        // Verwijder oude schema's
        const oldScript = document.getElementById('json-ld-schema');
        if (oldScript) oldScript.remove();
        
        const oldBreadcrumbScript = document.getElementById('json-ld-breadcrumb');
        if (oldBreadcrumbScript) oldBreadcrumbScript.remove();

        // Get canonical URL for the product
        const canonicalUrl = getCanonicalUrl(product);
        const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : '';
        
        // Use multiple images if available
        const productImages = product.images && product.images.length > 0 
            ? product.images 
            : [product.image];

        // Build aggregate rating from Bol.com reviews if available
        let aggregateRating: Record<string, unknown> | undefined;
        if (product.bolReviewsRaw && product.bolReviewsRaw.totalReviews > 0) {
            aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": product.bolReviewsRaw.averageRating.toString(),
                "reviewCount": product.bolReviewsRaw.totalReviews.toString(),
                "bestRating": "5",
                "worstRating": "1"
            };
        } else {
            // Fallback to ProductPraat score (scaled from 10 to 5)
            aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": (product.score / 2).toFixed(1),
                "reviewCount": "1",
                "bestRating": "5",
                "worstRating": "1"
            };
        }

        // Get category name
        const categoryName = CATEGORIES[product.category]?.name || product.category;

        const schema: Record<string, unknown> = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": `${product.brand} ${product.model}`,
            "image": productImages,
            "description": product.metaDescription || product.description || product.longDescription?.substring(0, 160),
            "url": canonicalUrl,
            "sku": product.ean || undefined,
            "gtin13": product.ean || undefined,
            "brand": {
                "@type": "Brand",
                "name": product.brand
            },
            "category": categoryName,
            "review": {
                "@type": "Review",
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": product.score.toString(),
                    "bestRating": "10"
                },
                "author": {
                    "@type": "Organization",
                    "name": "ProductPraat Redactie"
                },
                "reviewBody": product.description || `Review van de ${product.brand} ${product.model}`
            },
            "aggregateRating": aggregateRating,
            "offers": {
                "@type": "Offer",
                "url": product.affiliateUrl && product.affiliateUrl !== '#' ? product.affiliateUrl : canonicalUrl,
                "priceCurrency": "EUR",
                "price": product.price.toString(),
                "availability": "https://schema.org/InStock",
                "itemCondition": "https://schema.org/NewCondition",
                "seller": {
                    "@type": "Organization",
                    "name": "Bol.com"
                }
            }
        };

        // Add pros and cons as additionalProperty
        if (product.pros && product.pros.length > 0) {
            schema.positiveNotes = {
                "@type": "ItemList",
                "itemListElement": product.pros.map((pro, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "name": pro
                }))
            };
        }
        
        if (product.cons && product.cons.length > 0) {
            schema.negativeNotes = {
                "@type": "ItemList",
                "itemListElement": product.cons.map((con, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "name": con
                }))
            };
        }

        const script = document.createElement('script');
        script.id = 'json-ld-schema';
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
        
        // Add breadcrumb schema
        const breadcrumbSchema = {
            "@context": "https://schema.org/",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": baseUrl
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": categoryName,
                    "item": `${baseUrl}/shop/${product.category}`
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": `${product.brand} ${product.model}`,
                    "item": canonicalUrl
                }
            ]
        };
        
        const breadcrumbScriptEl = document.createElement('script');
        breadcrumbScriptEl.id = 'json-ld-breadcrumb';
        breadcrumbScriptEl.type = 'application/ld+json';
        breadcrumbScriptEl.text = JSON.stringify(breadcrumbSchema);
        document.head.appendChild(breadcrumbScriptEl);
    },

    /**
     * Reset schema wanneer je de pagina verlaat
     */
    clearSchema: () => {
        const oldScript = document.getElementById('json-ld-schema');
        if (oldScript) oldScript.remove();
        const oldBreadcrumbScript = document.getElementById('json-ld-breadcrumb');
        if (oldBreadcrumbScript) oldBreadcrumbScript.remove();
        seoService.clearCanonicalUrl();
    }
};
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
        setMeta('og:type', 'website', 'property');
        if (image) setMeta('og:image', image, 'property');
        if (canonicalUrl) setMeta('og:url', canonicalUrl, 'property');

        // Twitter Card
        setMeta('twitter:card', 'summary_large_image', 'name');
        setMeta('twitter:title', title, 'name');
        setMeta('twitter:description', description, 'name');
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

        // Get canonical URL for the product
        const canonicalUrl = getCanonicalUrl(product);

        const schema = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": `${product.brand} ${product.model}`,
            "image": [product.image],
            "description": product.description || product.longDescription?.substring(0, 160),
            "url": canonicalUrl,
            "brand": {
                "@type": "Brand",
                "name": product.brand
            },
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
                }
            },
            "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": product.score.toString(),
                "reviewCount": "1", // In echte app is dit dynamisch
                "bestRating": "10",
                "worstRating": "1"
            },
            "offers": {
                "@type": "Offer",
                "url": product.affiliateUrl !== '#' ? product.affiliateUrl : canonicalUrl,
                "priceCurrency": "EUR",
                "price": product.price.toString(),
                "availability": "https://schema.org/InStock",
                "itemCondition": "https://schema.org/NewCondition"
            }
        };

        const script = document.createElement('script');
        script.id = 'json-ld-schema';
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
    },

    /**
     * Reset schema wanneer je de pagina verlaat
     */
    clearSchema: () => {
        const oldScript = document.getElementById('json-ld-schema');
        if (oldScript) oldScript.remove();
        seoService.clearCanonicalUrl();
    }
};
/**
 * WritgoCMS - Core Type Definitions
 * 
 * This module contains all the type definitions for the CMS system,
 * including templates, feature toggles, and site configuration.
 */

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Available template types in WritgoCMS
 */
export type TemplateType = 'business' | 'shop' | 'blog';

/**
 * Template metadata and configuration
 */
export interface TemplateConfig {
    id: TemplateType;
    name: string;
    description: string;
    icon: string;
    previewImage?: string;
    defaultFeatures: FeatureId[];
    availableFeatures: FeatureId[];
    settings: TemplateSettings;
}

/**
 * Template-specific settings
 */
export interface TemplateSettings {
    // General settings
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    
    // Layout settings
    headerStyle: 'minimal' | 'standard' | 'expanded';
    footerStyle: 'simple' | 'detailed' | 'mega';
    sidebarPosition: 'left' | 'right' | 'none';
    
    // Template-specific settings
    [key: string]: string | number | boolean | undefined;
}

// ============================================================================
// FEATURE TOGGLE TYPES
// ============================================================================

/**
 * Available feature identifiers
 */
export type FeatureId = 
    | 'comments'
    | 'contact_form'
    | 'newsletter'
    | 'search'
    | 'social_media'
    | 'payment_systems'
    | 'product_reviews'
    | 'multi_language'
    | 'seo_tools'
    | 'analytics'
    | 'media_library'
    | 'wysiwyg_editor'
    | 'menu_management'
    | 'page_builder'
    | 'user_authentication'
    | 'cart_wishlist'
    | 'inventory_management'
    | 'blog_posts'
    | 'testimonials'
    | 'faq_section';

/**
 * Feature configuration
 */
export interface FeatureConfig {
    id: FeatureId;
    name: string;
    description: string;
    icon: string;
    category: FeatureCategory;
    isCore: boolean; // Core features cannot be disabled
    templateCompatibility: TemplateType[]; // Which templates support this feature
    settings?: FeatureSettings;
}

/**
 * Feature categories for grouping in the UI
 */
export type FeatureCategory = 
    | 'content'
    | 'engagement'
    | 'commerce'
    | 'seo_analytics'
    | 'communication'
    | 'core';

/**
 * Feature-specific settings
 */
export interface FeatureSettings {
    [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Feature toggle state for a site
 */
export interface FeatureToggleState {
    featureId: FeatureId;
    enabled: boolean;
    settings?: FeatureSettings;
}

// ============================================================================
// SITE CONFIGURATION TYPES
// ============================================================================

/**
 * Complete site configuration stored in database
 */
export interface SiteConfig {
    id: string;
    name: string;
    slug: string;
    description: string;
    logoUrl?: string;
    faviconUrl?: string;
    
    // Template configuration
    templateType: TemplateType;
    templateSettings: TemplateSettings;
    
    // Feature toggles
    features: FeatureToggleState[];
    
    // SEO settings
    seo: SeoConfig;
    
    // Contact information
    contact: ContactConfig;
    
    // Social media links
    socialMedia: SocialMediaConfig;
    
    // Timestamps
    createdAt: string;
    updatedAt: string;
    
    // Migration status (for backwards compatibility)
    migratedFromProductpraat?: boolean;
    legacyData?: Record<string, unknown>;
}

/**
 * SEO configuration
 */
export interface SeoConfig {
    defaultTitle: string;
    titleTemplate: string;
    defaultDescription: string;
    defaultKeywords: string[];
    ogImage?: string;
    twitterHandle?: string;
    googleAnalyticsId?: string;
    googleSearchConsoleVerification?: string;
}

/**
 * Contact information
 */
export interface ContactConfig {
    email: string;
    phone?: string;
    address?: {
        street?: string;
        city?: string;
        postalCode?: string;
        country?: string;
    };
    businessHours?: string;
}

/**
 * Social media links
 */
export interface SocialMediaConfig {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
    pinterest?: string;
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

/**
 * Pre-defined templates with their configurations
 */
export const TEMPLATES: Record<TemplateType, TemplateConfig> = {
    business: {
        id: 'business',
        name: 'Bedrijfswebsite',
        description: 'Professionele website voor bedrijven en organisaties. Perfect voor het presenteren van diensten, team en contactinformatie.',
        icon: 'fa-building',
        defaultFeatures: ['contact_form', 'seo_tools', 'analytics', 'media_library', 'wysiwyg_editor', 'menu_management', 'page_builder', 'testimonials', 'faq_section'],
        availableFeatures: ['comments', 'contact_form', 'newsletter', 'search', 'social_media', 'multi_language', 'seo_tools', 'analytics', 'media_library', 'wysiwyg_editor', 'menu_management', 'page_builder', 'testimonials', 'faq_section', 'blog_posts'],
        settings: {
            primaryColor: '#1877F2',
            secondaryColor: '#6366F1',
            fontFamily: 'Inter',
            borderRadius: 'lg',
            headerStyle: 'standard',
            footerStyle: 'detailed',
            sidebarPosition: 'none',
            heroStyle: 'image',
            showTeamSection: true,
            showServicesGrid: true,
        }
    },
    shop: {
        id: 'shop',
        name: 'Shop',
        description: 'E-commerce platform voor online winkels. Inclusief productcatalogus, winkelwagen en betalingsintegratie. Gebaseerd op de huidige Productpraat functionaliteit.',
        icon: 'fa-shopping-cart',
        defaultFeatures: ['search', 'seo_tools', 'analytics', 'media_library', 'wysiwyg_editor', 'menu_management', 'product_reviews', 'cart_wishlist', 'payment_systems', 'blog_posts', 'page_builder'],
        availableFeatures: ['comments', 'contact_form', 'newsletter', 'search', 'social_media', 'payment_systems', 'product_reviews', 'multi_language', 'seo_tools', 'analytics', 'media_library', 'wysiwyg_editor', 'menu_management', 'page_builder', 'cart_wishlist', 'inventory_management', 'blog_posts'],
        settings: {
            primaryColor: '#1877F2',
            secondaryColor: '#10B981',
            fontFamily: 'Inter',
            borderRadius: 'xl',
            headerStyle: 'expanded',
            footerStyle: 'mega',
            sidebarPosition: 'left',
            showProductFilters: true,
            showProductComparison: true,
            showPriceHistory: false,
            productsPerPage: 12,
            enableQuickView: true,
        }
    },
    blog: {
        id: 'blog',
        name: 'Blog',
        description: 'Content-gericht platform voor bloggers en content creators. Ideaal voor het delen van artikelen, tutorials en verhalen.',
        icon: 'fa-newspaper',
        defaultFeatures: ['comments', 'newsletter', 'search', 'social_media', 'seo_tools', 'analytics', 'media_library', 'wysiwyg_editor', 'menu_management', 'blog_posts'],
        availableFeatures: ['comments', 'contact_form', 'newsletter', 'search', 'social_media', 'multi_language', 'seo_tools', 'analytics', 'media_library', 'wysiwyg_editor', 'menu_management', 'page_builder', 'blog_posts', 'user_authentication'],
        settings: {
            primaryColor: '#8B5CF6',
            secondaryColor: '#EC4899',
            fontFamily: 'Georgia',
            borderRadius: 'md',
            headerStyle: 'minimal',
            footerStyle: 'simple',
            sidebarPosition: 'right',
            showAuthorBio: true,
            showRelatedPosts: true,
            showReadingTime: true,
            postsPerPage: 10,
            enableDarkMode: true,
        }
    }
};

// ============================================================================
// FEATURE DEFINITIONS
// ============================================================================

/**
 * All available features with their configurations
 */
export const FEATURES: Record<FeatureId, FeatureConfig> = {
    // Core features (always available, some cannot be disabled)
    media_library: {
        id: 'media_library',
        name: 'Media Bibliotheek',
        description: 'Beheer afbeeldingen, video\'s en andere media bestanden.',
        icon: 'fa-images',
        category: 'core',
        isCore: true,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    wysiwyg_editor: {
        id: 'wysiwyg_editor',
        name: 'Content Editor',
        description: 'Visuele WYSIWYG editor voor het bewerken van content.',
        icon: 'fa-edit',
        category: 'core',
        isCore: true,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    menu_management: {
        id: 'menu_management',
        name: 'Menu Management',
        description: 'Beheer navigatiemenu\'s en links.',
        icon: 'fa-bars',
        category: 'core',
        isCore: true,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    page_builder: {
        id: 'page_builder',
        name: 'Page Builder',
        description: 'Drag-and-drop pagina builder voor flexibele layouts.',
        icon: 'fa-layer-group',
        category: 'core',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },

    // Content features
    blog_posts: {
        id: 'blog_posts',
        name: 'Blog Posts',
        description: 'Publiceer en beheer blog artikelen.',
        icon: 'fa-pen-fancy',
        category: 'content',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    comments: {
        id: 'comments',
        name: 'Commentaar Sectie',
        description: 'Laat bezoekers reageren op content.',
        icon: 'fa-comments',
        category: 'engagement',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    faq_section: {
        id: 'faq_section',
        name: 'FAQ Sectie',
        description: 'Veelgestelde vragen en antwoorden.',
        icon: 'fa-question-circle',
        category: 'content',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    testimonials: {
        id: 'testimonials',
        name: 'Testimonials',
        description: 'Toon klantbeoordelingen en testimonials.',
        icon: 'fa-quote-right',
        category: 'content',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },

    // Engagement features
    contact_form: {
        id: 'contact_form',
        name: 'Contact Formulier',
        description: 'Contactformulier voor bezoekers.',
        icon: 'fa-envelope',
        category: 'communication',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
        settings: {
            emailRecipient: '',
            enableCaptcha: true,
            successMessage: 'Bedankt voor uw bericht!',
        }
    },
    newsletter: {
        id: 'newsletter',
        name: 'Newsletter Integratie',
        description: 'Nieuwsbrief aanmeldingen verzamelen.',
        icon: 'fa-newspaper',
        category: 'communication',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
        settings: {
            provider: 'mailchimp',
            apiKey: '',
            listId: '',
        }
    },
    social_media: {
        id: 'social_media',
        name: 'Social Media Integratie',
        description: 'Social media sharing en feeds.',
        icon: 'fa-share-alt',
        category: 'engagement',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },

    // Commerce features
    payment_systems: {
        id: 'payment_systems',
        name: 'Betalingssystemen',
        description: 'Online betalingen via iDEAL, creditcard, etc.',
        icon: 'fa-credit-card',
        category: 'commerce',
        isCore: false,
        templateCompatibility: ['shop'],
        settings: {
            providers: ['ideal', 'creditcard', 'paypal'],
            testMode: true,
        }
    },
    product_reviews: {
        id: 'product_reviews',
        name: 'Product Reviews',
        description: 'Klantreviews voor producten.',
        icon: 'fa-star',
        category: 'commerce',
        isCore: false,
        templateCompatibility: ['shop'],
    },
    cart_wishlist: {
        id: 'cart_wishlist',
        name: 'Winkelwagen & Wishlist',
        description: 'Winkelwagen en verlanglijst functionaliteit.',
        icon: 'fa-shopping-basket',
        category: 'commerce',
        isCore: false,
        templateCompatibility: ['shop'],
    },
    inventory_management: {
        id: 'inventory_management',
        name: 'Voorraadbeheer',
        description: 'Beheer productvoorraad en beschikbaarheid.',
        icon: 'fa-boxes',
        category: 'commerce',
        isCore: false,
        templateCompatibility: ['shop'],
    },

    // SEO & Analytics features
    seo_tools: {
        id: 'seo_tools',
        name: 'SEO Tools',
        description: 'Meta tags, sitemaps en SEO optimalisatie.',
        icon: 'fa-search-plus',
        category: 'seo_analytics',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
    analytics: {
        id: 'analytics',
        name: 'Analytics Integratie',
        description: 'Google Analytics en andere tracking tools.',
        icon: 'fa-chart-line',
        category: 'seo_analytics',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
        settings: {
            googleAnalyticsId: '',
            enableHeatmaps: false,
        }
    },
    search: {
        id: 'search',
        name: 'Zoekfunctionaliteit',
        description: 'Site-brede zoekfunctie.',
        icon: 'fa-search',
        category: 'content',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },

    // Advanced features
    multi_language: {
        id: 'multi_language',
        name: 'Multi-taal Ondersteuning',
        description: 'Website in meerdere talen aanbieden.',
        icon: 'fa-globe',
        category: 'content',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
        settings: {
            defaultLanguage: 'nl',
            availableLanguages: ['nl', 'en', 'de', 'fr'],
        }
    },
    user_authentication: {
        id: 'user_authentication',
        name: 'Gebruikers Authenticatie',
        description: 'Gebruikersaccounts en login systeem.',
        icon: 'fa-user-lock',
        category: 'core',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
    },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get features grouped by category
 */
export const getFeaturesByCategory = (): Record<FeatureCategory, FeatureConfig[]> => {
    const grouped: Record<FeatureCategory, FeatureConfig[]> = {
        core: [],
        content: [],
        engagement: [],
        commerce: [],
        seo_analytics: [],
        communication: [],
    };

    Object.values(FEATURES).forEach(feature => {
        grouped[feature.category].push(feature);
    });

    return grouped;
};

/**
 * Get features available for a specific template
 */
export const getFeaturesForTemplate = (templateType: TemplateType): FeatureConfig[] => {
    return Object.values(FEATURES).filter(
        feature => feature.templateCompatibility.includes(templateType)
    );
};

/**
 * Get default feature state for a template
 */
export const getDefaultFeatureState = (templateType: TemplateType): FeatureToggleState[] => {
    const template = TEMPLATES[templateType];
    const availableFeatures = getFeaturesForTemplate(templateType);
    
    return availableFeatures.map(feature => ({
        featureId: feature.id,
        enabled: template.defaultFeatures.includes(feature.id) || feature.isCore,
        settings: feature.settings,
    }));
};

/**
 * Create a default site configuration
 */
export const createDefaultSiteConfig = (
    name: string,
    templateType: TemplateType = 'shop'
): Omit<SiteConfig, 'id' | 'createdAt' | 'updatedAt'> => {
    const template = TEMPLATES[templateType];
    
    return {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: '',
        templateType,
        templateSettings: { ...template.settings },
        features: getDefaultFeatureState(templateType),
        seo: {
            defaultTitle: name,
            titleTemplate: `%s | ${name}`,
            defaultDescription: '',
            defaultKeywords: [],
        },
        contact: {
            email: '',
        },
        socialMedia: {},
    };
};

/**
 * Category labels in Dutch
 */
export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
    core: 'Kern Functionaliteiten',
    content: 'Content',
    engagement: 'Engagement',
    commerce: 'E-commerce',
    seo_analytics: 'SEO & Analytics',
    communication: 'Communicatie',
};

/**
 * WritgoCMS - Unit Tests for Types and Helpers
 * 
 * Tests for core CMS functionality including templates, features, and helper functions.
 */

import {
    TemplateType,
    FeatureId,
    TEMPLATES,
    FEATURES,
    CATEGORY_LABELS,
    getFeaturesByCategory,
    getFeaturesForTemplate,
    getDefaultFeatureState,
    createDefaultSiteConfig,
} from '../types';

describe('WritgoCMS Types', () => {
    describe('TEMPLATES', () => {
        it('should have exactly 3 templates defined', () => {
            expect(Object.keys(TEMPLATES)).toHaveLength(3);
        });

        it('should have business, shop, and blog templates', () => {
            expect(TEMPLATES).toHaveProperty('business');
            expect(TEMPLATES).toHaveProperty('shop');
            expect(TEMPLATES).toHaveProperty('blog');
        });

        it('each template should have required properties', () => {
            Object.values(TEMPLATES).forEach(template => {
                expect(template).toHaveProperty('id');
                expect(template).toHaveProperty('name');
                expect(template).toHaveProperty('description');
                expect(template).toHaveProperty('icon');
                expect(template).toHaveProperty('defaultFeatures');
                expect(template).toHaveProperty('availableFeatures');
                expect(template).toHaveProperty('settings');
            });
        });

        it('template settings should have required style properties', () => {
            Object.values(TEMPLATES).forEach(template => {
                expect(template.settings).toHaveProperty('primaryColor');
                expect(template.settings).toHaveProperty('secondaryColor');
                expect(template.settings).toHaveProperty('fontFamily');
                expect(template.settings).toHaveProperty('borderRadius');
                expect(template.settings).toHaveProperty('headerStyle');
                expect(template.settings).toHaveProperty('footerStyle');
                expect(template.settings).toHaveProperty('sidebarPosition');
            });
        });

        it('shop template should be compatible with Productpraat', () => {
            const shop = TEMPLATES.shop;
            expect(shop.defaultFeatures).toContain('product_reviews');
            expect(shop.availableFeatures).toContain('payment_systems');
            expect(shop.availableFeatures).toContain('cart_wishlist');
        });
    });

    describe('FEATURES', () => {
        it('should have at least 10 features defined', () => {
            expect(Object.keys(FEATURES).length).toBeGreaterThanOrEqual(10);
        });

        it('should have 20 features as per requirements', () => {
            expect(Object.keys(FEATURES)).toHaveLength(20);
        });

        it('each feature should have required properties', () => {
            Object.values(FEATURES).forEach(feature => {
                expect(feature).toHaveProperty('id');
                expect(feature).toHaveProperty('name');
                expect(feature).toHaveProperty('description');
                expect(feature).toHaveProperty('icon');
                expect(feature).toHaveProperty('category');
                expect(feature).toHaveProperty('isCore');
                expect(feature).toHaveProperty('templateCompatibility');
            });
        });

        it('core features should be marked correctly', () => {
            const coreFeatures = Object.values(FEATURES).filter(f => f.isCore);
            expect(coreFeatures.length).toBeGreaterThan(0);
            
            // Media library, wysiwyg_editor, and menu_management should be core
            expect(FEATURES.media_library.isCore).toBe(true);
            expect(FEATURES.wysiwyg_editor.isCore).toBe(true);
            expect(FEATURES.menu_management.isCore).toBe(true);
        });

        it('commerce features should only be compatible with shop template', () => {
            expect(FEATURES.payment_systems.templateCompatibility).toContain('shop');
            expect(FEATURES.payment_systems.templateCompatibility).not.toContain('blog');
            
            expect(FEATURES.product_reviews.templateCompatibility).toContain('shop');
            expect(FEATURES.product_reviews.templateCompatibility).not.toContain('business');
        });
    });

    describe('CATEGORY_LABELS', () => {
        it('should have all category labels defined', () => {
            expect(CATEGORY_LABELS).toHaveProperty('core');
            expect(CATEGORY_LABELS).toHaveProperty('content');
            expect(CATEGORY_LABELS).toHaveProperty('engagement');
            expect(CATEGORY_LABELS).toHaveProperty('commerce');
            expect(CATEGORY_LABELS).toHaveProperty('seo_analytics');
            expect(CATEGORY_LABELS).toHaveProperty('communication');
        });

        it('labels should be in Dutch', () => {
            expect(CATEGORY_LABELS.core).toBe('Kern Functionaliteiten');
            expect(CATEGORY_LABELS.commerce).toBe('E-commerce');
        });
    });
});

describe('WritgoCMS Helper Functions', () => {
    describe('getFeaturesByCategory', () => {
        it('should return features grouped by category', () => {
            const grouped = getFeaturesByCategory();
            
            expect(grouped).toHaveProperty('core');
            expect(grouped).toHaveProperty('content');
            expect(grouped).toHaveProperty('engagement');
            expect(grouped).toHaveProperty('commerce');
            expect(grouped).toHaveProperty('seo_analytics');
            expect(grouped).toHaveProperty('communication');
        });

        it('each category should contain array of features', () => {
            const grouped = getFeaturesByCategory();
            
            Object.values(grouped).forEach(features => {
                expect(Array.isArray(features)).toBe(true);
            });
        });

        it('total features across categories should match FEATURES count', () => {
            const grouped = getFeaturesByCategory();
            const totalCount = Object.values(grouped).reduce(
                (sum, features) => sum + features.length, 
                0
            );
            
            expect(totalCount).toBe(Object.keys(FEATURES).length);
        });
    });

    describe('getFeaturesForTemplate', () => {
        it('should return features compatible with shop template', () => {
            const shopFeatures = getFeaturesForTemplate('shop');
            
            expect(shopFeatures.length).toBeGreaterThan(0);
            expect(shopFeatures.some(f => f.id === 'product_reviews')).toBe(true);
            expect(shopFeatures.some(f => f.id === 'payment_systems')).toBe(true);
        });

        it('should return features compatible with blog template', () => {
            const blogFeatures = getFeaturesForTemplate('blog');
            
            expect(blogFeatures.length).toBeGreaterThan(0);
            expect(blogFeatures.some(f => f.id === 'comments')).toBe(true);
            expect(blogFeatures.some(f => f.id === 'blog_posts')).toBe(true);
        });

        it('blog template should not have shop-only features', () => {
            const blogFeatures = getFeaturesForTemplate('blog');
            
            expect(blogFeatures.some(f => f.id === 'payment_systems')).toBe(false);
            expect(blogFeatures.some(f => f.id === 'product_reviews')).toBe(false);
        });
    });

    describe('getDefaultFeatureState', () => {
        it('should return array of feature toggle states', () => {
            const states = getDefaultFeatureState('shop');
            
            expect(Array.isArray(states)).toBe(true);
            expect(states.length).toBeGreaterThan(0);
        });

        it('each state should have featureId and enabled properties', () => {
            const states = getDefaultFeatureState('shop');
            
            states.forEach(state => {
                expect(state).toHaveProperty('featureId');
                expect(state).toHaveProperty('enabled');
                expect(typeof state.enabled).toBe('boolean');
            });
        });

        it('core features should be enabled by default', () => {
            const states = getDefaultFeatureState('shop');
            
            const mediaLibraryState = states.find(s => s.featureId === 'media_library');
            expect(mediaLibraryState?.enabled).toBe(true);
        });

        it('template default features should be enabled', () => {
            const states = getDefaultFeatureState('shop');
            const shopTemplate = TEMPLATES.shop;
            
            shopTemplate.defaultFeatures.forEach(featureId => {
                const state = states.find(s => s.featureId === featureId);
                expect(state?.enabled).toBe(true);
            });
        });
    });

    describe('createDefaultSiteConfig', () => {
        it('should create a valid site config with name', () => {
            const config = createDefaultSiteConfig('My Website');
            
            expect(config.name).toBe('My Website');
            expect(config.slug).toBe('my-website');
        });

        it('should use shop template by default', () => {
            const config = createDefaultSiteConfig('Test');
            
            expect(config.templateType).toBe('shop');
        });

        it('should use specified template when provided', () => {
            const config = createDefaultSiteConfig('Test', 'blog');
            
            expect(config.templateType).toBe('blog');
        });

        it('should have all required properties', () => {
            const config = createDefaultSiteConfig('Test');
            
            expect(config).toHaveProperty('name');
            expect(config).toHaveProperty('slug');
            expect(config).toHaveProperty('description');
            expect(config).toHaveProperty('templateType');
            expect(config).toHaveProperty('templateSettings');
            expect(config).toHaveProperty('features');
            expect(config).toHaveProperty('seo');
            expect(config).toHaveProperty('contact');
            expect(config).toHaveProperty('socialMedia');
        });

        it('should have valid SEO config', () => {
            const config = createDefaultSiteConfig('Test Site');
            
            expect(config.seo.defaultTitle).toBe('Test Site');
            expect(config.seo.titleTemplate).toBe('%s | Test Site');
        });

        it('should have features array with enabled states', () => {
            const config = createDefaultSiteConfig('Test');
            
            expect(Array.isArray(config.features)).toBe(true);
            expect(config.features.length).toBeGreaterThan(0);
        });
    });
});

describe('WritgoCMS Acceptance Criteria', () => {
    it('AC1: Users can choose from at least 3 template types', () => {
        const templateCount = Object.keys(TEMPLATES).length;
        expect(templateCount).toBeGreaterThanOrEqual(3);
    });

    it('AC2: At least 10 feature toggles are available', () => {
        const featureCount = Object.keys(FEATURES).length;
        expect(featureCount).toBeGreaterThanOrEqual(10);
    });

    it('AC3: All templates have default features that can work independently', () => {
        Object.values(TEMPLATES).forEach(template => {
            expect(template.defaultFeatures.length).toBeGreaterThan(0);
            
            // All default features should be in available features
            template.defaultFeatures.forEach(feature => {
                expect(template.availableFeatures).toContain(feature);
            });
        });
    });

    it('AC4: Shop template preserves Productpraat functionality', () => {
        const shop = TEMPLATES.shop;
        
        // Should have product-related features
        expect(shop.availableFeatures).toContain('product_reviews');
        expect(shop.availableFeatures).toContain('search');
        expect(shop.availableFeatures).toContain('seo_tools');
        
        // Should have e-commerce capabilities
        expect(shop.settings.showProductFilters).toBeDefined();
    });

    it('AC5: Features respect template compatibility', () => {
        // Commerce features should only work with shop
        const commerceFeatures = Object.values(FEATURES).filter(
            f => f.category === 'commerce'
        );
        
        commerceFeatures.forEach(feature => {
            expect(feature.templateCompatibility).toContain('shop');
        });
    });
});

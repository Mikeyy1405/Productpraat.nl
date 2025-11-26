/**
 * Product and Article Validation Utilities
 * Provides validation functions to ensure data integrity before saving
 */

import { Product, Article, CATEGORIES } from '../types';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate a product before saving
 * Returns validation errors and warnings
 */
export const validateProduct = (product: Partial<Product>): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!product.brand || product.brand.trim() === '') {
        errors.push('Merk is verplicht');
    }

    if (!product.model || product.model.trim() === '') {
        errors.push('Model is verplicht');
    }

    if (product.price === undefined || product.price === null || product.price <= 0) {
        errors.push('Prijs moet groter dan 0 zijn');
    }

    if (!product.category || product.category.trim() === '') {
        errors.push('Categorie is verplicht');
    } else if (!CATEGORIES[product.category]) {
        errors.push(`Ongeldige categorie: ${product.category}`);
    }

    if (!product.image || product.image.trim() === '') {
        errors.push('Afbeelding is verplicht');
    } else if (!isValidUrl(product.image)) {
        errors.push('Afbeelding URL is ongeldig');
    }

    // Score validation
    if (product.score !== undefined) {
        if (product.score < 0 || product.score > 10) {
            errors.push('Score moet tussen 0 en 10 zijn');
        }
    }

    // Optional field warnings
    if (!product.description || product.description.trim() === '') {
        warnings.push('Beschrijving ontbreekt - aanbevolen voor SEO');
    }

    if (!product.metaDescription || product.metaDescription.trim() === '') {
        warnings.push('Meta beschrijving ontbreekt - belangrijk voor SEO');
    }

    if (!product.pros || product.pros.length === 0) {
        warnings.push('Geen voordelen opgegeven');
    }

    if (!product.cons || product.cons.length === 0) {
        warnings.push('Geen nadelen opgegeven');
    }

    if (!product.affiliateUrl || product.affiliateUrl.trim() === '') {
        warnings.push('Affiliate URL ontbreekt - geen commissie mogelijk');
    }

    if (!product.ean || product.ean.trim() === '') {
        warnings.push('EAN ontbreekt - prijssync niet mogelijk');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Validate an article before saving
 */
export const validateArticle = (article: Partial<Article>): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!article.title || article.title.trim() === '') {
        errors.push('Titel is verplicht');
    }

    if (!article.type) {
        errors.push('Type is verplicht');
    }

    if (!article.category || article.category.trim() === '') {
        errors.push('Categorie is verplicht');
    }

    if (!article.htmlContent || article.htmlContent.trim() === '') {
        errors.push('Content is verplicht');
    }

    // Warnings for optional but recommended fields
    if (!article.summary || article.summary.trim() === '') {
        warnings.push('Samenvatting ontbreekt - aanbevolen voor previews');
    }

    if (!article.metaDescription || article.metaDescription.trim() === '') {
        warnings.push('Meta beschrijving ontbreekt - belangrijk voor SEO');
    }

    if (!article.imageUrl || article.imageUrl.trim() === '') {
        warnings.push('Afbeelding ontbreekt - aanbevolen voor social sharing');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

/**
 * Generate a unique slug from brand and model
 * Ensures no duplicates by checking existing slugs
 */
export const generateUniqueSlug = (
    brand: string,
    model: string,
    existingSlugs: string[]
): string => {
    const baseSlug = createSlug(`${brand} ${model}`);
    
    if (!existingSlugs.includes(baseSlug)) {
        return baseSlug;
    }

    // Add suffix for uniqueness
    let counter = 2;
    let uniqueSlug = `${baseSlug}-${counter}`;
    
    while (existingSlugs.includes(uniqueSlug)) {
        counter++;
        uniqueSlug = `${baseSlug}-${counter}`;
    }

    return uniqueSlug;
};

/**
 * Create a URL-safe slug from text
 */
export const createSlug = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '')    // Remove special chars
        .replace(/\s+/g, '-')            // Replace spaces with -
        .replace(/-+/g, '-')             // Replace multiple - with single -
        .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens
};

/**
 * Validate URL format
 */
export const isValidUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validate EAN format (13 digits)
 */
export const isValidEan = (ean: string): boolean => {
    return /^\d{13}$/.test(ean);
};

/**
 * Get validation message for displaying to user
 */
export const getValidationMessage = (result: ValidationResult): string => {
    if (result.isValid && result.warnings.length === 0) {
        return 'Alle velden zijn correct ingevuld';
    }

    const messages: string[] = [];
    
    if (result.errors.length > 0) {
        messages.push(`❌ Fouten: ${result.errors.join(', ')}`);
    }
    
    if (result.warnings.length > 0) {
        messages.push(`⚠️ Waarschuwingen: ${result.warnings.join(', ')}`);
    }

    return messages.join('\n');
};

/**
 * Check if a product with the same EAN or model already exists
 */
export const checkDuplicateProduct = (
    newProduct: Partial<Product>,
    existingProducts: Product[]
): { isDuplicate: boolean; duplicateField?: string; existingProduct?: Product } => {
    // Check by EAN first (most reliable)
    if (newProduct.ean) {
        const byEan = existingProducts.find(p => p.ean === newProduct.ean);
        if (byEan) {
            return { isDuplicate: true, duplicateField: 'EAN', existingProduct: byEan };
        }
    }

    // Check by brand + model combination
    if (newProduct.brand && newProduct.model) {
        const byBrandModel = existingProducts.find(
            p => p.brand.toLowerCase() === newProduct.brand!.toLowerCase() &&
                 p.model.toLowerCase() === newProduct.model!.toLowerCase()
        );
        if (byBrandModel) {
            return { isDuplicate: true, duplicateField: 'Merk + Model', existingProduct: byBrandModel };
        }
    }

    return { isDuplicate: false };
};

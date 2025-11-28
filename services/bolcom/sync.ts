/**
 * Bol.com Sync Service
 * 
 * Handles automatic synchronization of products from Bol.com API to the database.
 * Includes batch imports, price updates, deal detection, and rating updates.
 * 
 * @module services/bolcom/sync
 */

import { getSupabase } from '../supabaseClient';
import { bolProductsService } from './products';
import {
    BolProduct,
    DbProduct,
    DbProductImage,
    DbCategory,
    DbProductSpecification,
    DbDeal,
    SyncJob,
    SyncConfig,
} from '../../types/bolcom';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Default sync configuration
 */
const DEFAULT_SYNC_CONFIG: SyncConfig = {
    enabled: true,
    popularProductsIntervalHours: 24,
    priceUpdateIntervalHours: 1,
    dealDetectionIntervalMinutes: 15,
    ratingUpdateIntervalHours: 24,
    popularProductsLimit: 100,
};

/**
 * Minimum discount percentage to be considered a deal
 */
const DEAL_THRESHOLD_PERCENTAGE = 15;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate UUID-like ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get current sync config from environment
 */
function getSyncConfig(): SyncConfig {
    const getEnvVar = (key: string, defaultValue: string): string => {
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key] || defaultValue;
        }
        return defaultValue;
    };
    
    return {
        enabled: getEnvVar('SYNC_ENABLED', 'true') === 'true',
        popularProductsIntervalHours: parseInt(getEnvVar('SYNC_POPULAR_INTERVAL_HOURS', '24'), 10),
        priceUpdateIntervalHours: parseInt(getEnvVar('SYNC_PRICE_INTERVAL_HOURS', '1'), 10),
        dealDetectionIntervalMinutes: parseInt(getEnvVar('SYNC_DEAL_INTERVAL_MINUTES', '15'), 10),
        ratingUpdateIntervalHours: parseInt(getEnvVar('SYNC_RATING_INTERVAL_HOURS', '24'), 10),
        popularProductsLimit: parseInt(getEnvVar('SYNC_POPULAR_PRODUCTS_LIMIT', '100'), 10),
    };
}

/**
 * Map Bol.com product to database format
 */
function mapProductToDb(bolProduct: BolProduct): DbProduct {
    const offer = bolProduct.bestOffer;
    const now = new Date().toISOString();
    
    return {
        id: generateId(),
        ean: bolProduct.ean,
        bol_product_id: bolProduct.bolProductId,
        title: bolProduct.title,
        description: bolProduct.description || bolProduct.shortDescription,
        url: bolProduct.url,
        price: offer?.price?.value,
        strikethrough_price: offer?.strikethroughPrice?.value,
        discount_percentage: offer?.discountPercentage,
        delivery_description: offer?.delivery?.deliveryDescription,
        in_stock: offer?.availability === 'IN_STOCK' || offer?.availability === 'LIMITED_STOCK',
        is_deal: (offer?.discountPercentage || 0) >= DEAL_THRESHOLD_PERCENTAGE,
        average_rating: bolProduct.rating?.averageRating,
        total_ratings: bolProduct.rating?.totalRatings || 0,
        main_image_url: bolProduct.mainImageUrl || bolProduct.images?.[0]?.url,
        custom_description: undefined,
        custom_review_summary: undefined,
        last_synced_at: now,
        created_at: now,
        updated_at: now,
    };
}

/**
 * Map product images to database format
 */
function mapImagesToDb(productId: string, bolProduct: BolProduct): DbProductImage[] {
    return (bolProduct.images || []).map((img, index) => ({
        id: generateId(),
        product_id: productId,
        url: img.url,
        width: img.width,
        height: img.height,
        display_order: img.displayOrder || index + 1,
        mime_type: img.mimeType,
    }));
}

/**
 * Map specifications to database format
 */
function mapSpecsToDb(productId: string, bolProduct: BolProduct): DbProductSpecification[] {
    return (bolProduct.specifications || []).map(spec => ({
        id: generateId(),
        product_id: productId,
        group_title: spec.groupTitle,
        spec_key: spec.key,
        spec_name: spec.name,
        spec_value: spec.value,
    }));
}

// ============================================================================
// SYNC SERVICE
// ============================================================================

/**
 * Bol.com Sync Service
 */
export const bolSyncService = {
    /**
     * Get current sync configuration
     */
    getConfig(): SyncConfig {
        return { ...DEFAULT_SYNC_CONFIG, ...getSyncConfig() };
    },

    /**
     * Sync popular products for a category
     * 
     * @param categoryId - Category ID to sync
     * @param limit - Maximum number of products to sync
     * @returns Sync job result
     */
    async syncPopularProducts(categoryId: string, limit?: number): Promise<SyncJob> {
        const config = this.getConfig();
        const syncLimit = limit || config.popularProductsLimit;
        
        const job: SyncJob = {
            id: generateId(),
            type: 'popular_products',
            status: 'running',
            categoryId,
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsFailed: 0,
        };
        
        const supabase = getSupabase();
        if (!supabase) {
            job.status = 'failed';
            job.errorMessage = 'Database not configured';
            return job;
        }
        
        try {
            console.log(`[BolSync] Starting popular products sync for category ${categoryId}`);
            
            // Fetch popular products from API
            const response = await bolProductsService.listPopularProducts(categoryId, {
                pageSize: syncLimit,
            });
            
            const products = response.products;
            console.log(`[BolSync] Found ${products.length} popular products`);
            
            // Process each product
            for (const bolProduct of products) {
                try {
                    // Check if product already exists
                    const { data: existing } = await supabase
                        .from('bol_products')
                        .select('id')
                        .eq('ean', bolProduct.ean)
                        .single();
                    
                    const dbProduct = mapProductToDb(bolProduct);
                    
                    if (existing) {
                        // Update existing product
                        dbProduct.id = existing.id;
                        dbProduct.created_at = undefined as unknown as string; // Don't update created_at
                        
                        await supabase
                            .from('bol_products')
                            .update(dbProduct)
                            .eq('id', existing.id);
                    } else {
                        // Insert new product
                        const { data: inserted } = await supabase
                            .from('bol_products')
                            .insert(dbProduct)
                            .select('id')
                            .single();
                        
                        if (inserted) {
                            // Insert images
                            const images = mapImagesToDb(inserted.id, bolProduct);
                            if (images.length > 0) {
                                await supabase.from('bol_product_images').insert(images);
                            }
                            
                            // Insert specifications
                            const specs = mapSpecsToDb(inserted.id, bolProduct);
                            if (specs.length > 0) {
                                await supabase.from('bol_product_specifications').insert(specs);
                            }
                            
                            // Insert category links
                            for (const cat of bolProduct.categories || []) {
                                await supabase.from('bol_product_categories').insert({
                                    product_id: inserted.id,
                                    category_id: cat.categoryId,
                                });
                            }
                        }
                    }
                    
                    job.itemsProcessed++;
                } catch (error) {
                    console.error(`[BolSync] Failed to sync product ${bolProduct.ean}:`, error);
                    job.itemsFailed++;
                }
            }
            
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            
            console.log(`[BolSync] Completed. Processed: ${job.itemsProcessed}, Failed: ${job.itemsFailed}`);
            
        } catch (error) {
            console.error('[BolSync] Sync failed:', error);
            job.status = 'failed';
            job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
        
        return job;
    },

    /**
     * Update prices and stock for existing products
     * 
     * @param productIds - Optional list of product IDs to update (all if not provided)
     * @returns Sync job result
     */
    async updatePricesAndStock(productIds?: string[]): Promise<SyncJob> {
        const job: SyncJob = {
            id: generateId(),
            type: 'price_update',
            status: 'running',
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsFailed: 0,
        };
        
        const supabase = getSupabase();
        if (!supabase) {
            job.status = 'failed';
            job.errorMessage = 'Database not configured';
            return job;
        }
        
        try {
            console.log('[BolSync] Starting price/stock update');
            
            // Get products to update
            let query = supabase.from('bol_products').select('id, ean');
            if (productIds?.length) {
                query = query.in('id', productIds);
            }
            
            const { data: products, error } = await query;
            
            if (error) {
                throw error;
            }
            
            console.log(`[BolSync] Updating ${products?.length || 0} products`);
            
            // Update each product
            for (const product of products || []) {
                try {
                    const offer = await bolProductsService.getProductBestOffer(product.ean);
                    
                    if (offer) {
                        const now = new Date().toISOString();
                        const wasOnSale = (offer.discountPercentage || 0) >= DEAL_THRESHOLD_PERCENTAGE;
                        
                        await supabase
                            .from('bol_products')
                            .update({
                                price: offer.price?.value,
                                strikethrough_price: offer.strikethroughPrice?.value,
                                discount_percentage: offer.discountPercentage,
                                delivery_description: offer.delivery?.deliveryDescription,
                                in_stock: offer.availability === 'IN_STOCK' || offer.availability === 'LIMITED_STOCK',
                                is_deal: wasOnSale,
                                last_synced_at: now,
                                updated_at: now,
                            })
                            .eq('id', product.id);
                    }
                    
                    job.itemsProcessed++;
                } catch (error) {
                    console.error(`[BolSync] Failed to update product ${product.ean}:`, error);
                    job.itemsFailed++;
                }
            }
            
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            
        } catch (error) {
            console.error('[BolSync] Price update failed:', error);
            job.status = 'failed';
            job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
        
        return job;
    },

    /**
     * Detect new deals (products with large discounts)
     * 
     * @returns Sync job result with detected deals
     */
    async detectDeals(): Promise<SyncJob> {
        const job: SyncJob = {
            id: generateId(),
            type: 'deal_detection',
            status: 'running',
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsFailed: 0,
        };
        
        const supabase = getSupabase();
        if (!supabase) {
            job.status = 'failed';
            job.errorMessage = 'Database not configured';
            return job;
        }
        
        try {
            console.log('[BolSync] Starting deal detection');
            
            // Get products that are marked as deals
            const { data: dealProducts, error } = await supabase
                .from('bol_products')
                .select('id, ean, title, discount_percentage')
                .eq('is_deal', true)
                .gte('discount_percentage', DEAL_THRESHOLD_PERCENTAGE);
            
            if (error) {
                throw error;
            }
            
            console.log(`[BolSync] Found ${dealProducts?.length || 0} potential deals`);
            
            // Create or update deal records
            for (const product of dealProducts || []) {
                try {
                    // Check if deal already exists
                    const { data: existingDeal } = await supabase
                        .from('bol_deals')
                        .select('id')
                        .eq('product_id', product.id)
                        .eq('is_active', true)
                        .single();
                    
                    if (!existingDeal) {
                        // Create new deal
                        const deal: Partial<DbDeal> = {
                            id: generateId(),
                            product_id: product.id,
                            title: `${product.discount_percentage}% korting op ${product.title?.substring(0, 50)}`,
                            discount_percentage: product.discount_percentage,
                            start_date: new Date().toISOString(),
                            is_active: true,
                            deal_type: 'daily_deal',
                        };
                        
                        await supabase.from('bol_deals').insert(deal);
                    }
                    
                    job.itemsProcessed++;
                } catch (error) {
                    console.error(`[BolSync] Failed to process deal for product ${product.ean}:`, error);
                    job.itemsFailed++;
                }
            }
            
            // Deactivate old deals for products no longer on sale
            await supabase
                .from('bol_deals')
                .update({ is_active: false, end_date: new Date().toISOString() })
                .eq('is_active', true)
                .not('product_id', 'in', `(${(dealProducts || []).map(p => `'${p.id}'`).join(',')})`);
            
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            
        } catch (error) {
            console.error('[BolSync] Deal detection failed:', error);
            job.status = 'failed';
            job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
        
        return job;
    },

    /**
     * Update ratings for products
     * 
     * @param productIds - Optional list of product IDs to update
     * @returns Sync job result
     */
    async updateRatings(productIds?: string[]): Promise<SyncJob> {
        const job: SyncJob = {
            id: generateId(),
            type: 'rating_update',
            status: 'running',
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsFailed: 0,
        };
        
        const supabase = getSupabase();
        if (!supabase) {
            job.status = 'failed';
            job.errorMessage = 'Database not configured';
            return job;
        }
        
        try {
            console.log('[BolSync] Starting rating update');
            
            // Get products to update
            let query = supabase.from('bol_products').select('id, ean');
            if (productIds?.length) {
                query = query.in('id', productIds);
            }
            
            const { data: products, error } = await query;
            
            if (error) {
                throw error;
            }
            
            console.log(`[BolSync] Updating ratings for ${products?.length || 0} products`);
            
            for (const product of products || []) {
                try {
                    const rating = await bolProductsService.getProductRating(product.ean);
                    
                    if (rating) {
                        await supabase
                            .from('bol_products')
                            .update({
                                average_rating: rating.averageRating,
                                total_ratings: rating.totalRatings,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', product.id);
                    }
                    
                    job.itemsProcessed++;
                } catch (error) {
                    console.error(`[BolSync] Failed to update rating for ${product.ean}:`, error);
                    job.itemsFailed++;
                }
            }
            
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            
        } catch (error) {
            console.error('[BolSync] Rating update failed:', error);
            job.status = 'failed';
            job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
        
        return job;
    },

    /**
     * Sync categories from Bol.com
     * 
     * @returns Sync job result
     */
    async syncCategories(): Promise<SyncJob> {
        const job: SyncJob = {
            id: generateId(),
            type: 'popular_products', // Reusing type since there's no category type
            status: 'running',
            startedAt: new Date().toISOString(),
            itemsProcessed: 0,
            itemsFailed: 0,
        };
        
        const supabase = getSupabase();
        if (!supabase) {
            job.status = 'failed';
            job.errorMessage = 'Database not configured';
            return job;
        }
        
        try {
            console.log('[BolSync] Starting category sync');
            
            // Fetch root categories
            const categories = await bolProductsService.getCategories();
            
            console.log(`[BolSync] Found ${categories.length} root categories`);
            
            // Process each category recursively
            const processCategory = async (category: DbCategory, parentId?: string): Promise<void> => {
                try {
                    const dbCategory: DbCategory = {
                        id: category.id,
                        name: category.name,
                        parent_id: parentId,
                        product_count: category.product_count || 0,
                        level: category.level,
                    };
                    
                    await supabase
                        .from('bol_categories')
                        .upsert(dbCategory, { onConflict: 'id' });
                    
                    job.itemsProcessed++;
                } catch (error) {
                    console.error(`[BolSync] Failed to sync category ${category.id}:`, error);
                    job.itemsFailed++;
                }
            };
            
            for (const category of categories) {
                await processCategory(category as unknown as DbCategory);
            }
            
            job.status = 'completed';
            job.completedAt = new Date().toISOString();
            
        } catch (error) {
            console.error('[BolSync] Category sync failed:', error);
            job.status = 'failed';
            job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }
        
        return job;
    },

    /**
     * Run a full sync (popular products for all main categories)
     * 
     * @param categoryIds - List of category IDs to sync
     * @returns Array of sync job results
     */
    async runFullSync(categoryIds: string[]): Promise<SyncJob[]> {
        const jobs: SyncJob[] = [];
        
        console.log(`[BolSync] Starting full sync for ${categoryIds.length} categories`);
        
        // Sync categories first
        const categoryJob = await this.syncCategories();
        jobs.push(categoryJob);
        
        // Sync popular products for each category
        for (const categoryId of categoryIds) {
            const productJob = await this.syncPopularProducts(categoryId);
            jobs.push(productJob);
        }
        
        // Detect deals
        const dealJob = await this.detectDeals();
        jobs.push(dealJob);
        
        console.log(`[BolSync] Full sync completed. Total jobs: ${jobs.length}`);
        
        return jobs;
    },
};

export default bolSyncService;

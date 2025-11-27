import { getSupabase } from './supabaseClient';
import { Product, UserReview, Article } from '../types';
import { generateSlug, generateArticleSlug } from './urlService';

/**
 * Helper function to format error messages consistently
 * Handles Error objects, plain objects, and other types
 */
const formatError = (e: unknown): string => {
    if (e instanceof Error) {
        return e.message;
    }
    if (typeof e === 'object' && e !== null) {
        return JSON.stringify(e);
    }
    return String(e);
};

export const db = {
    // --- PRODUCTEN ---
    getAll: async (): Promise<Product[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data as Product[] || [];
        } catch (e) {
            console.error("Fetch Error:", formatError(e));
            return [];
        }
    },

    /**
     * Get a product by its category and slug
     * Used for URL routing: /shop/{category}/{slug}
     */
    getBySlug: async (category: string, slug: string): Promise<Product | null> => {
        const supabase = getSupabase();
        if (!supabase) return null;
        try {
            // First try to find by exact slug match
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('category', category.toLowerCase())
                .eq('slug', slug.toLowerCase())
                .limit(1);
            
            if (error) throw error;
            if (data && data.length > 0) {
                return data[0] as Product;
            }
            
            // If no exact match, try to find by generated slug from brand/model
            // This handles products that don't have a stored slug
            const allInCategory = await db.getByCategory(category);
            const match = allInCategory.find(p => {
                const generatedSlug = p.slug || generateSlug(p.brand, p.model);
                return generatedSlug.toLowerCase() === slug.toLowerCase();
            });
            
            return match || null;
        } catch (e) {
            console.error("GetBySlug Error:", formatError(e));
            return null;
        }
    },

    /**
     * Get all products in a specific category
     */
    getByCategory: async (category: string): Promise<Product[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('category', category.toLowerCase())
                .order('score', { ascending: false });
            
            if (error) throw error;
            return data as Product[] || [];
        } catch (e) {
            console.error("GetByCategory Error:", formatError(e));
            return [];
        }
    },

    add: async (product: Product): Promise<Product[]> => {
        const supabase = getSupabase();
        if (!supabase) { 
            throw new Error("Database niet beschikbaar. Controleer Supabase configuratie."); 
        }
        try {
            const cleanProduct = JSON.parse(JSON.stringify(product));
            const { error } = await supabase.from('products').insert([cleanProduct]);
            
            if (error) {
                // Extract meaningful error message
                const errorMessage = error.message || error.details || error.hint || 'Onbekende database fout';
                console.error("Supabase Insert Error:", error);
                throw new Error(`Database fout: ${errorMessage}`);
            }
            
            return await db.getAll();
        } catch (e) {
            console.error("Add Error:", formatError(e));
            // Re-throw with clear message
            if (e instanceof Error) {
                throw e;
            }
            throw new Error(`Fout bij opslaan product: ${formatError(e)}`);
        }
    },

    /**
     * Bulk add multiple products at once
     * More efficient than adding one by one
     */
    addBulk: async (products: Product[]): Promise<Product[]> => {
        const supabase = getSupabase();
        if (!supabase) { 
            throw new Error("Database niet beschikbaar. Controleer Supabase configuratie."); 
        }
        try {
            // Clean all products before inserting
            const cleanProducts = products.map(p => JSON.parse(JSON.stringify(p)));
            
            // Insert all at once
            const { error } = await supabase.from('products').insert(cleanProducts);
            if (error) {
                const errorMessage = error.message || error.details || error.hint || 'Onbekende database fout';
                console.error("Supabase Bulk Insert Error:", error);
                throw new Error(`Database fout: ${errorMessage}`);
            }
            
            console.log(`✅ Bulk inserted ${products.length} products`);
            return await db.getAll();
        } catch (e) {
            console.error("Bulk Add Error:", formatError(e));
            if (e instanceof Error) {
                throw e;
            }
            throw new Error(`Fout bij bulk opslaan producten: ${formatError(e)}`);
        }
    },

    remove: async (id: string): Promise<Product[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
            return await db.getAll();
        } catch (e) { throw e; }
    },

    clear: async () => {
        const supabase = getSupabase();
        if (!supabase) return;
        try {
            await supabase.from('products').delete().neq('id', '0');
            await supabase.from('articles').delete().neq('id', '0');
            await supabase.from('reviews').delete().neq('id', '0');
        } catch (e) { console.error(e); }
    },

    // --- REVIEWS ---
    getReviewsForProduct: async (productId: string): Promise<UserReview[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('productId', productId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as UserReview[] || [];
        } catch (e) { 
            console.error("GetReviews Error:", formatError(e));
            return []; 
        }
    },

    addUserReview: async (review: UserReview): Promise<UserReview[]> => {
        const supabase = getSupabase();
        if (!supabase) {
            throw new Error("Database niet beschikbaar. Controleer Supabase configuratie.");
        }
        try {
            // Add title field for database compatibility (default to first words of comment)
            const reviewWithTitle = {
                ...review,
                title: review.comment.substring(0, 50) + (review.comment.length > 50 ? '...' : ''),
            };
            const { error } = await supabase.from('reviews').insert([reviewWithTitle]);
            if (error) {
                const errorMessage = error.message || error.details || error.hint || 'Onbekende database fout';
                console.error("Supabase addUserReview error:", error);
                throw new Error(`Database fout: ${errorMessage}`);
            }
            return await db.getReviewsForProduct(review.productId);
        } catch (e) { 
            console.error("Add Review Error:", formatError(e));
            if (e instanceof Error) {
                throw e;
            }
            throw new Error(`Fout bij opslaan review: ${formatError(e)}`);
        }
    },

    // --- ARTIKELEN ---
    getArticles: async (): Promise<Article[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as Article[] || [];
        } catch (e) { return []; }
    },

    addArticle: async (article: Article): Promise<Article[]> => {
        const supabase = getSupabase();
        if (!supabase) {
            throw new Error("Database niet beschikbaar. Controleer de verbinding.");
        }
        try {
            // Validate required fields
            if (!article.title || !article.type || !article.category) {
                throw new Error("Verplichte velden ontbreken: titel, type of categorie");
            }
            
            const cleanArticle = JSON.parse(JSON.stringify(article));
            const { error } = await supabase.from('articles').insert([cleanArticle]);
            
            if (error) {
                console.error("Supabase addArticle error:", error);
                // Extract meaningful error message from Supabase error
                const errorMessage = error.message || error.details || error.hint || 'Onbekende database fout';
                throw new Error(`Database fout: ${errorMessage}`);
            }
            
            return await db.getArticles();
        } catch (e) {
            console.error("Add Article Error:", e);
            // Re-throw with proper error message
            if (e instanceof Error) {
                throw e;
            }
            throw new Error(`Fout bij opslaan artikel: ${formatError(e)}`);
        }
    },

    deleteArticle: async (id: string): Promise<Article[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            await supabase.from('articles').delete().eq('id', id);
            return await db.getArticles();
        } catch (e) { throw e; }
    },

    /**
     * Update an existing article
     */
    updateArticle: async (article: Article): Promise<Article[]> => {
        const supabase = getSupabase();
        if (!supabase) {
            throw new Error("Database niet beschikbaar. Controleer de verbinding.");
        }
        try {
            // Validate required fields
            if (!article.id) {
                throw new Error("Artikel ID ontbreekt");
            }
            
            // Update lastUpdated timestamp
            const updatedArticle = {
                ...article,
                lastUpdated: new Date().toISOString()
            };
            const cleanArticle = JSON.parse(JSON.stringify(updatedArticle));
            const { error } = await supabase
                .from('articles')
                .update(cleanArticle)
                .eq('id', article.id);
                
            if (error) {
                console.error("Supabase updateArticle error:", error);
                const errorMessage = error.message || error.details || error.hint || 'Onbekende database fout';
                throw new Error(`Database fout: ${errorMessage}`);
            }
            
            return await db.getArticles();
        } catch (e) {
            console.error("Update Article Error:", e);
            if (e instanceof Error) {
                throw e;
            }
            throw new Error(`Fout bij bijwerken artikel: ${formatError(e)}`);
        }
    },

    /**
     * Get an article by its slug
     */
    getArticleBySlug: async (slug: string): Promise<Article | null> => {
        const supabase = getSupabase();
        if (!supabase) return null;
        try {
            // First try to find by exact slug match
            const { data, error } = await supabase
                .from('articles')
                .select('*')
                .eq('slug', slug.toLowerCase())
                .limit(1);
            
            if (error) throw error;
            if (data && data.length > 0) {
                return data[0] as Article;
            }
            
            // If no exact match, try to find by generated slug from title/type
            const allArticles = await db.getArticles();
            const match = allArticles.find(a => {
                const generatedSlug = a.slug || generateArticleSlug(a);
                return generatedSlug.toLowerCase() === slug.toLowerCase();
            });
            
            return match || null;
        } catch (e) {
            console.error("GetArticleBySlug Error:", JSON.stringify(e));
            return null;
        }
    }
};
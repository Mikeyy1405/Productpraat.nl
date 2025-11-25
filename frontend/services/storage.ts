import { getSupabase } from './supabaseClient';
import { Product, UserReview, Article } from '../types';

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
            console.error("Fetch Error:", JSON.stringify(e));
            return [];
        }
    },

    add: async (product: Product): Promise<Product[]> => {
        const supabase = getSupabase();
        if (!supabase) { alert("Database nog niet gereed. Probeer over 2 seconden opnieuw."); return []; }
        try {
            const cleanProduct = JSON.parse(JSON.stringify(product));
            const { error } = await supabase.from('products').insert([cleanProduct]);
            if (error) throw error;
            return await db.getAll();
        } catch (e) {
            console.error("Add Error:", JSON.stringify(e));
            throw e;
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
        } catch (e) { return []; }
    },

    addUserReview: async (review: UserReview): Promise<UserReview[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            const { error } = await supabase.from('reviews').insert([review]);
            if (error) throw error;
            return await db.getReviewsForProduct(review.productId);
        } catch (e) { return []; }
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
        if (!supabase) return [];
        try {
            const cleanArticle = JSON.parse(JSON.stringify(article));
            const { error } = await supabase.from('articles').insert([cleanArticle]);
            if (error) throw error;
            return await db.getArticles();
        } catch (e) { throw e; }
    },

    deleteArticle: async (id: string): Promise<Article[]> => {
        const supabase = getSupabase();
        if (!supabase) return [];
        try {
            await supabase.from('articles').delete().eq('id', id);
            return await db.getArticles();
        } catch (e) { throw e; }
    }
};
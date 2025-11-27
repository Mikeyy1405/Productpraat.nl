import { getSupabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface LoginResult {
    success: boolean;
    error?: string;
}

export const authService = {
    login: async (email: string, pass: string): Promise<LoginResult> => {
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, error: 'Supabase is niet geconfigureerd.' };
        }

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password: pass,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    logout: async (): Promise<void> => {
        const supabase = getSupabase();
        if (supabase) {
            await supabase.auth.signOut();
        }
    },

    isAuthenticated: async (): Promise<boolean> => {
        const supabase = getSupabase();
        if (!supabase) {
            return false;
        }

        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    },

    getCurrentUser: async (): Promise<User | null> => {
        const supabase = getSupabase();
        if (!supabase) {
            return null;
        }

        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }
};

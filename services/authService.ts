import { getSupabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface LoginResult {
    success: boolean;
    error?: string;
}

export interface LogoutResult {
    success: boolean;
    error?: string;
}

// Demo mode for development when Supabase is not configured
const DEMO_MODE_KEY = 'productpraat_demo_authenticated';

export const authService = {
    login: async (email: string, pass: string): Promise<LoginResult> => {
        const supabase = getSupabase();
        
        // Demo mode: allow login with specific credentials when Supabase is not configured
        if (!supabase) {
            if (email === 'demo@productpraat.nl' && pass === 'demo123') {
                localStorage.setItem(DEMO_MODE_KEY, 'true');
                return { success: true };
            }
            return { success: false, error: 'Gebruik demo@productpraat.nl / demo123 voor demo toegang.' };
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

    logout: async (): Promise<LogoutResult> => {
        // Clear demo mode
        localStorage.removeItem(DEMO_MODE_KEY);
        
        const supabase = getSupabase();
        if (!supabase) {
            return { success: true };
        }

        const { error } = await supabase.auth.signOut();
        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    isAuthenticated: async (): Promise<boolean> => {
        // Check demo mode first
        if (localStorage.getItem(DEMO_MODE_KEY) === 'true') {
            return true;
        }
        
        const supabase = getSupabase();
        if (!supabase) {
            return false;
        }

        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    },

    getCurrentUser: async (): Promise<User | null> => {
        // Demo user
        if (localStorage.getItem(DEMO_MODE_KEY) === 'true') {
            return { 
                id: 'demo-user',
                email: 'demo@productpraat.nl',
                app_metadata: {},
                user_metadata: {},
                aud: 'demo',
                created_at: new Date().toISOString()
            } as User;
        }
        
        const supabase = getSupabase();
        if (!supabase) {
            return null;
        }

        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }
};

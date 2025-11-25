import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- ROBUST CONFIGURATION LOADING (LAZY) ---
// We use a getter function to create the client ONLY when needed.
// This gives window.__ENV__ time to be populated by server.js.

let clientInstance: SupabaseClient | null = null;

const getEnvVar = (key: string): string => {
    // Check window injection (Server)
    if (typeof window !== 'undefined' && (window as any).__ENV__ && (window as any).__ENV__[key]) {
        return (window as any).__ENV__[key];
    }
    // Check Vite env (Local Dev)
    if ((import.meta as any).env && (import.meta as any).env[key]) {
        return (import.meta as any).env[key];
    }
    return '';
};

export const getSupabase = (): SupabaseClient | null => {
    if (clientInstance) return clientInstance;

    const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
    const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

    const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '');

    if (!isConfigured) {
        console.warn("⚠️ Supabase nog niet geconfigureerd. Wacht op injectie...");
        return null;
    }

    clientInstance = createClient(supabaseUrl, supabaseAnonKey);
    return clientInstance;
};

export const isSupabaseConfigured = (): boolean => {
    return !!getSupabase();
};

// Export a placeholder for type safety if needed, but discourage direct use
export const supabase = null;
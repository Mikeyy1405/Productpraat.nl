import { getSupabase } from './supabaseClient';
import { SiteConfig } from '../src/cms/types';

/**
 * Database representation of a site configuration
 * Uses snake_case to match Supabase column naming conventions
 */
interface SiteRow {
    id: string;
    user_id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    favicon_url: string | null;
    template_type: string;
    template_settings: Record<string, unknown>;
    features: unknown[];
    seo: Record<string, unknown>;
    contact: Record<string, unknown>;
    social_media: Record<string, unknown>;
    migrated_from_productpraat: boolean;
    legacy_data: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

/**
 * Helper function to format error messages consistently
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

/**
 * Convert database row to SiteConfig object
 */
const rowToSiteConfig = (row: SiteRow): SiteConfig => {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description || '',
        logoUrl: row.logo_url || undefined,
        faviconUrl: row.favicon_url || undefined,
        templateType: row.template_type as SiteConfig['templateType'],
        templateSettings: row.template_settings as unknown as SiteConfig['templateSettings'],
        features: row.features as unknown as SiteConfig['features'],
        seo: row.seo as unknown as SiteConfig['seo'],
        contact: row.contact as unknown as SiteConfig['contact'],
        socialMedia: row.social_media as unknown as SiteConfig['socialMedia'],
        migratedFromProductpraat: row.migrated_from_productpraat,
        legacyData: row.legacy_data || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

/**
 * Convert SiteConfig object to database row format
 */
const siteConfigToRow = (config: SiteConfig, userId: string): Omit<SiteRow, 'created_at' | 'updated_at'> => {
    return {
        id: config.id,
        user_id: userId,
        name: config.name,
        slug: config.slug,
        description: config.description || null,
        logo_url: config.logoUrl || null,
        favicon_url: config.faviconUrl || null,
        template_type: config.templateType,
        template_settings: config.templateSettings as unknown as Record<string, unknown>,
        features: config.features as unknown as unknown[],
        seo: config.seo as unknown as Record<string, unknown>,
        contact: config.contact as unknown as Record<string, unknown>,
        social_media: config.socialMedia as unknown as Record<string, unknown>,
        migrated_from_productpraat: config.migratedFromProductpraat || false,
        legacy_data: config.legacyData as Record<string, unknown> || null,
    };
};

export interface SiteServiceResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export const siteService = {
    /**
     * Get the site configuration for the current logged-in user
     * Returns null if no site exists for the user
     */
    getMySite: async (): Promise<SiteServiceResult<SiteConfig | null>> => {
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, error: 'Supabase is niet geconfigureerd.' };
        }

        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                return { success: false, error: 'Gebruiker niet ingelogd.' };
            }

            // Fetch site for current user
            const { data, error } = await supabase
                .from('sites')
                .select('*')
                .eq('user_id', user.id)
                .limit(1)
                .single();

            if (error) {
                // PGRST116 means no rows returned - this is expected for new users
                if (error.code === 'PGRST116') {
                    return { success: true, data: null };
                }
                console.error('[SiteService] getMySite error:', error);
                return { success: false, error: `Database fout: ${error.message}` };
            }

            return { success: true, data: rowToSiteConfig(data as SiteRow) };
        } catch (e) {
            console.error('[SiteService] getMySite exception:', formatError(e));
            return { success: false, error: `Fout bij ophalen site: ${formatError(e)}` };
        }
    },

    /**
     * Create a new site configuration for the current user
     */
    createSite: async (config: SiteConfig): Promise<SiteServiceResult<SiteConfig>> => {
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, error: 'Supabase is niet geconfigureerd.' };
        }

        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                return { success: false, error: 'Gebruiker niet ingelogd.' };
            }

            const row = siteConfigToRow(config, user.id);
            // JSON serialization ensures clean data for Supabase (removes undefined, converts to plain object)
            const cleanRow = JSON.parse(JSON.stringify(row));

            const { data, error } = await supabase
                .from('sites')
                .insert([cleanRow])
                .select()
                .single();

            if (error) {
                console.error('[SiteService] createSite error:', error);
                return { success: false, error: `Database fout: ${error.message}` };
            }

            console.log('[SiteService] Site created successfully');
            return { success: true, data: rowToSiteConfig(data as SiteRow) };
        } catch (e) {
            console.error('[SiteService] createSite exception:', formatError(e));
            return { success: false, error: `Fout bij aanmaken site: ${formatError(e)}` };
        }
    },

    /**
     * Update the site configuration for the current user
     */
    updateSiteConfig: async (config: SiteConfig): Promise<SiteServiceResult<SiteConfig>> => {
        const supabase = getSupabase();
        if (!supabase) {
            return { success: false, error: 'Supabase is niet geconfigureerd.' };
        }

        try {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                return { success: false, error: 'Gebruiker niet ingelogd.' };
            }

            const row = siteConfigToRow(config, user.id);
            // JSON serialization ensures clean data for Supabase (removes undefined, converts to plain object)
            const cleanRow = JSON.parse(JSON.stringify(row));

            const { data, error } = await supabase
                .from('sites')
                .update({
                    ...cleanRow,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', config.id)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) {
                console.error('[SiteService] updateSiteConfig error:', error);
                return { success: false, error: `Database fout: ${error.message}` };
            }

            console.log('[SiteService] Site updated successfully');
            return { success: true, data: rowToSiteConfig(data as SiteRow) };
        } catch (e) {
            console.error('[SiteService] updateSiteConfig exception:', formatError(e));
            return { success: false, error: `Fout bij bijwerken site: ${formatError(e)}` };
        }
    },
};

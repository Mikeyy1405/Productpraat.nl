import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('⚠️  Supabase credentials niet gevonden in environment variables');
      this.logger.warn('⚠️  Zie SUPABASE_SETUP.md voor instructies');
      this.logger.warn('⚠️  Product endpoints zullen niet werken totdat Supabase is geconfigureerd');
      return; // Don't throw, just warn
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('✅ Supabase client geïnitialiseerd');

    // Test de connectie en maak de tabel aan indien nodig
    await this.ensureProductsTable();
  }

  getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error(
        'Supabase is niet geconfigureerd. Vul SUPABASE_URL en SUPABASE_ANON_KEY in .env in. Zie SUPABASE_SETUP.md voor instructies.',
      );
    }
    return this.supabase;
  }

  private async ensureProductsTable() {
    try {
      // Test query om te zien of de tabel bestaat
      const { data, error } = await this.supabase
        .from('products')
        .select('id')
        .limit(1);

      if (error && error.message.includes('does not exist')) {
        this.logger.warn('⚠️ Products tabel bestaat niet. Maak deze aan in Supabase met het volgende SQL:');
        this.logger.warn(`
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            price NUMERIC,
            category TEXT,
            image_url TEXT,
            affiliate_url TEXT,
            ai_review TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
      } else if (!error) {
        this.logger.log('✅ Products tabel bestaat');
      }
    } catch (err) {
      this.logger.error('Fout bij tabel check:', err);
    }
  }
}
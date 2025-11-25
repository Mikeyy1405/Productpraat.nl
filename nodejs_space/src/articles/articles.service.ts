import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AiReviewService } from '../ai-review/ai-review.service';
import { v4 as uuidv4 } from 'uuid';

export interface Article {
  id: string;
  type: 'guide' | 'comparison' | 'informative';
  title: string;
  category: string;
  content: string;
  seo_title?: string;
  seo_description?: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly aiService: AiReviewService,
  ) {}

  async findAll(): Promise<Article[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error(`Fout bij ophalen artikelen: ${error}`);
      return [];
    }
  }

  async findByType(type: string): Promise<Article[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('articles')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error(`Fout bij ophalen artikelen type ${type}: ${error}`);
      return [];
    }
  }

  async findOne(id: string): Promise<Article> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundException(`Artikel ${id} niet gevonden`);
      return data;
    } catch (error) {
      this.logger.error(`Fout bij ophalen artikel ${id}: ${error}`);
      throw new NotFoundException(`Artikel ${id} niet gevonden`);
    }
  }

  async create(articleData: Partial<Article>): Promise<Article> {
    try {
      const article: Article = {
        id: uuidv4(),
        type: articleData.type || 'informative',
        title: articleData.title || '',
        category: articleData.category || 'algemeen',
        content: articleData.content || '',
        seo_title: articleData.seo_title,
        seo_description: articleData.seo_description,
        slug: this.generateSlug(articleData.title || ''),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabaseService
        .getClient()
        .from('articles')
        .insert(article)
        .select()
        .single();

      if (error) throw error;
      this.logger.log(`✅ Artikel aangemaakt: ${article.title}`);
      return data;
    } catch (error) {
      this.logger.error(`Fout bij aanmaken artikel: ${error}`);
      throw error;
    }
  }

  async generateArticle(type: string, topic: string, category: string): Promise<Article> {
    this.logger.log(`🤖 Genereer ${type} artikel over: ${topic} (${category})`);

    try {
      let prompt = '';
      
      if (type === 'guide') {
        prompt = `Schrijf een uitgebreide koopgids voor ${topic} in de categorie ${category}. 
Includeer: 
- Introductie
- Waar op te letten bij aankoop
- Top features
- Prijsklassen
- Conclusie en aanbeveling

Gebruik professionele Nederlandse taal en maak het SEO-vriendelijk.`;
      } else if (type === 'comparison') {
        prompt = `Schrijf een vergelijking van ${topic} producten in de categorie ${category}. 
Includeer:
- Overzicht van te vergelijken producten
- Voor- en nadelen per product
- Prijsvergelijking
- Beste keuze voor verschillende gebruikers
- Conclusie

Gebruik professionele Nederlandse taal.`;
      } else {
        prompt = `Schrijf een informatief artikel over "${topic}" in de categorie ${category}. 
Maak het praktisch, nuttig en SEO-geoptimaliseerd. 
Gebruik professionele Nederlandse taal met een vriendelijke toon.`;
      }

      const content = await this.aiService.generateContent(prompt, 1500);

      const article = await this.create({
        type: type as any,
        title: topic,
        category,
        content,
        seo_title: `${topic} | ProductPraat`,
        seo_description: content.substring(0, 155),
      });

      this.logger.log(`✅ AI artikel gegenereerd: ${article.title}`);
      return article;
    } catch (error) {
      this.logger.error(`Fout bij genereren artikel: ${error}`);
      throw error;
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      this.logger.log(`🗑️ Artikel verwijderd: ${id}`);
    } catch (error) {
      this.logger.error(`Fout bij verwijderen artikel ${id}: ${error}`);
      throw error;
    }
  }
}

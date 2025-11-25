import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { BolService } from '../bol/bol.service';
import { AiReviewService } from '../ai-review/ai-review.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private bolService: BolService,
    private aiReviewService: AiReviewService,
  ) {}

  async importProducts(categories: string[], limit: number = 5) {
    const supabase = this.supabaseService.getClient();
    let imported = 0;
    const errors = [];

    this.logger.log(`🚀 Start import voor ${categories.length} categorieën...`);

    for (const category of categories) {
      try {
        this.logger.log(`📦 Categorie: ${category}`);

        // 1. Haal producten op van Bol.com
        const bolProducts = await this.bolService.searchProducts(category, limit);

        if (bolProducts.length === 0) {
          this.logger.warn(`⚠️ Geen producten gevonden voor ${category}`);
          continue;
        }

        // 2. Voor elk product: genereer AI review en sla op
        for (const bolProduct of bolProducts) {
          try {
            // Check of product al bestaat (op basis van EAN)
            const { data: existing } = await supabase
              .from('products')
              .select('id')
              .eq('id', bolProduct.ean)
              .single();

            if (existing) {
              this.logger.log(`⏭️ Product ${bolProduct.ean} bestaat al, overslaan`);
              continue;
            }

            // Genereer AI review
            const aiReview = await this.aiReviewService.generateReview({
              title: bolProduct.title,
              price: bolProduct.price,
              category: category,
            });

            // Sla op in database
            const product = {
              id: bolProduct.ean,
              title: bolProduct.title,
              description: `${category} - ${bolProduct.title}`,
              price: bolProduct.price,
              category: category,
              image_url: bolProduct.image_url,
              affiliate_url: bolProduct.affiliate_url,
              ai_review: aiReview,
              created_at: new Date().toISOString(),
            };

            const { error } = await supabase.from('products').insert(product);

            if (error) {
              this.logger.error(`❌ Fout bij opslaan ${bolProduct.ean}:`, error.message);
              errors.push({ product: bolProduct.title, error: error.message });
            } else {
              imported++;
              this.logger.log(`✅ Product opgeslagen: ${bolProduct.title}`);
            }

            // Rate limiting: 2 seconden tussen AI calls
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (err) {
            this.logger.error(`❌ Fout bij verwerken product:`, err.message);
            errors.push({ product: bolProduct.title, error: err.message });
          }
        }
      } catch (err) {
        this.logger.error(`❌ Fout bij categorie ${category}:`, err.message);
        errors.push({ category, error: err.message });
      }
    }

    return {
      success: true,
      imported,
      categories: categories.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async getAllProducts() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('❌ Fout bij ophalen producten:', error.message);
      throw error;
    }

    this.logger.log(`✅ ${data?.length || 0} producten opgehaald`);
    return { products: data || [] };
  }

  async getProductsByCategory(category: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`❌ Fout bij ophalen categorie ${category}:`, error.message);
      throw error;
    }

    this.logger.log(`✅ ${data?.length || 0} producten opgehaald voor ${category}`);
    return { category, products: data || [] };
  }

  async getProductById(id: string) {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      this.logger.error(`❌ Product ${id} niet gevonden`);
      throw new NotFoundException(`Product met ID ${id} niet gevonden`);
    }

    this.logger.log(`✅ Product ${id} opgehaald`);
    return data;
  }
}
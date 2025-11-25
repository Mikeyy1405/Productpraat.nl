import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface BolProduct {
  ean: string;
  title: string;
  offerData: {
    offers: Array<{
      price: number;
      availabilityDescription: string;
    }>;
  };
  images?: Array<{
    url: string;
  }>;
}

@Injectable()
export class BolService {
  private readonly logger = new Logger(BolService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private configService: ConfigService) {}

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('BOL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('BOL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Bol.com credentials niet gevonden');
    }

    this.logger.log('🔑 Nieuwe Bol.com access token aanvragen...');

    try {
      const response = await axios.post(
        'https://login.bol.com/token',
        new URLSearchParams({
          grant_type: 'client_credentials',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = now + response.data.expires_in * 1000 - 60000; // 1 minuut marge
      this.logger.log('✅ Bol.com token verkregen');

      if (!this.accessToken) {
        throw new Error('Geen access token ontvangen van Bol.com');
      }

      return this.accessToken;
    } catch (error) {
      this.logger.error('❌ Fout bij ophalen Bol.com token:', error.message);
      throw error;
    }
  }

  async searchProducts(category: string, limit: number = 5): Promise<any[]> {
    const token = await this.getAccessToken();
    const searchTerms = this.getCategorySearchTerm(category);

    this.logger.log(`🔍 Zoeken naar '${searchTerms}' op Bol.com (max ${limit} resultaten)`);

    try {
      const response = await axios.get(
        `https://api.bol.com/catalog/v4/search`,
        {
          params: {
            q: searchTerms,
            limit: limit,
            country: 'NL',
          },
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.bol.com+json; version=4',
          },
        },
      );

      const products = response.data?.products || [];
      this.logger.log(`✅ ${products.length} producten gevonden`);

      return products.map((p: BolProduct) => ({
        ean: p.ean,
        title: p.title,
        price: p.offerData?.offers?.[0]?.price || 0,
        image_url: p.images?.[0]?.url || '',
        affiliate_url: this.generateAffiliateUrl(p.ean, p.title),
      }));
    } catch (error) {
      this.logger.error(`❌ Fout bij zoeken op Bol.com:`, error.response?.data || error.message);
      return [];
    }
  }

  private getCategorySearchTerm(category: string): string {
    const categoryMap: Record<string, string> = {
      elektronica: 'laptop notebook',
      wonen: 'stofzuiger wasmachine',
      sport: 'sporthorloge fitness tracker',
    };
    return categoryMap[category] || 'populair product';
  }

  private generateAffiliateUrl(ean: string, title: string): string {
    const siteId = this.configService.get<string>('BOL_SITE_ID') || '1296565';
    const productUrl = `https://www.bol.com/nl/p/${ean}`;
    return `https://partner.bol.com/click/click?p=2&t=url&s=${siteId}&f=TXL&url=${encodeURIComponent(productUrl)}&name=${encodeURIComponent(title)}`;
  }
}
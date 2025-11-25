import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('AIML_API_KEY');

    if (!apiKey) {
      this.logger.error('❌ Geen AIML API key gevonden in environment variables');
      throw new Error('AIML_API_KEY niet gevonden in .env file');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.aimlapi.com/v1',
    });

    this.logger.log('✅ AI Review service geïnitialiseerd (AIML API)');
  }

  async generateReview(product: {
    title: string;
    price: number;
    category: string;
  }): Promise<string> {
    this.logger.log(`🤖 Genereren review voor: ${product.title}`);

    const prompt = `Je bent een productreviewer voor ProductPraat.nl, een Nederlands vergelijkingsplatform.

Genereer een beknopte, informatieve review (max 200 woorden) voor het volgende product:

Product: ${product.title}
Prijs: €${product.price}
Categorie: ${product.category}

Vereisten:
- Schrijf in het Nederlands
- Geef een objectieve beoordeling
- Noem 2-3 belangrijke eigenschappen
- Geef advies over voor wie dit product geschikt is
- Professionele en vriendelijke toon
- GEEN HTML formatting, alleen platte tekst

Review:`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert productreviewer die heldere, eerlijke reviews schrijft in het Nederlands.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const review = completion.choices[0]?.message?.content?.trim() || 'Review kon niet gegenereerd worden.';
      this.logger.log(`✅ Review gegenereerd (${review.length} karakters)`);

      return review;
    } catch (error) {
      this.logger.error('❌ Fout bij genereren review:', error.message);
      return `Een ${product.category} product voor €${product.price}. Meer informatie volgt binnenkort.`;
    }
  }
}
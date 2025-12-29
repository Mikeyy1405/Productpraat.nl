/**
 * Claude AI Service for Product Review Generation
 * 
 * Uses AIML API (https://docs.aimlapi.com/) to access Claude models.
 * AIML API uses an OpenAI-compatible endpoint format, not the Anthropic Messages API.
 * 
 * Benefits of using AIML API:
 * - Access to 200+ AI models (Claude, GPT, Gemini, Llama, etc.)
 * - OpenAI-compatible format for easy model switching
 * - Uses native fetch (no SDK dependencies)
 * 
 * API Reference: https://docs.aimlapi.com/api-references/text-models-llm/anthropic/claude-sonnet-4-5
 */

import { Product } from '../types';

// AIML API Configuration
const AIML_API_ENDPOINT = 'https://api.aimlapi.com/v1/chat/completions';
const AIML_MODEL = 'anthropic/claude-sonnet-4.5';

// Type for AIML API response (OpenAI-compatible format)
interface AIMLChatResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Type for window.__ENV__ in production
interface WindowEnv {
  VITE_ANTHROPIC_API_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

declare global {
  interface Window {
    __ENV__?: WindowEnv;
  }
}

// Helper to get API key from environment (works in Vite)
const getApiKey = (): string => {
  // Check window.__ENV__ first (for production/Render)
  if (typeof window !== 'undefined' && window.__ENV__?.VITE_ANTHROPIC_API_KEY) {
    return window.__ENV__.VITE_ANTHROPIC_API_KEY;
  }
  // Fall back to import.meta.env (for local development)
  return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
};

// Helper to create URL friendly slugs
const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

// Helper to parse price string to number
const parsePrice = (priceStr: string): number => {
  if (!priceStr) return 0;
  // Remove currency symbols and normalize
  const cleaned = priceStr.replace(/[€$£]/g, '').replace(/\s/g, '').replace(',', '.');
  const match = cleaned.match(/[\d.]+/);
  if (match) {
    return parseFloat(match[0]) || 0;
  }
  return 0;
};

// Helper function to parse JSON from Claude's response
const parseJsonResponse = <T>(text: string): T => {
  // Try to extract JSON from the response - Claude might wrap it in markdown code blocks
  let jsonStr = text.trim();
  
  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  return JSON.parse(jsonStr);
};

// Helper to map category string to our predefined categories
const mapCategory = (cat: string): string => {
  const normalized = cat.toLowerCase();

  // === ELEKTRONICA ===
  if (normalized.includes('tv') || normalized.includes('televisie')) return 'televisies';
  if (normalized.includes('audio') || normalized.includes('speaker') || normalized.includes('koptelefoon') || normalized.includes('headphone') || normalized.includes('soundbar')) return 'audio';
  if (normalized.includes('laptop') || normalized.includes('notebook') || normalized.includes('chromebook')) return 'laptops';
  if (normalized.includes('phone') || normalized.includes('smartphone') || normalized.includes('mobiel') || normalized.includes('iphone') || normalized.includes('samsung galaxy')) return 'smartphones';
  if (normalized.includes('tablet') || normalized.includes('ipad')) return 'tablets';
  if (normalized.includes('gaming') || normalized.includes('playstation') || normalized.includes('xbox') || normalized.includes('nintendo') || normalized.includes('console')) return 'gaming';
  if (normalized.includes('computer') || normalized.includes('desktop') || normalized.includes('pc')) return 'computers';
  if (normalized.includes('monitor') || normalized.includes('beeldscherm')) return 'monitoren';
  if (normalized.includes('camera') || normalized.includes('foto')) return 'camera';
  if (normalized.includes('smartwatch') || normalized.includes('wearable') || normalized.includes('fitness tracker')) return 'wearables';

  // === HUISHOUDEN ===
  if (normalized.includes('wasmachine') || normalized.includes('washer')) return 'wasmachines';
  if (normalized.includes('droger') || normalized.includes('dryer')) return 'drogers';
  if (normalized.includes('stofzuiger') || normalized.includes('vacuum') || normalized.includes('robotstofzuiger')) return 'stofzuigers';
  if (normalized.includes('koelkast') || normalized.includes('fridge') || normalized.includes('vrieskast')) return 'koelkasten';
  if (normalized.includes('vaatwasser') || normalized.includes('dishwasher')) return 'vaatwassers';
  if (normalized.includes('magnetron') || normalized.includes('microwave')) return 'magnetrons';
  if (normalized.includes('oven') && !normalized.includes('magnetron')) return 'ovens';

  // === SMART HOME ===
  if (normalized.includes('smart home') || normalized.includes('domotica') || normalized.includes('google home') || normalized.includes('alexa')) return 'smarthome';
  if (normalized.includes('lamp') || normalized.includes('verlichting') || normalized.includes('philips hue')) return 'verlichting';
  if (normalized.includes('beveilig') || normalized.includes('camera') || normalized.includes('deurbel') || normalized.includes('alarm')) return 'beveiliging';

  // === SLAAPKAMER ===
  if (normalized.includes('matras')) return 'matrassen';
  if (normalized.includes('bed') || normalized.includes('boxspring')) return 'bedden';
  if (normalized.includes('dekbed')) return 'dekbedden';

  // === KEUKEN ===
  if (normalized.includes('airfryer') || normalized.includes('air fryer') || normalized.includes('hetelucht')) return 'airfryers';
  if (normalized.includes('koffie') || normalized.includes('coffee') || normalized.includes('espresso') || normalized.includes('nespresso')) return 'koffie';
  if (normalized.includes('keuken') || normalized.includes('kitchen') || normalized.includes('foodprocessor')) return 'keuken';
  if (normalized.includes('blender') || normalized.includes('smoothie')) return 'blenders';
  if (normalized.includes('waterkoker') || normalized.includes('kettle')) return 'waterkokers';
  if (normalized.includes('broodrooster') || normalized.includes('tosti') || normalized.includes('toaster')) return 'broodroosters';

  // === VERZORGING ===
  if (normalized.includes('scheer') || normalized.includes('trimmer') || normalized.includes('razor')) return 'scheerapparaten';
  if (normalized.includes('föhn') || normalized.includes('haar') || normalized.includes('stijltang') || normalized.includes('krultang')) return 'haarverzorging';
  if (normalized.includes('tandenborstel') || normalized.includes('waterflosser') || normalized.includes('oral')) return 'mondverzorging';
  if (normalized.includes('verzorging') || normalized.includes('beauty')) return 'verzorging';

  // === TUIN & KLUSSEN ===
  if (normalized.includes('grasmaaier') || normalized.includes('robotmaaier')) return 'grasmaaiers';
  if (normalized.includes('tuin') || normalized.includes('garden')) return 'tuin';
  if (normalized.includes('gereedschap') || normalized.includes('boor') || normalized.includes('schroef')) return 'gereedschap';

  // === SPORT & VRIJE TIJD ===
  if (normalized.includes('fiets') || normalized.includes('e-bike') || normalized.includes('elektrische fiets')) return 'fietsen';
  if (normalized.includes('fitness') || normalized.includes('hometrainer') || normalized.includes('loopband')) return 'fitness';
  if (normalized.includes('sport')) return 'sport';

  // === BABY & KIND ===
  if (normalized.includes('baby') || normalized.includes('kinderwagen') || normalized.includes('autostoel')) return 'baby';
  if (normalized.includes('speelgoed') || normalized.includes('lego') || normalized.includes('toy')) return 'speelgoed';

  // === BEAUTY & GEZONDHEID ===
  if (normalized.includes('make-up') || normalized.includes('makeup') || normalized.includes('cosmetica')) return 'beauty';
  if (normalized.includes('gezondheid') || normalized.includes('bloeddruk') || normalized.includes('weegschaal')) return 'gezondheid';

  return 'overig';
};

interface ProductReviewInput {
  url: string;
  scrapedContent: string;
  title?: string;
  description?: string;
  images?: string[];
  price?: string;
}

/**
 * Generates a complete product review from scraped content using Claude AI
 */
export const generateProductReview = async (input: ProductReviewInput): Promise<Product | null> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.error('VITE_ANTHROPIC_API_KEY is not configured');
    throw new Error('AI API key niet geconfigureerd. Stel VITE_ANTHROPIC_API_KEY in.');
  }

  const systemPrompt = `Je bent de Hoofdredacteur van ProductPraat.nl, dé autoriteit op het gebied van product reviews in Nederland.
Je ontvangt content van een productpagina (Bol.com, Amazon, Coolblue, etc.) en genereert een ZEER UITGEBREIDE en PROFESSIONELE review.

KRITIEKE VEREISTEN - Zorg ervoor dat ALLE velden volledig zijn ingevuld:

1. Identificeer het product:
   - title: Volledige productnaam
   - brand: Merk van het product
   - model: Modelnaam/nummer (zonder merk)
   
2. Schrijf SEO-geoptimaliseerde content:
   - description: Korte wervende samenvatting (2-3 zinnen, 150-200 karakters)
   - seoDescription: SEO meta description (exact 155-160 karakters, bevat merk + model + belangrijkste USP)
   
3. reviewContent: Schrijf 5 unieke, diepgaande secties:
   - whatIsIt: Wat is dit product? Introductie en context (150+ woorden)
   - forWho: Voor wie is dit product? Doelgroepen en use cases (100+ woorden)
   - keyFeatures: Belangrijkste features en wat ze uniek maakt (150+ woorden)
   - whatToConsider: Waar let je op bij aankoop? Aandachtspunten (100+ woorden)
   - verdict: Eindoordeel en aanbeveling (100+ woorden)

4. scores: Geef realistische scores (1-10) voor:
   - quality: Algehele kwaliteit en afwerking
   - priceValue: Prijs-kwaliteitverhouding
   - usability: Gebruiksgemak
   - design: Design en uiterlijk

5. pros: Minimaal 4-6 concrete voordelen
6. cons: Minimaal 2-4 eerlijke nadelen

7. features: Belangrijkste productkenmerken (4-6 items)

8. specifications: Technische specificaties als array van {label, value} (minimaal 4-5)

9. targetAudience: 3-4 specifieke doelgroepen

10. alternatives: 2-3 alternatieve producten om te overwegen

11. faq: 3-5 veelgestelde vragen met uitgebreide antwoorden

12. Prijs en categorie:
    - price: Prijs als string (bijv. "€299,00")
    - priceLabel: Prijsindicatie (bijv. "€299,-" of "Vanaf €249,-")
    - category: Een van: televisies, audio, laptops, smartphones, wasmachines, stofzuigers, smarthome, matrassen, airfryers, koffie, keuken, verzorging

13. rating: Geef een realistische score (1-10, 1 decimaal)

14. tags: 4-6 relevante tags/keywords

15. reviewAuthor: Expert auteur met:
    - name: Redactienaam
    - role: Functie (bijv. "Productexpert")
    - summary: Korte bio

STIJLRICHTLIJNEN:
- Schrijf in het Nederlands
- Wees specifiek en concreet, geen vage algemene statements
- Gebruik cijfers en feiten waar mogelijk
- Schrijf alsof je een echte expert bent die het product kent
- Maak het levendig en boeiend om te lezen
- Wees eerlijk over nadelen

BELANGRIJK: Retourneer ALLEEN een valide JSON object met de volgende structuur:
{
  "title": "string",
  "brand": "string",
  "model": "string",
  "description": "string",
  "seoDescription": "string",
  "category": "string",
  "price": "string",
  "priceLabel": "string",
  "rating": number,
  "tags": ["string"],
  "pros": ["string"],
  "cons": ["string"],
  "features": ["string"],
  "reviewContent": {
    "whatIsIt": "string",
    "forWho": "string",
    "keyFeatures": "string",
    "whatToConsider": "string",
    "verdict": "string"
  },
  "specifications": [{"label": "string", "value": "string"}],
  "scores": {
    "quality": number,
    "priceValue": number,
    "usability": number,
    "design": number
  },
  "targetAudience": ["string"],
  "alternatives": ["string"],
  "faq": [{"question": "string", "answer": "string"}],
  "reviewAuthor": {
    "name": "string",
    "role": "string",
    "summary": "string"
  }
}

Retourneer ALLEEN de JSON, geen andere tekst of uitleg.`;

  try {
    const userPrompt = `URL: ${input.url}

${input.title ? `Titel van pagina: ${input.title}\n` : ''}
${input.description ? `Beschrijving: ${input.description}\n` : ''}
${input.price ? `Gevonden prijs: ${input.price}\n` : ''}

CONTENT VAN DE PRODUCTPAGINA:
${input.scrapedContent}

Genereer een complete product review. Retourneer alleen de JSON.`;

    // Call AIML API using OpenAI-compatible format
    const response = await fetch(AIML_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AIML_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AIML API error:', response.status, errorText);
      throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json() as AIMLChatResponse;
    
    if (!responseData.choices || responseData.choices.length === 0) {
      throw new Error('No response from AI model');
    }

    const textContent = responseData.choices[0].message.content;
    if (!textContent) {
      throw new Error('Unexpected response type from AI');
    }

    const data = parseJsonResponse<{
      title: string;
      brand: string;
      model: string;
      description: string;
      seoDescription: string;
      category: string;
      price: string;
      priceLabel: string;
      rating: number;
      tags: string[];
      pros: string[];
      cons: string[];
      features: string[];
      reviewContent: {
        whatIsIt: string;
        forWho: string;
        keyFeatures: string;
        whatToConsider: string;
        verdict: string;
      };
      specifications: Array<{ label: string; value: string }>;
      scores: {
        quality: number;
        priceValue: number;
        usability: number;
        design: number;
      };
      targetAudience: string[];
      alternatives: string[];
      faq: Array<{ question: string; answer: string }>;
      reviewAuthor: {
        name: string;
        role: string;
        summary: string;
      };
    }>(textContent);

    if (!data.title) {
      throw new Error('Incomplete product generation - missing title');
    }

    // Generate slug
    const slug = createSlug(`${data.brand} ${data.model}`);
    
    // Use provided images or generate placeholder
    const imageUrl = input.images && input.images.length > 0 
      ? input.images[0]
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(data.title)}&background=0f172a&color=3b82f6&size=400&font-size=0.33`;
    
    const galleryImages = input.images && input.images.length > 1 
      ? input.images.slice(0, 5) 
      : [imageUrl];

    // Convert specifications array to specs object for backward compatibility
    const specsObject: Record<string, string> = {};
    if (data.specifications) {
      data.specifications.forEach(spec => {
        specsObject[spec.label] = spec.value;
      });
    }

    // Build the Product object with both new and legacy fields for compatibility
    const product: Product = {
      // Required legacy fields
      id: `url-${Date.now()}`,
      brand: data.brand,
      model: data.model,
      price: parsePrice(data.price), // Convert string price to number for backward compatibility
      score: data.rating, // Map rating to score for compatibility
      category: mapCategory(data.category),
      image: imageUrl, // Legacy image field
      specs: specsObject, // Legacy specs format
      pros: data.pros,
      cons: data.cons,
      
      // New fields for URL-based import
      slug,
      title: data.title,
      description: data.description,
      seoDescription: data.seoDescription,
      priceLabel: data.priceLabel,
      rating: data.rating,
      imageUrl,
      galleryImages,
      images: galleryImages, // Also set images array for compatibility
      affiliateLink: input.url,
      affiliateUrl: input.url, // Legacy field
      tags: data.tags,
      keywords: data.tags, // Also set keywords for SEO
      features: data.features,
      reviewContent: data.reviewContent,
      specifications: data.specifications,
      scores: data.scores,
      // Map scores to scoreBreakdown for compatibility
      scoreBreakdown: {
        design: data.scores.design,
        usability: data.scores.usability,
        performance: data.scores.quality,
        value: data.scores.priceValue
      },
      targetAudience: data.targetAudience,
      alternatives: data.alternatives,
      faq: data.faq,
      reviewAuthor: {
        ...data.reviewAuthor,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.reviewAuthor.name)}&background=random&color=fff`
      },
      updatedAt: new Date().toISOString(),
      isAiGenerated: true
    };

    return product;

  } catch (error) {
    console.error('Product review generation failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Product review generatie mislukt. Probeer opnieuw.');
  }
};

/**
 * Quick product info extraction without full review
 * Useful for previewing before full generation
 */
export const extractProductInfo = async (url: string, scrapedContent: string): Promise<{
  title: string;
  brand: string;
  price?: string;
  category: string;
}> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error('AI API key niet geconfigureerd');
  }

  const systemPrompt = 'Extraheer de basis productinformatie uit de gegeven content. Retourneer alleen JSON: {"title": "string", "brand": "string", "price": "string", "category": "string"}';
  const userPrompt = `URL: ${url}\n\nContent: ${scrapedContent.substring(0, 5000)}`;

  // Call AIML API using OpenAI-compatible format
  const response = await fetch(AIML_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AIML_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AIML API error:', response.status, errorText);
    throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json() as AIMLChatResponse;
  
  if (!responseData.choices || responseData.choices.length === 0) {
    throw new Error('No response from AI model');
  }

  const textContent = responseData.choices[0].message.content;
  if (!textContent) {
    throw new Error('Unexpected response type');
  }

  return parseJsonResponse(textContent);
};

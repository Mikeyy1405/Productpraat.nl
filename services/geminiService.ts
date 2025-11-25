import OpenAI from "openai";
import { Product, ContentSuggestion, Article, ArticleType } from '../types';

// --- CONFIGURATION ---
const AIML_API_KEY = "8e956fb28c9048cf9bf23099b93d222a";
const BASE_URL = "https://api.aimlapi.com/v1";

// We gebruiken de OpenAI SDK omdat AIML API 'OpenAI Compatible' is.
const openai = new OpenAI({
  apiKey: AIML_API_KEY,
  baseURL: BASE_URL,
  dangerouslyAllowBrowser: true // Client-side execution toegestaan
});

// SPECIFIEK MODEL VERZOCHT DOOR GEBRUIKER (Claude 4.5 Sonnet)
const MODEL_REVIEW = "claude-sonnet-4-5-20250929"; 
const MODEL_STRATEGY = "claude-sonnet-4-5-20250929";

// --- PROMPT STRUCTURES ---
const PRODUCT_JSON_TEMPLATE = `
{
    "brand": "string",
    "model": "string",
    "price": number,
    "score": number (0-10, 1 decimaal),
    "category": "string (kies uit: televisies, audio, laptops, smartphones, wasmachines, stofzuigers, smarthome, matrassen, airfryers, koffie, keuken, verzorging)",
    "specs": { "SpecNaam": "Waarde" },
    "pros": ["punt 1", "punt 2"],
    "cons": ["punt 1", "punt 2"],
    "description": "Korte wervende samenvatting (2 zinnen)",
    "longDescription": "Uitgebreide introductie over het product en voor wie het is.",
    "expertOpinion": "Onze deskundige mening over de prestaties en waarde.",
    "userReviewsSummary": "Samenvatting van wat gebruikers online zeggen.",
    "scoreBreakdown": { "design": 0, "usability": 0, "performance": 0, "value": 0 },
    "suitability": { "goodFor": ["situatie 1"], "badFor": ["situatie 2"] },
    "faq": [{ "question": "Vraag", "answer": "Antwoord" }],
    "predicate": "test" | "buy" | null
}
`;

export const generateProductFromInput = async (rawText: string): Promise<Partial<Product>> => {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_REVIEW,
      messages: [
        {
          role: "system",
          content: `Je bent een expert product reviewer voor ProductPraat.nl. 
          Schrijf een eerlijke, diepgaande review in het Nederlands.
          Context: Het is 2026.
          
          BELANGRIJK: Je output MOET valide JSON zijn die exact deze structuur volgt:
          ${PRODUCT_JSON_TEMPLATE}`
        },
        {
          role: "user",
          content: `Genereer review data voor:\n${rawText}`
        }
      ],
      max_tokens: 3000,
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("Geen data ontvangen van AI");
    
    // Probeer JSON te parsen (soms zit er markdown omheen)
    const cleanJson = content.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("AIML Product Error:", error);
    // Fallback voor als JSON faalt, zodat de app niet crasht
    return {
        brand: "Onbekend",
        model: "Import Fout",
        description: "Er ging iets mis bij het genereren van de review."
    };
  }
};

export const generateContentStrategy = async (categoryName: string, existingProducts: Product[]): Promise<ContentSuggestion[]> => {
    try {
        const existingNames = existingProducts.map(p => `${p.brand} ${p.model}`).join(", ");
        
        const completion = await openai.chat.completions.create({
            model: MODEL_STRATEGY,
            messages: [
                {
                    role: "system",
                    content: `Je bent een SEO Content Strateeg.
                    Output MOET JSON zijn: { "suggestions": [{ "topic": "...", "type": "review|comparison|guide", "priority": "high", "reasoning": "...", "searchQuery": "..." }] }`
                },
                {
                    role: "user",
                    content: `Categorie: '${categoryName}'.\nReeds in database: ${existingNames}.\nGeef 5 suggesties.`
                }
            ],
            max_tokens: 2000
        });

        const content = completion.choices[0].message.content || "{}";
        const cleanJson = content.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(cleanJson).suggestions || [];

    } catch (e) {
        console.error("AIML Strategy Error", e);
        return [];
    }
};

export const generateArticle = async (type: ArticleType, topic: string, category: string): Promise<Partial<Article>> => {
    try {
        const typeInstruction = {
            'comparison': `Gebruik een HTML <table class="w-full text-left border-collapse border border-slate-700 mb-6"> voor specs. Headers met bg-slate-800.`,
            'list': `Maak een Top 5. Gebruik <h2> voor productnamen en <ul> voor pluspunten.`,
            'guide': `Schrijf een 'Ultieme Koopgids' (Long-form, 1500+ woorden).
            Gebruik deze HTML structuur:
            <h2>Introductie</h2>
            <p>Pakkende inleiding over trends in 2026.</p>
            
            <h2>Waar moet je op letten bij een ${category}?</h2>
            <p>Uitleg.</p>
            
            <h3>1. Belangrijkste Specificatie (bijv. Capaciteit/Formaat)</h3>
            <p>Detail uitleg.</p>
            
            <h3>2. Duurzaamheid & Energie</h3>
            <p>Uitleg.</p>
            
            <h3>3. Slimme Functies</h3>
            <p>Uitleg.</p>

            <h2>Veelgestelde Vragen</h2>
            <p>Beantwoord 3 relevante vragen.</p>

            <h2>Conclusie</h2>
            <p>Samenvatting.</p>`
        }[type];

        const completion = await openai.chat.completions.create({
            model: MODEL_REVIEW,
            messages: [
                {
                    role: "system",
                    content: `Je bent de hoofdredacteur van ProductPraat.nl.
                    Schrijf een uitgebreid artikel in perfect Nederlands.
                    Gebruik HTML tags (h2, h3, p, ul, li, strong, table).
                    GEEN markdown blokken, alleen de raw HTML string in de JSON.
                    
                    Output JSON:
                    {
                        "title": "Pakkende Titel",
                        "summary": "Korte samenvatting (30 woorden)",
                        "htmlContent": "De volledige HTML content...",
                        "imageUrl": ""
                    }`
                },
                {
                    role: "user",
                    content: `Onderwerp: ${topic}\nType: ${type}\nCategorie: ${category}\n${typeInstruction}`
                }
            ],
            max_tokens: 6000
        });

        const content = completion.choices[0].message.content || "{}";
        const cleanJson = content.replace(/```json\n?|\n?```/g, "").trim();
        const data = JSON.parse(cleanJson);
        
        if (!data.imageUrl) {
            data.imageUrl = `https://placehold.co/800x400/1e293b/ffffff?text=${encodeURIComponent(topic.substring(0,20))}`;
        }

        return data;

    } catch (error) {
        console.error("AIML Article Error", error);
        throw error;
    }
};
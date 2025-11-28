
import { Product } from '../types';

/**
 * Sample products voor demo/fallback wanneer Supabase niet beschikbaar is.
 * Deze worden getoond op de homepage als de database geen producten kan ophalen.
 */
export const SAMPLE_PRODUCTS: Product[] = [
    {
        id: 'sample-1',
        brand: 'Samsung',
        model: 'EcoBubble WW90T534DAW',
        price: 599,
        score: 8.7,
        category: 'wasmachines',
        image: 'https://media.s-bol.com/gBPzYgzV46RA/550x730.jpg',
        slug: 'samsung-ecobubble-ww90t534daw',
        specs: {
            'Vulgewicht': '9 kg',
            'Toerental': '1400 tpm',
            'Energieklasse': 'A',
            'Geluidsniveau': '73 dB'
        },
        pros: ['Uitstekende wasresultaten', 'Energiezuinig', 'Stil in gebruik'],
        cons: ['Hogere aanschafprijs', 'App kan soms haperen'],
        description: 'De Samsung EcoBubble is een premium wasmachine met uitstekende wasresultaten en moderne functies.',
        affiliateUrl: 'https://www.bol.com/nl/nl/p/samsung-ww90t534daw-ecobubble-wasmachine-9-kg/9300000030548674/'
    },
    {
        id: 'sample-2',
        brand: 'LG',
        model: 'OLED55C3',
        price: 1299,
        score: 9.2,
        category: 'televisies',
        image: 'https://media.s-bol.com/gO7vJVQpAYNr/550x412.jpg',
        slug: 'lg-oled55c3',
        specs: {
            'Schermdiagonaal': '55 inch',
            'Type scherm': 'OLED',
            'Verversing': '120 Hz',
            'HDMI 2.1': 'Ja'
        },
        pros: ['Perfect zwart', 'Geweldige kleuren', 'Ideaal voor gaming'],
        cons: ['Burn-in risico bij statische beelden', 'Niet het helderst voor lichte kamers'],
        description: 'De LG OLED55C3 is een top-tier OLED televisie met perfecte zwartniveaus en gaming features.',
        affiliateUrl: 'https://www.bol.com/nl/nl/p/lg-oled55c36lc-55-inch-oled-tv/9300000147520867/'
    },
    {
        id: 'sample-3',
        brand: 'Dyson',
        model: 'V15 Detect',
        price: 749,
        score: 9.0,
        category: 'stofzuigers',
        image: 'https://media.s-bol.com/g1z0r2W0mxWL/550x478.jpg',
        slug: 'dyson-v15-detect',
        specs: {
            'Type': 'Snoerloos',
            'Gebruiksduur': '60 minuten',
            'Geluidsniveau': '78 dB',
            'Gewicht': '3.1 kg'
        },
        pros: ['Krachtige zuigkracht', 'Laser toont stof', 'Lange batterijduur'],
        cons: ['Hoge prijs', 'Stofbak relatief klein'],
        description: 'De Dyson V15 Detect is de meest geavanceerde snoerloze stofzuiger met innovatieve lasertechnologie.',
        affiliateUrl: 'https://www.bol.com/nl/nl/p/dyson-v15-detect-absolute-snoerloze-stofzuiger/9300000030769743/'
    },
    {
        id: 'sample-4',
        brand: 'Apple',
        model: 'MacBook Air M3',
        price: 1299,
        score: 9.1,
        category: 'laptops',
        image: 'https://media.s-bol.com/gOzNn2AVkVNk/550x366.jpg',
        slug: 'apple-macbook-air-m3',
        specs: {
            'Processor': 'Apple M3',
            'RAM geheugen': '8 GB',
            'Opslag': '256 GB SSD',
            'Scherm': '13.6 inch Liquid Retina'
        },
        pros: ['Razendsnelle M3 chip', 'Fantastische batterijduur', 'Stijlvol design'],
        cons: ['Beperkte opslag in basismodel', 'Geen touchscreen'],
        description: 'De nieuwe MacBook Air met M3 chip biedt ongekende prestaties in een dun en licht ontwerp.',
        affiliateUrl: 'https://www.bol.com/nl/nl/p/apple-macbook-air-13-3-inch-m3-8gb-256gb-spacegrijs/9300000177469534/'
    }
];

// Deze lijst is nu leeg zodat de applicatie met een schone lei begint.
// Nieuwe producten worden toegevoegd via de Admin Auto-Pilot.
export const REAL_PRODUCTS: Product[] = [];

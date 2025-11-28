
import { Product } from '../types';

// Demo producten voor wanneer de database niet beschikbaar is
// Deze producten worden getoond als fallback op de homepage
export const DEMO_PRODUCTS: Product[] = [
    {
        id: 'demo-1',
        brand: 'Samsung',
        model: 'Galaxy S24 Ultra',
        price: 1349,
        score: 9.2,
        category: 'smartphones',
        image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=400&fit=crop',
        slug: 'samsung-galaxy-s24-ultra-review',
        specs: {
            'Schermgrootte': '6.8 inch',
            'Camera (MP)': '200 MP',
            'Opslag': '256 GB',
            'Batterij': '5000 mAh'
        },
        pros: ['Uitstekende camera', 'Lange batterijduur', 'Krachtige processor'],
        cons: ['Hoge prijs', 'Groot en zwaar'],
        description: 'De Samsung Galaxy S24 Ultra is de ultieme smartphone voor veeleisende gebruikers.',
        affiliateUrl: 'https://www.bol.com/nl/p/samsung-galaxy-s24-ultra/'
    },
    {
        id: 'demo-2',
        brand: 'Apple',
        model: 'MacBook Pro 14"',
        price: 2499,
        score: 9.4,
        category: 'laptops',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop',
        slug: 'apple-macbook-pro-14-review',
        specs: {
            'Processor': 'Apple M3 Pro',
            'RAM geheugen': '18 GB',
            'Opslag': '512 GB SSD',
            'Scherm': '14.2 inch Liquid Retina XDR'
        },
        pros: ['Enorme prestaties', 'Prachtig scherm', 'Uitstekende batterij'],
        cons: ['Premium prijs', 'Beperkte poorten'],
        description: 'De MacBook Pro 14" met M3 Pro chip biedt ongekende prestaties voor professionals.',
        affiliateUrl: 'https://www.bol.com/nl/p/apple-macbook-pro-14/'
    },
    {
        id: 'demo-3',
        brand: 'Philips',
        model: 'Airfryer XXL HD9285',
        price: 229,
        score: 8.8,
        category: 'airfryers',
        image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=400&fit=crop',
        slug: 'philips-airfryer-xxl-hd9285-review',
        specs: {
            'Laadvermogen (kg)': '1.4 kg',
            'Programmas': '7 programmas',
            'Vaatwasserbestendig': 'Ja'
        },
        pros: ['Grote capaciteit', 'Eenvoudig te reinigen', 'Snelle opwarming'],
        cons: ['Neemt veel ruimte in', 'Kan luidruchtig zijn'],
        description: 'De Philips Airfryer XXL is ideaal voor gezinnen en kookt snel en gezond.',
        affiliateUrl: 'https://www.bol.com/nl/p/philips-airfryer-xxl/'
    },
    {
        id: 'demo-4',
        brand: 'LG',
        model: 'OLED C3 55"',
        price: 1299,
        score: 9.1,
        category: 'televisies',
        image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=400&fit=crop',
        slug: 'lg-oled-c3-55-review',
        specs: {
            'Schermdiagonaal': '55 inch',
            'Type scherm': 'OLED',
            'Verversing (Hz)': '120 Hz',
            'HDMI 2.1': 'Ja'
        },
        pros: ['Perfecte zwartwaarden', 'Oneindig contrast', 'Geweldig voor gaming'],
        cons: ['Risico op inbranden', 'Niet de helderste'],
        description: 'De LG OLED C3 biedt een ongeëvenaarde kijkervaring met perfecte zwartwaarden.',
        affiliateUrl: 'https://www.bol.com/nl/p/lg-oled-c3-55/'
    }
];

// Deze lijst is nu leeg zodat de applicatie met een schone lei begint.
// Nieuwe producten worden toegevoegd via de Admin Auto-Pilot.
export const REAL_PRODUCTS: Product[] = [];

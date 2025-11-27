/**
 * Multi-Language Components
 * 
 * Language selector and i18n support.
 * Only renders when the 'multi_language' feature is enabled.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

type Language = 'nl' | 'en' | 'de' | 'fr';

interface Translations {
    [key: string]: string | Translations;
}

interface LanguageContextValue {
    currentLanguage: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string>) => string;
    availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'writgo_language';

// Default translations
const defaultTranslations: Record<Language, Translations> = {
    nl: {
        common: {
            search: 'Zoeken',
            home: 'Home',
            products: 'Producten',
            articles: 'Artikelen',
            contact: 'Contact',
            about: 'Over ons',
            readMore: 'Lees meer',
            viewAll: 'Bekijk alles',
            loadMore: 'Meer laden',
            back: 'Terug',
            next: 'Volgende',
            previous: 'Vorige',
            submit: 'Versturen',
            cancel: 'Annuleren',
            save: 'Opslaan',
            delete: 'Verwijderen',
            edit: 'Bewerken',
            close: 'Sluiten',
            yes: 'Ja',
            no: 'Nee'
        },
        cart: {
            addToCart: 'In winkelwagen',
            removeFromCart: 'Verwijderen',
            checkout: 'Afrekenen',
            total: 'Totaal',
            empty: 'Je winkelwagen is leeg'
        },
        wishlist: {
            addToWishlist: 'Toevoegen aan verlanglijst',
            removeFromWishlist: 'Verwijderen uit verlanglijst',
            empty: 'Je verlanglijst is leeg'
        },
        auth: {
            login: 'Inloggen',
            logout: 'Uitloggen',
            register: 'Registreren',
            email: 'E-mailadres',
            password: 'Wachtwoord',
            confirmPassword: 'Bevestig wachtwoord',
            forgotPassword: 'Wachtwoord vergeten?',
            rememberMe: 'Onthoud mij'
        },
        footer: {
            copyright: '© {year} Alle rechten voorbehouden',
            privacy: 'Privacybeleid',
            terms: 'Algemene voorwaarden'
        }
    },
    en: {
        common: {
            search: 'Search',
            home: 'Home',
            products: 'Products',
            articles: 'Articles',
            contact: 'Contact',
            about: 'About us',
            readMore: 'Read more',
            viewAll: 'View all',
            loadMore: 'Load more',
            back: 'Back',
            next: 'Next',
            previous: 'Previous',
            submit: 'Submit',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            close: 'Close',
            yes: 'Yes',
            no: 'No'
        },
        cart: {
            addToCart: 'Add to cart',
            removeFromCart: 'Remove',
            checkout: 'Checkout',
            total: 'Total',
            empty: 'Your cart is empty'
        },
        wishlist: {
            addToWishlist: 'Add to wishlist',
            removeFromWishlist: 'Remove from wishlist',
            empty: 'Your wishlist is empty'
        },
        auth: {
            login: 'Login',
            logout: 'Logout',
            register: 'Register',
            email: 'Email address',
            password: 'Password',
            confirmPassword: 'Confirm password',
            forgotPassword: 'Forgot password?',
            rememberMe: 'Remember me'
        },
        footer: {
            copyright: '© {year} All rights reserved',
            privacy: 'Privacy policy',
            terms: 'Terms of service'
        }
    },
    de: {
        common: {
            search: 'Suchen',
            home: 'Startseite',
            products: 'Produkte',
            articles: 'Artikel',
            contact: 'Kontakt',
            about: 'Über uns',
            readMore: 'Mehr lesen',
            viewAll: 'Alle ansehen',
            loadMore: 'Mehr laden',
            back: 'Zurück',
            next: 'Weiter',
            previous: 'Zurück',
            submit: 'Absenden',
            cancel: 'Abbrechen',
            save: 'Speichern',
            delete: 'Löschen',
            edit: 'Bearbeiten',
            close: 'Schließen',
            yes: 'Ja',
            no: 'Nein'
        },
        cart: {
            addToCart: 'In den Warenkorb',
            removeFromCart: 'Entfernen',
            checkout: 'Zur Kasse',
            total: 'Gesamt',
            empty: 'Ihr Warenkorb ist leer'
        },
        wishlist: {
            addToWishlist: 'Zur Wunschliste hinzufügen',
            removeFromWishlist: 'Von Wunschliste entfernen',
            empty: 'Ihre Wunschliste ist leer'
        },
        auth: {
            login: 'Anmelden',
            logout: 'Abmelden',
            register: 'Registrieren',
            email: 'E-Mail-Adresse',
            password: 'Passwort',
            confirmPassword: 'Passwort bestätigen',
            forgotPassword: 'Passwort vergessen?',
            rememberMe: 'Angemeldet bleiben'
        },
        footer: {
            copyright: '© {year} Alle Rechte vorbehalten',
            privacy: 'Datenschutz',
            terms: 'AGB'
        }
    },
    fr: {
        common: {
            search: 'Rechercher',
            home: 'Accueil',
            products: 'Produits',
            articles: 'Articles',
            contact: 'Contact',
            about: 'À propos',
            readMore: 'Lire la suite',
            viewAll: 'Voir tout',
            loadMore: 'Charger plus',
            back: 'Retour',
            next: 'Suivant',
            previous: 'Précédent',
            submit: 'Envoyer',
            cancel: 'Annuler',
            save: 'Enregistrer',
            delete: 'Supprimer',
            edit: 'Modifier',
            close: 'Fermer',
            yes: 'Oui',
            no: 'Non'
        },
        cart: {
            addToCart: 'Ajouter au panier',
            removeFromCart: 'Supprimer',
            checkout: 'Commander',
            total: 'Total',
            empty: 'Votre panier est vide'
        },
        wishlist: {
            addToWishlist: 'Ajouter à la liste de souhaits',
            removeFromWishlist: 'Retirer de la liste de souhaits',
            empty: 'Votre liste de souhaits est vide'
        },
        auth: {
            login: 'Connexion',
            logout: 'Déconnexion',
            register: 'S\'inscrire',
            email: 'Adresse e-mail',
            password: 'Mot de passe',
            confirmPassword: 'Confirmer le mot de passe',
            forgotPassword: 'Mot de passe oublié?',
            rememberMe: 'Se souvenir de moi'
        },
        footer: {
            copyright: '© {year} Tous droits réservés',
            privacy: 'Politique de confidentialité',
            terms: 'Conditions d\'utilisation'
        }
    }
};

// Language labels and flags
const languageInfo: Record<Language, { name: string; flag: string; nativeName: string }> = {
    nl: { name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
    en: { name: 'English', flag: '🇬🇧', nativeName: 'English' },
    de: { name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    fr: { name: 'French', flag: '🇫🇷', nativeName: 'Français' }
};

interface LanguageProviderProps {
    children: ReactNode;
    defaultLanguage?: Language;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
    children,
    defaultLanguage = 'nl'
}) => {
    const { settings } = useFeatureToggle('multi_language');
    const availableLanguages = (settings?.availableLanguages as Language[]) || ['nl', 'en'];
    
    const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as Language;
        return saved && availableLanguages.includes(saved) ? saved : defaultLanguage;
    });

    const setLanguage = useCallback((lang: Language) => {
        setCurrentLanguage(lang);
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.lang = lang;
    }, []);

    const t = useCallback((key: string, params?: Record<string, string>): string => {
        const keys = key.split('.');
        let value: any = defaultTranslations[currentLanguage];
        
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
        }
        
        if (typeof value !== 'string') {
            // Fallback to English, then to Dutch, then to key
            value = keys.reduce((obj, k) => obj?.[k], defaultTranslations.en as any)
                || keys.reduce((obj, k) => obj?.[k], defaultTranslations.nl as any)
                || key;
        }
        
        // Replace parameters
        if (params && typeof value === 'string') {
            Object.entries(params).forEach(([k, v]) => {
                value = value.replace(`{${k}}`, v);
            });
        }
        
        return value;
    }, [currentLanguage]);

    useEffect(() => {
        document.documentElement.lang = currentLanguage;
    }, [currentLanguage]);

    return (
        <LanguageContext.Provider value={{ currentLanguage, setLanguage, t, availableLanguages }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextValue => {
    const context = useContext(LanguageContext);
    if (!context) {
        // Return a default implementation if not within provider
        return {
            currentLanguage: 'nl',
            setLanguage: () => {},
            t: (key) => key,
            availableLanguages: ['nl', 'en']
        };
    }
    return context;
};

interface LanguageSelectorProps {
    variant?: 'dropdown' | 'buttons' | 'minimal';
    className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
    variant = 'dropdown',
    className = ''
}) => {
    const enabled = useFeature('multi_language');
    const { currentLanguage, setLanguage, availableLanguages } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    if (!enabled) return null;

    // Buttons variant
    if (variant === 'buttons') {
        return (
            <div className={`flex gap-1 ${className}`}>
                {availableLanguages.map(lang => (
                    <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            currentLanguage === lang
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        {languageInfo[lang].flag} {lang.toUpperCase()}
                    </button>
                ))}
            </div>
        );
    }

    // Minimal variant
    if (variant === 'minimal') {
        return (
            <div className={`relative ${className}`}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                    <span className="text-lg">{languageInfo[currentLanguage].flag}</span>
                    <i className="fas fa-chevron-down text-xs"></i>
                </button>
                
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                        <div className="absolute right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                            {availableLanguages.map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => {
                                        setLanguage(lang);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition ${
                                        currentLanguage === lang
                                            ? 'bg-blue-600/20 text-white'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    <span>{languageInfo[lang].flag}</span>
                                    <span>{languageInfo[lang].nativeName}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Dropdown variant (default)
    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white hover:border-slate-600 transition"
            >
                <span className="text-lg">{languageInfo[currentLanguage].flag}</span>
                <span>{languageInfo[currentLanguage].nativeName}</span>
                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-xs text-slate-400`}></i>
            </button>
            
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute left-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-full">
                        {availableLanguages.map(lang => (
                            <button
                                key={lang}
                                onClick={() => {
                                    setLanguage(lang);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 transition ${
                                    currentLanguage === lang
                                        ? 'bg-blue-600/20 text-white'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <span>{languageInfo[lang].flag}</span>
                                <span>{languageInfo[lang].nativeName}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default LanguageSelector;

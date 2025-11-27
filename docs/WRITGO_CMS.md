# WritgoCMS - Documentatie

## Inhoudsopgave

1. [Introductie](#introductie)
2. [Template Systeem](#template-systeem)
3. [Feature Toggle Systeem](#feature-toggle-systeem)
4. [Nieuwe Template Toevoegen](#nieuwe-template-toevoegen)
5. [Nieuwe Feature Toevoegen](#nieuwe-feature-toevoegen)
6. [CMS Context API](#cms-context-api)
7. [Migratie van Productpraat](#migratie-van-productpraat)

---

## Introductie

WritgoCMS is een flexibel Content Management Systeem dat is gebouwd bovenop de bestaande Productpraat infrastructuur. Het stelt gebruikers in staat om te kiezen uit verschillende website types (templates) en functionaliteiten (features) in- of uit te schakelen.

### Kenmerken

- **3 Template Types**: Bedrijfswebsite, Shop, Blog
- **20+ Feature Toggles**: Modulaire functionaliteiten die per template geconfigureerd kunnen worden
- **Backwards Compatible**: Bestaande Productpraat shop data blijft behouden
- **Modulaire Architectuur**: Templates en features kunnen als plugins worden toegevoegd

---

## Template Systeem

### Beschikbare Templates

| Template | ID | Beschrijving |
|----------|-----|-------------|
| **Bedrijfswebsite** | `business` | Professionele website voor bedrijven en organisaties |
| **Shop** | `shop` | E-commerce platform (gebaseerd op Productpraat) |
| **Blog** | `blog` | Content-gericht platform voor bloggers |

### Template Configuratie

Elk template heeft de volgende eigenschappen:

```typescript
interface TemplateConfig {
    id: TemplateType;           // Unieke identifier
    name: string;               // Weergavenaam (Nederlands)
    description: string;        // Beschrijving van het template
    icon: string;               // FontAwesome icon class
    previewImage?: string;      // URL naar preview afbeelding
    defaultFeatures: FeatureId[];   // Standaard ingeschakelde features
    availableFeatures: FeatureId[]; // Alle beschikbare features
    settings: TemplateSettings;     // Template-specifieke instellingen
}
```

### Template Settings

```typescript
interface TemplateSettings {
    primaryColor: string;       // Hoofdkleur (hex)
    secondaryColor: string;     // Secundaire kleur (hex)
    fontFamily: string;         // Lettertype
    borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    headerStyle: 'minimal' | 'standard' | 'expanded';
    footerStyle: 'simple' | 'detailed' | 'mega';
    sidebarPosition: 'left' | 'right' | 'none';
    [key: string]: any;         // Template-specifieke settings
}
```

---

## Feature Toggle Systeem

### Feature Categorieën

| Categorie | ID | Beschrijving |
|-----------|-----|-------------|
| **Kern** | `core` | Essentiële functionaliteiten (sommige niet uit te schakelen) |
| **Content** | `content` | Content-gerelateerde features |
| **Engagement** | `engagement` | Gebruikersinteractie features |
| **E-commerce** | `commerce` | Shop-gerelateerde features |
| **SEO & Analytics** | `seo_analytics` | Zoekmachine optimalisatie en tracking |
| **Communicatie** | `communication` | Contact en nieuwsbrief features |

### Beschikbare Features (20+)

#### Kern Functionaliteiten
- `media_library` - Media Bibliotheek ✓ (altijd aan)
- `wysiwyg_editor` - Content Editor ✓ (altijd aan)
- `menu_management` - Menu Management ✓ (altijd aan)
- `page_builder` - Page Builder
- `user_authentication` - Gebruikers Authenticatie

#### Content Features
- `blog_posts` - Blog Posts
- `search` - Zoekfunctionaliteit
- `faq_section` - FAQ Sectie
- `testimonials` - Testimonials
- `multi_language` - Multi-taal Ondersteuning

#### Engagement Features
- `comments` - Commentaar Sectie
- `social_media` - Social Media Integratie

#### E-commerce Features
- `payment_systems` - Betalingssystemen (alleen Shop)
- `product_reviews` - Product Reviews (alleen Shop)
- `cart_wishlist` - Winkelwagen & Wishlist (alleen Shop)
- `inventory_management` - Voorraadbeheer (alleen Shop)

#### SEO & Analytics
- `seo_tools` - SEO Tools
- `analytics` - Analytics Integratie

#### Communicatie
- `contact_form` - Contact Formulier
- `newsletter` - Newsletter Integratie

---

## Nieuwe Template Toevoegen

### Stap 1: Definieer het Template Type

Voeg het nieuwe template type toe aan de `TemplateType` union in `/src/cms/types.ts`:

```typescript
export type TemplateType = 'business' | 'shop' | 'blog' | 'portfolio'; // Nieuw template
```

### Stap 2: Voeg Template Configuratie Toe

Voeg de template configuratie toe aan de `TEMPLATES` object:

```typescript
export const TEMPLATES: Record<TemplateType, TemplateConfig> = {
    // ... bestaande templates ...
    
    portfolio: {
        id: 'portfolio',
        name: 'Portfolio',
        description: 'Toon je werk en projecten in een stijlvolle portfolio website.',
        icon: 'fa-briefcase',
        defaultFeatures: [
            'media_library', 
            'wysiwyg_editor', 
            'menu_management',
            'seo_tools',
            'analytics',
            'contact_form',
            'social_media'
        ],
        availableFeatures: [
            'media_library',
            'wysiwyg_editor', 
            'menu_management',
            'page_builder',
            'blog_posts',
            'comments',
            'contact_form',
            'newsletter',
            'search',
            'social_media',
            'seo_tools',
            'analytics',
            'multi_language',
            'testimonials'
        ],
        settings: {
            primaryColor: '#FF6B6B',
            secondaryColor: '#4ECDC4',
            fontFamily: 'Poppins',
            borderRadius: 'lg',
            headerStyle: 'minimal',
            footerStyle: 'simple',
            sidebarPosition: 'none',
            // Portfolio-specifieke settings
            projectsPerPage: 9,
            showFilterBar: true,
            enableLightbox: true,
        }
    }
};
```

### Stap 3: Update Components (Optioneel)

Als je template unieke UI elementen nodig heeft, maak een nieuw component:

```typescript
// /src/cms/templates/PortfolioTemplate.tsx
import React from 'react';
import { useTemplate, useFeature } from '../CMSContext';

export const PortfolioTemplate: React.FC = () => {
    const { settings } = useTemplate();
    const hasLightbox = useFeature('media_library');
    
    return (
        <div className="portfolio-grid">
            {/* Template-specifieke content */}
        </div>
    );
};
```

### Stap 4: Voeg Preview Toe aan TemplateSelector

Update de `renderTemplatePreview` functie in `/src/cms/TemplateSelector.tsx` om je nieuwe template preview toe te voegen.

---

## Nieuwe Feature Toevoegen

### Stap 1: Definieer de Feature ID

Voeg de nieuwe feature ID toe aan de `FeatureId` union:

```typescript
export type FeatureId = 
    | 'comments'
    | 'contact_form'
    // ... bestaande features ...
    | 'live_chat';  // Nieuwe feature
```

### Stap 2: Voeg Feature Configuratie Toe

Voeg de feature configuratie toe aan het `FEATURES` object:

```typescript
export const FEATURES: Record<FeatureId, FeatureConfig> = {
    // ... bestaande features ...
    
    live_chat: {
        id: 'live_chat',
        name: 'Live Chat',
        description: 'Real-time chat ondersteuning voor bezoekers.',
        icon: 'fa-comments-alt',
        category: 'communication',
        isCore: false,
        templateCompatibility: ['business', 'shop'],  // Welke templates ondersteunen dit
        settings: {
            provider: 'intercom',
            apiKey: '',
            welcomeMessage: 'Hoi! Hoe kunnen we helpen?',
            offlineMessage: 'We zijn momenteel offline. Laat een bericht achter.',
        }
    }
};
```

### Stap 3: Voeg Feature Logic Toe

Implementeer de feature functionaliteit met de `useFeature` hook:

```typescript
import { useFeature, useFeatureToggle } from '../cms/CMSContext';

const MyComponent = () => {
    // Check of feature enabled is
    const isLiveChatEnabled = useFeature('live_chat');
    
    // Of met volledige controls
    const { enabled, settings, toggle, updateSettings } = useFeatureToggle('live_chat');
    
    if (!enabled) return null;
    
    return (
        <LiveChatWidget 
            apiKey={settings?.apiKey}
            welcomeMessage={settings?.welcomeMessage}
        />
    );
};
```

### Stap 4: Update Template Compatibility

Voeg de feature toe aan de `availableFeatures` array van de templates die deze feature moeten ondersteunen.

---

## CMS Context API

### useCMS Hook

```typescript
const {
    // Site configuratie
    siteConfig,        // Huidige site configuratie
    isLoading,         // Laadstatus
    error,             // Foutmelding indien aanwezig
    
    // Template management
    currentTemplate,           // Huidig template type
    setTemplate,               // Wissel naar ander template
    updateTemplateSettings,    // Update template settings
    
    // Feature management
    isFeatureEnabled,          // Check of feature aan staat
    toggleFeature,             // Schakel feature in/uit
    updateFeatureSettings,     // Update feature settings
    
    // Site config management
    updateSiteConfig,          // Update site configuratie
    saveSiteConfig,            // Sla configuratie op
    resetToDefaults,           // Reset naar standaardwaarden
    
    // Setup
    isSetupComplete,           // Is setup wizard voltooid
    completeSetup,             // Voltooi setup
    migrateFromProductpraat,   // Migreer bestaande data
} = useCMS();
```

### useFeature Hook

```typescript
// Simpele check of feature enabled is
const isEnabled = useFeature('comments');
```

### useFeatureToggle Hook

```typescript
const { 
    enabled,       // Boolean - is feature aan
    config,        // FeatureConfig object
    settings,      // Feature-specifieke settings
    toggle,        // (enabled: boolean) => void
    updateSettings // (settings: FeatureSettings) => void
} = useFeatureToggle('newsletter');
```

### useTemplate Hook

```typescript
const { 
    type,      // Current template type (e.g., 'shop')
    config,    // TemplateConfig object
    settings   // Current template settings
} = useTemplate();
```

---

## Migratie van Productpraat

### Automatische Migratie

Bij het starten van de applicatie wordt automatisch gecontroleerd of er een bestaande Productpraat configuratie is. Als dat zo is, wordt deze gemigreerd naar het WritgoCMS formaat.

### Handmatige Migratie

Via de Setup Wizard kan gekozen worden voor "ProductPraat Behouden" om de bestaande shop data te behouden:

```typescript
const { migrateFromProductpraat } = useCMS();

// Migreer bestaande Productpraat data
await migrateFromProductpraat();
```

### Wat wordt gemigreerd?

- Alle bestaande producten
- Alle artikelen
- Gebruikersreviews
- Bestaande categorieën

### Wat wordt toegevoegd?

- CMS configuratie met Shop template
- Feature toggles (standaard shop features)
- Template settings

---

## Voorbeeld: Volledige Feature Implementatie

```typescript
// 1. types.ts - Definieer feature
export type FeatureId = 
    // ... existing ...
    | 'cookie_consent';

export const FEATURES: Record<FeatureId, FeatureConfig> = {
    // ... existing ...
    cookie_consent: {
        id: 'cookie_consent',
        name: 'Cookie Melding',
        description: 'GDPR-compliant cookie consent banner.',
        icon: 'fa-cookie-bite',
        category: 'core',
        isCore: false,
        templateCompatibility: ['business', 'shop', 'blog'],
        settings: {
            position: 'bottom',
            showPolicy: true,
            policyUrl: '/privacy',
        }
    }
};

// 2. CookieConsent.tsx - Implementeer component
import React, { useState, useEffect } from 'react';
import { useFeature, useFeatureToggle } from '../cms/CMSContext';

export const CookieConsent: React.FC = () => {
    const { enabled, settings } = useFeatureToggle('cookie_consent');
    const [accepted, setAccepted] = useState(false);
    
    useEffect(() => {
        const consent = localStorage.getItem('cookie_consent');
        if (consent) setAccepted(true);
    }, []);
    
    if (!enabled || accepted) return null;
    
    const handleAccept = () => {
        localStorage.setItem('cookie_consent', 'true');
        setAccepted(true);
    };
    
    return (
        <div className={`fixed ${settings?.position === 'top' ? 'top-0' : 'bottom-0'} left-0 right-0 bg-slate-900 p-4`}>
            <div className="container mx-auto flex items-center justify-between">
                <p className="text-white">
                    Wij gebruiken cookies om je ervaring te verbeteren.
                    {settings?.showPolicy && (
                        <a href={settings?.policyUrl} className="text-blue-400 ml-2">
                            Privacybeleid
                        </a>
                    )}
                </p>
                <button 
                    onClick={handleAccept}
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    Accepteren
                </button>
            </div>
        </div>
    );
};

// 3. App.tsx - Gebruik component
import { CookieConsent } from './components/CookieConsent';

export const App = () => {
    return (
        <div>
            {/* ... app content ... */}
            <CookieConsent />
        </div>
    );
};
```

---

## Bestanden Structuur

```
src/cms/
├── index.ts                 # Module exports
├── types.ts                 # Type definities, templates, features
├── CMSContext.tsx           # React context en hooks
├── CMSDashboard.tsx         # Admin dashboard component
├── TemplateSelector.tsx     # Template keuze component
├── FeatureTogglePanel.tsx   # Feature toggles UI
├── SetupWizard.tsx          # Setup wizard voor nieuwe gebruikers
└── ContentManagementPanel.tsx # Content beheer admin panel

src/components/features/
├── index.ts                 # Alle feature exports
├── search/
│   ├── SearchBar.tsx        # Live search met autocomplete
│   └── SearchResults.tsx    # Zoekresultaten pagina
├── faq/
│   └── FAQSection.tsx       # Accordion FAQ component
├── testimonials/
│   └── TestimonialCarousel.tsx # Testimonial carousel en grid
├── contact/
│   └── ContactForm.tsx      # Contact formulier met validatie
├── newsletter/
│   └── NewsletterForm.tsx   # Newsletter aanmelding
├── comments/
│   └── CommentSection.tsx   # Nested comments met voting
├── social/
│   └── SocialShare.tsx      # Social share buttons
├── commerce/
│   ├── ProductReviews.tsx   # Product review systeem
│   ├── Wishlist.tsx         # Wishlist functionaliteit
│   ├── PaymentFlow.tsx      # Mock checkout flow
│   └── InventoryBadge.tsx   # Voorraad indicatoren
├── seo/
│   └── SEOHead.tsx          # Meta tags en structured data
├── analytics/
│   └── AnalyticsTracker.tsx # Page view en event tracking
├── language/
│   └── LanguageSelector.tsx # Multi-language support (NL/EN/DE/FR)
├── auth/
│   └── AuthComponents.tsx   # Login, Register, UserProfile
└── blog/
    └── BlogComponents.tsx   # Blog grid en post view
```

---

## Feature Componenten Gebruiken

### Basis Gebruik

Elk feature component checkt automatisch of de feature is ingeschakeld:

```typescript
import { FAQSection } from '../components/features';

// Component toont alleen als 'faq_section' feature is ingeschakeld
<FAQSection />
```

### Met Configuratie

Gebruik feature settings in je componenten:

```typescript
import { useFeatureToggle } from '../cms';
import { CommentSection } from '../components/features';

const MyPage = () => {
    const { enabled, settings } = useFeatureToggle('comments');
    
    // settings.maxNestingLevel, settings.allowVoting, etc.
    return enabled ? <CommentSection contentId="article-123" /> : null;
};
```

### Beschikbare Feature Componenten

#### Search (`search`)
```typescript
import { SearchBar, SearchResults } from '../components/features';

// Zoekbalk met autocomplete
<SearchBar 
    onSearch={(query) => console.log(query)}
    searchData={[{ id: '1', type: 'product', title: 'Item', url: '/item' }]}
    placeholder="Zoeken..."
/>
```

#### FAQ Section (`faq_section`)
```typescript
import { FAQSection } from '../components/features';

// Accordion FAQs met zoeken
<FAQSection 
    title="Veelgestelde Vragen"
    showSearch={true}
    showCategories={true}
/>
```

#### Testimonials (`testimonials`)
```typescript
import { TestimonialCarousel, TestimonialGrid } from '../components/features';

// Carousel of Grid view
<TestimonialCarousel autoPlay={true} autoPlayInterval={5000} />
<TestimonialGrid columns={3} />
```

#### Contact Form (`contact_form`)
```typescript
import { ContactForm } from '../components/features';

<ContactForm 
    title="Neem contact op"
    showFileUpload={true}
    onSubmit={(data) => console.log(data)}
/>
```

#### Newsletter (`newsletter`)
```typescript
import { NewsletterForm } from '../components/features';

<NewsletterForm 
    variant="card" // 'inline' | 'stacked' | 'card'
    buttonText="Aanmelden"
/>
```

#### Comments (`comments`)
```typescript
import { CommentSection } from '../components/features';

<CommentSection 
    contentId="article-123"
    title="Reacties"
/>
```

#### Social Share (`social_media`)
```typescript
import { SocialShare, SocialLinks } from '../components/features';

<SocialShare 
    url={window.location.href}
    title="Deel dit artikel"
    platforms={['facebook', 'twitter', 'linkedin', 'whatsapp']}
/>
```

#### Product Reviews (`product_reviews`)
```typescript
import { ProductReviews, StarRating } from '../components/features';

<ProductReviews productId="product-123" />
<StarRating rating={4.5} size="lg" showValue />
```

#### Wishlist (`cart_wishlist`)
```typescript
import { WishlistButton, WishlistCounter, WishlistPage } from '../components/features';

<WishlistButton 
    productId="product-123"
    productName="Product Naam"
    productPrice={99.99}
/>
<WishlistCounter /> // In header
<WishlistPage onProductClick={(id) => navigate(`/product/${id}`)} />
```

#### Inventory (`inventory_management`)
```typescript
import { InventoryBadge, StockIndicator } from '../components/features';

<InventoryBadge productId="product-123" variant="badge" />
<StockIndicator productId="product-123" />
```

#### SEO (`seo_tools`)
```typescript
import { SEOHead, Breadcrumbs } from '../components/features';

<SEOHead 
    title="Pagina Titel"
    description="Beschrijving voor zoekmachines"
    ogImage="https://example.com/image.jpg"
/>
<Breadcrumbs items={[
    { name: 'Home', url: '/' },
    { name: 'Categorie', url: '/categorie' },
    { name: 'Pagina', url: '/huidige-pagina' }
]} />
```

#### Analytics (`analytics`)
```typescript
import { AnalyticsTracker, AnalyticsDashboard, trackEvent } from '../components/features';

// Wrap je app
<AnalyticsTracker>
    <App />
</AnalyticsTracker>

// Track custom events
trackEvent('button_click', 'engagement', 'newsletter_signup');

// Dashboard in admin
<AnalyticsDashboard />
```

#### Multi-language (`multi_language`)
```typescript
import { LanguageSelector, LanguageProvider, useLanguage } from '../components/features';

// Wrap je app
<LanguageProvider>
    <App />
</LanguageProvider>

// Taal selector
<LanguageSelector variant="dropdown" />

// Gebruik vertalingen
const { t, currentLanguage } = useLanguage();
<span>{t('common.search')}</span>
```

#### Blog (`blog_posts`)
```typescript
import { BlogGrid, BlogPostView, BlogCategories } from '../components/features';

<BlogGrid columns={3} onPostClick={(post) => navigate(`/blog/${post.slug}`)} />
<BlogPostView post={post} onBack={() => navigate('/blog')} />
```

#### Authentication (`user_authentication`)
```typescript
import { LoginForm, RegisterForm, UserProfile } from '../components/features';

<LoginForm onSuccess={(user) => setUser(user)} onRegisterClick={() => setView('register')} />
<RegisterForm onSuccess={(user) => setUser(user)} onLoginClick={() => setView('login')} />
<UserProfile user={user} onLogout={() => setUser(null)} />
```

---

## Data Persistence

Alle feature data wordt opgeslagen in localStorage met de prefix `writgo_`:

| Feature | Storage Key | Beschrijving |
|---------|-------------|--------------|
| FAQs | `writgo_faq_data` | FAQ items |
| Testimonials | `writgo_testimonials_data` | Klantbeoordelingen |
| Contact | `writgo_contact_submissions` | Contactformulier inzendingen |
| Newsletter | `writgo_newsletter_subscribers` | Email abonnees |
| Comments | `writgo_comments_data` | Reacties |
| Product Reviews | `writgo_product_reviews` | Productbeoordelingen |
| Wishlist | `writgo_wishlist_data` | Verlanglijst items |
| Inventory | `writgo_inventory_data` | Voorraadniveaus |
| Blog Posts | `writgo_blog_posts` | Blog artikelen |
| Analytics | `writgo_analytics_data` | Page views en events |
| Users | `writgo_users_data` | Geregistreerde gebruikers |
| Orders | `writgo_orders_data` | Bestellingen |

---

## Admin Content Beheer

Het CMS Dashboard bevat een "Content Beheer" tab waar je:

- **Blog Posts** kunt aanmaken, bewerken en verwijderen
- **FAQs** kunt beheren
- **Testimonials** kunt toevoegen
- **Contact inzendingen** kunt bekijken
- **Newsletter abonnees** kunt monitoren
- **Analytics** dashboard kunt bekijken

---

## Vragen?

Neem contact op met de ontwikkelaars of raadpleeg de broncode in `/src/cms/`.

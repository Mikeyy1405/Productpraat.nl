
import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { ProductCard } from './components/ProductCard';
import { AdminPanel } from './components/AdminPanel';
import { UserReviewSection } from './components/UserReviewSection';
import { Login } from './components/Login';
import { Product, CATEGORIES, Article, ArticleType } from './types';
import { db } from './services/storage';
import { seoService } from './services/seoService';
import { authService } from './services/authService';
import { parseProductUrl, isProductUrl, getProductUrl, urlRouter, generateSlug, getCanonicalUrl, isArticleUrl, isArticlesOverviewUrl, parseArticleUrl, getArticleUrl, generateArticleSlug, ARTICLE_TYPE_LABELS, ARTICLE_TYPE_COLORS, removeFirstH1FromHtml } from './services/urlService';

// --- SEASONAL THEME ENGINE ---
interface SeasonalTheme {
    id: string;
    badgeText: string;
    badgeColorClass: string; 
    gradientTextClass: string;
    glowColorClass: string;
    icon: string; 
    titleStart: string;
    titleHighlight: string;
    titleEnd: string;
    subtitle: string;
    pageBackground: string;
    sectionBackground: string;
    cardBackground: string;
    borderColor: string;
    accentText: string;
    buttonClass: string;
    atmosphereOverlay: string;
}

const getSeasonalTheme = (): SeasonalTheme => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // 1. KONINGSDAG
    if (month === 4 && day >= 20 && day <= 28) {
        return {
            id: 'kingsday',
            badgeText: '👑 Koningsdag Deals & Oranjegekte',
            badgeColorClass: 'bg-orange-500 text-white border-orange-400',
            gradientTextClass: 'from-orange-400 via-orange-500 to-red-500',
            glowColorClass: 'bg-orange-500/30',
            icon: 'fa-crown',
            titleStart: "Vier groots met",
            titleHighlight: "Oranje Deals",
            titleEnd: ".",
            subtitle: "Alles voor een legendarische Koningsdag. Van de luidste Bluetooth speakers voor de vrijmarkt tot de beste camera's.",
            pageBackground: 'bg-slate-950',
            sectionBackground: 'bg-[#1a1008]',
            cardBackground: 'bg-slate-900',
            borderColor: 'border-orange-900/50',
            accentText: 'text-orange-500',
            buttonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
            atmosphereOverlay: 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-slate-950/50 to-slate-950'
        };
    }

    // 2. BLACK FRIDAY
    if ((month === 11 && day >= 15) || (month === 12 && day <= 2)) {
        return {
            id: 'blackfriday',
            badgeText: '⚡ BLACK FRIDAY MEGA DEALS',
            badgeColorClass: 'bg-yellow-400 text-black border-yellow-500 animate-pulse shadow-[0_0_15px_rgba(250,204,21,0.5)]',
            gradientTextClass: 'from-yellow-300 via-yellow-500 to-orange-500',
            glowColorClass: 'bg-yellow-500/20',
            icon: 'fa-bolt',
            titleStart: "Wij filteren de",
            titleHighlight: "Black Friday",
            titleEnd: " chaos.",
            subtitle: "Trap niet in nepaanbiedingen. Wij analyseren miljoenen prijzen en tonen je alleen de échte deals met de hoogste korting.",
            pageBackground: 'bg-black',
            sectionBackground: 'bg-neutral-900',
            cardBackground: 'bg-neutral-800',
            borderColor: 'border-neutral-700',
            accentText: 'text-yellow-400',
            buttonClass: 'bg-yellow-400 text-black hover:bg-yellow-300 border border-yellow-500 font-black',
            atmosphereOverlay: 'bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-yellow-900/10 via-black to-black'
        };
    }

    // 3. SINTERKLAAS
    if ((month === 11 && day >= 12) || (month === 12 && day <= 5)) {
        return {
            id: 'sinterklaas',
            badgeText: '🎁 Tips voor Pakjesavond',
            badgeColorClass: 'bg-red-600 text-yellow-300 border-yellow-500',
            gradientTextClass: 'from-red-500 via-red-600 to-yellow-400',
            glowColorClass: 'bg-red-600/30',
            icon: 'fa-gift',
            titleStart: "Hulppiet voor de",
            titleHighlight: "Beste Cadeaus",
            titleEnd: ".",
            subtitle: "Geen stress voor Pakjesavond. Wij hebben het speelgoed, de gadgets en de huishoudelijke hulpen al voor je getest.",
            pageBackground: 'bg-[#1a0505]',
            sectionBackground: 'bg-[#2a0a0a]',
            cardBackground: 'bg-red-950/30',
            borderColor: 'border-red-900/30',
            accentText: 'text-yellow-400',
            buttonClass: 'bg-red-600 hover:bg-red-700 text-white',
            atmosphereOverlay: 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-900/20 via-slate-950 to-slate-950'
        };
    }

    // 4. KERST
    if (month === 12 && day >= 6 && day <= 26) {
        return {
            id: 'christmas',
            badgeText: '🎄 De Mooiste Kerstcadeaus',
            badgeColorClass: 'bg-green-800 text-red-100 border-red-500',
            gradientTextClass: 'from-green-400 via-emerald-500 to-red-500',
            glowColorClass: 'bg-green-600/20',
            icon: 'fa-snowflake',
            titleStart: "Betoverende",
            titleHighlight: "Kerst Deals",
            titleEnd: " onder de boom.",
            subtitle: "Maak de feestdagen compleet met de best geteste producten. Van gourmetstellen tot luxe televisies voor de kerstfilm.",
            pageBackground: 'bg-[#020f05]',
            sectionBackground: 'bg-[#051a0a]',
            cardBackground: 'bg-slate-900',
            borderColor: 'border-green-900/30',
            accentText: 'text-red-400',
            buttonClass: 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/20',
            atmosphereOverlay: 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-slate-950 to-slate-950'
        };
    }

    // DEFAULT THEME
    return {
        id: 'default',
        badgeText: `Update: Testresultaten ${now.toLocaleString('nl-NL', { month: 'long' })} ${now.getFullYear()} Live`,
        badgeColorClass: 'bg-slate-900/80 text-blue-400 border-slate-700',
        gradientTextClass: 'from-blue-400 via-blue-500 to-purple-500',
        glowColorClass: 'bg-blue-600/20',
        icon: 'fa-check-circle',
        titleStart: "Wij testen",
        titleHighlight: "alles",
        titleEnd: ". Jij kiest de beste.",
        subtitle: "Het meest complete consumentenplatform van de Benelux. 100% onafhankelijk, datagedreven en eerlijk.",
        pageBackground: 'bg-slate-950',
        sectionBackground: 'bg-slate-900',
        cardBackground: 'bg-slate-800',
        borderColor: 'border-slate-800',
        accentText: 'text-[#1877F2]',
        buttonClass: 'bg-[#1877F2] hover:bg-blue-600 text-white',
        atmosphereOverlay: 'bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950'
    };
};

export const App: React.FC = () => {
    const [view, setView] = useState<'home' | 'category' | 'admin' | 'details' | 'search' | 'article' | 'about' | 'contact' | 'login' | 'product' | '404' | 'artikelen'>('home');
    const [activeCategory, setActiveCategory] = useState<string>('wasmachines');
    const [customProducts, setCustomProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [compareList, setCompareList] = useState<Product[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authService.isAuthenticated());
    const [currentTheme, setCurrentTheme] = useState<SeasonalTheme>(getSeasonalTheme());
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [currentSlug, setCurrentSlug] = useState<string>('');
    
    const [filterMinPrice, setFilterMinPrice] = useState<string>('');
    const [filterMaxPrice, setFilterMaxPrice] = useState<string>('');
    const [filterMinScore, setFilterMinScore] = useState<number>(0);
    const [filterPredicate, setFilterPredicate] = useState<boolean>(false);
    
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    
    // Artikelen filter state
    const [articleCategoryFilter, setArticleCategoryFilter] = useState<string>('');
    const [articleTypeFilter, setArticleTypeFilter] = useState<ArticleType | ''>('');
    const [articleSearchTerm, setArticleSearchTerm] = useState<string>('');
    const [articleSortBy, setArticleSortBy] = useState<'newest' | 'oldest' | 'alphabetical'>('newest');

    // Handle URL routing on initial load and popstate
    const handleUrlRouting = (products: Product[], loadedArticles: Article[]) => {
        const path = window.location.pathname;
        
        // Check for product URL pattern: /shop/{category}/{slug}
        if (isProductUrl(path)) {
            const parsed = parseProductUrl(path);
            if (parsed) {
                const { category, slug } = parsed;
                // First filter by category to reduce the search space
                const categoryProducts = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
                // Then find the product by slug
                const product = categoryProducts.find(p => {
                    const productSlug = (p.slug || generateSlug(p.brand, p.model)).toLowerCase();
                    return productSlug === slug.toLowerCase();
                });
                
                if (product) {
                    setSelectedProduct(product);
                    setActiveCategory(product.category);
                    setCurrentSlug(slug);
                    setView('product');
                    return;
                } else {
                    // Product not found - show 404
                    setView('404');
                    return;
                }
            }
        }
        
        // Check for articles overview URL: /artikelen
        if (isArticlesOverviewUrl(path)) {
            setView('artikelen');
            return;
        }
        
        // Check for single article URL: /artikelen/{slug}
        if (isArticleUrl(path)) {
            const parsed = parseArticleUrl(path);
            if (parsed) {
                const { slug } = parsed;
                // Find article by slug
                const article = loadedArticles.find(a => {
                    const articleSlug = (a.slug || generateArticleSlug(a)).toLowerCase();
                    return articleSlug === slug.toLowerCase();
                });
                
                if (article) {
                    setSelectedArticle(article);
                    setView('article');
                    return;
                } else {
                    // Article not found - show 404
                    setView('404');
                    return;
                }
            }
        }
        
        // Check for category URL pattern: /shop/{category}
        const categoryMatch = path.match(/^\/shop\/([^\/]+)\/?$/);
        if (categoryMatch) {
            const category = categoryMatch[1].toLowerCase();
            if (CATEGORIES[category]) {
                setActiveCategory(category);
                setView('category');
                return;
            }
        }
        
        // Default views based on path
        if (path === '/' || path === '') {
            setView('home');
        } else if (path === '/about') {
            setView('about');
        } else if (path === '/contact') {
            setView('contact');
        } else if (path === '/admin' || path === '/dashboard') {
            setView(isAuthenticated ? 'admin' : 'login');
        }
    };

    useEffect(() => {
        console.log("ProductPraat v1.4.6 Started - Clean Database Mode");
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                // Fetch from Supabase
                const prods = await db.getAll();
                setCustomProducts(prods);
                
                const arts = await db.getArticles();
                setArticles(arts);
                
                // Handle URL routing after data is loaded
                handleUrlRouting(prods, arts);
            } catch(e) {
                console.error("Failed to load data", e);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
        setCurrentTheme(getSeasonalTheme());
    }, []);

    // Separate effect for popstate handling - uses current products state
    useEffect(() => {
        // Handle browser back/forward navigation
        const handlePopState = () => {
            if (customProducts.length > 0 || articles.length > 0) {
                handleUrlRouting(customProducts, articles);
            }
        };
        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [customProducts, articles]); // Re-register when products or articles change

    useEffect(() => {
        if (view === 'category') {
            setFilterMinPrice('');
            setFilterMaxPrice('');
            setFilterMinScore(0);
            setFilterPredicate(false);
        }
    }, [activeCategory, view]);

    // ... SEO Logic with canonical URLs ...
    useEffect(() => {
        seoService.clearSchema(); 
        if (view === 'home') {
            seoService.updateMeta("ProductPraat.nl - Wij testen ALLES voor in huis", "100% onafhankelijke reviews.", undefined, window.location.origin);
        } else if (view === 'category') {
            const catName = CATEGORIES[activeCategory]?.name || activeCategory;
            seoService.updateMeta(`De Beste ${catName} van 2026`, `Op zoek naar een nieuwe ${catName}? Wij hebben de populairste modellen getest.`, undefined, `${window.location.origin}/shop/${activeCategory}`);
        } else if ((view === 'details' || view === 'product') && selectedProduct) {
            const p = selectedProduct;
            const canonicalUrl = getCanonicalUrl(p);
            seoService.updateMeta(
                p.metaDescription || `${p.brand} ${p.model} Review 2026`, 
                p.description || `Review van de ${p.brand} ${p.model}.`, 
                p.image,
                canonicalUrl
            );
            seoService.setProductSchema(p); 
        } else if (view === 'artikelen') {
            seoService.setArticlesOverviewMeta();
        } else if (view === 'article' && selectedArticle) {
            seoService.updateMeta(
                selectedArticle.title, 
                selectedArticle.metaDescription || selectedArticle.summary, 
                selectedArticle.imageUrl,
                `${window.location.origin}${getArticleUrl(selectedArticle)}`
            );
            seoService.setArticleSchema(selectedArticle);
        } else if (view === 'about') {
            seoService.updateMeta("Over ProductPraat", "Datagedreven productadvies.", undefined, `${window.location.origin}/about`);
        } else if (view === 'contact') {
            seoService.updateMeta("Contact - ProductPraat", "Neem contact op met de redactie.", undefined, `${window.location.origin}/contact`);
        } else if (view === '404') {
            seoService.updateMeta("Pagina niet gevonden - ProductPraat", "De gevraagde pagina kon niet worden gevonden.");
        }
    }, [view, activeCategory, selectedProduct, searchTerm, selectedArticle]);

    const visibleProducts = useMemo(() => {
        if (view === 'search') {
            const lowerTerm = searchTerm.toLowerCase();
            return customProducts.filter(p => p.brand.toLowerCase().includes(lowerTerm) || p.model.toLowerCase().includes(lowerTerm) || p.category.toLowerCase().includes(lowerTerm));
        }
        const relevantCustom = customProducts.filter(p => p.category === activeCategory);
        let combined = [...relevantCustom].sort((a, b) => b.score - a.score);
        if (filterMinPrice) combined = combined.filter(p => p.price >= Number(filterMinPrice));
        if (filterMaxPrice) combined = combined.filter(p => p.price <= Number(filterMaxPrice));
        if (filterMinScore > 0) combined = combined.filter(p => p.score >= filterMinScore);
        if (filterPredicate) combined = combined.filter(p => p.predicate === 'test' || p.predicate === 'buy');
        return combined;
    }, [activeCategory, customProducts, view, searchTerm, filterMinPrice, filterMaxPrice, filterMinScore, filterPredicate]);

    const latestReviews = useMemo(() => customProducts.slice(0, 4), [customProducts]);
    const topThreeProducts = useMemo(() => {
         const relevantCustom = customProducts.filter(p => p.category === activeCategory);
         return [...relevantCustom].sort((a, b) => b.score - a.score).slice(0, 3);
    }, [activeCategory, customProducts]);
    
    // Filtered and sorted articles for the artikelen overview
    const filteredArticles = useMemo(() => {
        let filtered = [...articles];
        
        // Filter by category
        if (articleCategoryFilter) {
            filtered = filtered.filter(a => a.category === articleCategoryFilter || (a.categories && a.categories.includes(articleCategoryFilter)));
        }
        
        // Filter by type
        if (articleTypeFilter) {
            filtered = filtered.filter(a => a.type === articleTypeFilter);
        }
        
        // Search filter
        if (articleSearchTerm) {
            const term = articleSearchTerm.toLowerCase();
            filtered = filtered.filter(a => 
                a.title.toLowerCase().includes(term) || 
                a.summary.toLowerCase().includes(term) ||
                (a.tags && a.tags.some(t => t.toLowerCase().includes(term)))
            );
        }
        
        // Sort
        switch (articleSortBy) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.created_at || a.date).getTime() - new Date(b.created_at || b.date).getTime());
                break;
            case 'alphabetical':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }
        
        return filtered;
    }, [articles, articleCategoryFilter, articleTypeFilter, articleSearchTerm, articleSortBy]);
    
    // Helper function to get article type label in Dutch
    const getArticleTypeLabel = (type: ArticleType): string => {
        return ARTICLE_TYPE_LABELS[type] || type;
    };
    
    // Helper function to get article type color classes
    const getArticleTypeColorClasses = (type: ArticleType) => {
        return ARTICLE_TYPE_COLORS[type] || ARTICLE_TYPE_COLORS['informational'];
    };
    
    // Helper function to calculate reading time (safely strip HTML)
    const getReadingTime = (htmlContent: string): number => {
        // Use a temporary DOM element to safely extract text content
        if (typeof document !== 'undefined') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            const text = tempDiv.textContent || tempDiv.innerText || '';
            const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
            return Math.ceil(wordCount / 200); // Assume 200 words per minute
        }
        // Fallback for server-side: rough estimate based on content length
        return Math.ceil(htmlContent.length / 1000);
    };
    
    // Get related articles (same category or type)
    const getRelatedArticles = (article: Article, count: number = 3): Article[] => {
        return articles
            .filter(a => a.id !== article.id && (a.category === article.category || a.type === article.type))
            .slice(0, count);
    };

    const handleNavigate = (target: 'home' | 'admin' | 'about' | 'contact' | 'dashboard' | 'artikelen') => {
        if ((target === 'admin' || target === 'dashboard') && !isAuthenticated) {
            setView('login');
            urlRouter.push('/dashboard');
        } else {
            if (target === 'admin' || target === 'dashboard') {
                setView('admin');
                urlRouter.push('/dashboard');
            } else if (target === 'artikelen') {
                setView('artikelen');
                urlRouter.push('/artikelen');
            } else {
                setView(target);
                // Update browser URL
                if (target === 'home') urlRouter.push('/');
                else if (target === 'about') urlRouter.push('/about');
                else if (target === 'contact') urlRouter.push('/contact');
            }
        }
        window.scrollTo(0,0);
    };

    const handleLoginSuccess = () => { setIsAuthenticated(true); setView('admin'); urlRouter.push('/dashboard'); };
    const handleLogout = () => { setIsAuthenticated(false); setView('login'); urlRouter.push('/dashboard'); };
    
    // ASYNC HANDLERS FOR SUPABASE INTERACTION
    const handleAddProduct = async (newProduct: Product) => {
        const updatedList = await db.add(newProduct);
        setCustomProducts(updatedList);
        if (CATEGORIES[newProduct.category]) { 
            setActiveCategory(newProduct.category); 
            setView('category'); 
            urlRouter.push(`/shop/${newProduct.category}`);
            window.scrollTo(0, 0); 
        }
    };

    const handleDeleteProduct = async (id: string) => {
        const updatedList = await db.remove(id);
        setCustomProducts(updatedList);
    };

    // ... Compare, OpenProduct, OpenArticle handlers with URL updates ...
    const toggleCompare = (id: string) => {
        const product = customProducts.find(p => p.id === id);
        if (!product) return;
        const exists = compareList.find(c => c.id === id);
        if (exists) setCompareList(prev => prev.filter(c => c.id !== id));
        else { if (compareList.length >= 3) { alert("Max 3"); return; } setCompareList(prev => [...prev, product]); }
    };
    const handleOpenProduct = (id: string) => {
        const product = customProducts.find(p => p.id === id);
        if (product) { 
            setSelectedProduct(product); 
            setActiveCategory(product.category); 
            const productSlug = product.slug || generateSlug(product.brand, product.model);
            setCurrentSlug(productSlug);
            setView('product'); 
            // Update browser URL to SEO-friendly format
            urlRouter.push(getProductUrl(product));
            window.scrollTo(0, 0); 
        }
    };
    const handleOpenProductBySlug = (slug: string) => {
        const product = customProducts.find(p => p.slug === slug);
        if (product) {
            setSelectedProduct(product);
            setActiveCategory(product.category);
            setCurrentSlug(slug);
            setView('product');
            window.scrollTo(0, 0);
        }
    };
    const handleOpenArticle = (article: Article) => { 
        setSelectedArticle(article); 
        setView('article'); 
        urlRouter.push(getArticleUrl(article));
        window.scrollTo(0, 0); 
    };
    const performSearch = (e?: React.FormEvent, term?: string) => {
        if (e) e.preventDefault();
        const query = term || searchTerm;
        if (!query.trim()) return;
        setSearchTerm(query);
        setView('search');
        urlRouter.push(`/search?q=${encodeURIComponent(query)}`);
        window.scrollTo(0, 0);
    };
    const handleCategorySelect = (categoryId: string) => { 
        setActiveCategory(categoryId); 
        setView('category'); 
        urlRouter.push(`/shop/${categoryId}`);
        window.scrollTo(0, 0); 
    };

    // --- FOOTER (Same as before) ---
    const renderFooter = () => (
        <footer className={`${currentTheme.pageBackground} text-slate-400 border-t ${currentTheme.borderColor} mt-auto font-sans text-center transition-colors duration-500`}>
            <div className={`${currentTheme.sectionBackground} border-b ${currentTheme.borderColor}`}>
                <div className="container mx-auto px-4 py-6">
                    <div className="flex flex-wrap justify-center items-center gap-6 text-sm font-medium">
                        <div className="flex items-center gap-2 text-slate-300"><i className={`fas fa-shield-alt ${currentTheme.accentText}`}></i> <span>100% Onafhankelijk</span></div>
                        <div className="flex items-center gap-2 text-slate-300"><i className="fas fa-check-circle text-green-500"></i> <span>Dagelijks getest</span></div>
                        <div className="flex items-center gap-2 text-slate-300"><i className="fas fa-lock text-slate-400"></i> <span>Privacy gewaarborgd</span></div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                <div className="space-y-6 flex flex-col items-center">
                    <div className="font-extrabold text-2xl tracking-tight leading-none text-white">
                        <span className="text-white">Product</span><span className={currentTheme.accentText}>Praat</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-400">Wij helpen consumenten met het maken van de beste keuze. Datagedreven en eerlijk.</p>
                </div>
                <div className="flex flex-col items-center">
                    <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-wider">Populair</h4>
                    <ul className="space-y-3 text-sm flex flex-col items-center">
                        {Object.entries(CATEGORIES).slice(0, 5).map(([k, c]) => (
                            <li key={k}>
                                <button onClick={() => handleCategorySelect(k)} className={`hover:${currentTheme.accentText} transition flex items-center gap-2 group`}>
                                    <i className={`fas ${c.icon} text-slate-600 group-hover:${currentTheme.accentText} w-5`}></i> {c.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex flex-col items-center">
                    <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-wider">Service & Info</h4>
                    <ul className="space-y-3 text-sm flex flex-col items-center">
                        <li><button onClick={() => handleNavigate('about')} className="hover:text-white transition">Over ons</button></li>
                        <li><button onClick={() => handleNavigate('contact')} className="hover:text-white transition">Contact</button></li>
                        <li><a href="#" className="hover:text-white transition">Adverteren</a></li>
                    </ul>
                </div>
                <div className="flex flex-col items-center">
                    <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-wider">Partners</h4>
                    <div className="flex flex-wrap gap-2 justify-center">
                         <div className={`${currentTheme.cardBackground} border ${currentTheme.borderColor} px-3 py-1.5 rounded flex items-center gap-2`}>
                            <span className="font-bold text-blue-500 text-xs">Bol.com</span>
                        </div>
                        <div className={`${currentTheme.cardBackground} border ${currentTheme.borderColor} px-3 py-1.5 rounded flex items-center gap-2`}>
                            <span className="font-bold text-orange-500 text-xs">Coolblue</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className={`${currentTheme.pageBackground} border-t ${currentTheme.borderColor} py-8`}>
                <div className="container mx-auto px-4 text-xs text-slate-600 text-center">
                    &copy; 2026 ProductPraat.nl. <button onClick={() => handleNavigate('admin')} className="ml-4 hover:text-slate-400"><i className="fas fa-lock"></i></button>
                </div>
            </div>
        </footer>
    );

    if (isLoadingData) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><i className="fas fa-spinner fa-spin text-4xl text-[#1877F2]"></i></div>;
    }

    return (
        <div className={`flex flex-col min-h-screen ${currentTheme.pageBackground} text-slate-200 font-sans transition-colors duration-500`}>
            <div className={`fixed inset-0 pointer-events-none ${currentTheme.atmosphereOverlay} z-0`}></div>
            <div className="relative z-10 flex flex-col min-h-screen">
                <Header onNavigate={handleNavigate} onSelectCategory={handleCategorySelect} activeView={view} />
                <main className="flex-1 flex flex-col">
                    {view === 'home' && (
                        <div className="animate-fade-in">
                            {/* Hero Section */}
                            <div className={`relative overflow-hidden ${currentTheme.pageBackground} border-b ${currentTheme.borderColor} transition-colors duration-500`}>
                                 {/* ... Hero Content matching themes ... */}
                                 <div className="container mx-auto px-4 py-24 text-center relative z-10">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md text-xs font-bold mb-8 shadow-lg animate-fade-in ${currentTheme.badgeColorClass}`}>
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                        </span>
                                        <i className={`fas ${currentTheme.icon}`}></i>
                                        {currentTheme.badgeText}
                                    </div>

                                    <h1 className="text-5xl md:text-7xl font-black text-white mb-8">
                                        {currentTheme.titleStart} <span className={`text-transparent bg-clip-text bg-gradient-to-r ${currentTheme.gradientTextClass}`}>{currentTheme.titleHighlight}</span>{currentTheme.titleEnd}
                                    </h1>
                                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed font-light drop-shadow-md">
                                        {currentTheme.subtitle}
                                    </p>
                                    <form onSubmit={(e) => performSearch(e)} className="w-full max-w-2xl mx-auto relative group z-20">
                                        <div className={`relative ${currentTheme.sectionBackground}/90 backdrop-blur-xl border ${currentTheme.borderColor} rounded-2xl p-2 flex shadow-2xl`}>
                                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Zoek product..." className="w-full py-4 px-4 bg-transparent text-white outline-none" />
                                            <button type="submit" className={`${currentTheme.buttonClass} px-8 rounded-xl font-bold`}>Zoek</button>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            {/* Categories Grid */}
                            <div className={`${currentTheme.pageBackground} py-16 border-b ${currentTheme.borderColor}`}>
                                <div className="container mx-auto px-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {Object.entries(CATEGORIES).map(([k, d]) => (
                                            <div key={k} onClick={() => handleCategorySelect(k)} className={`${currentTheme.sectionBackground} p-6 rounded-2xl border ${currentTheme.borderColor} hover:border-${currentTheme.accentText} cursor-pointer transition flex flex-col items-center text-center`}>
                                                <i className={`fas ${d.icon} text-2xl mb-2 ${currentTheme.accentText}`}></i>
                                                <h3 className="font-bold text-slate-200">{d.name}</h3>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Latest Reviews */}
                            {latestReviews.length > 0 && (
                                <div className={`${currentTheme.sectionBackground} py-16 border-b ${currentTheme.borderColor}`}>
                                    <div className="container mx-auto px-4">
                                        <h2 className="text-3xl font-bold text-white text-center mb-8">Onlangs Getest</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {latestReviews.map(p => <ProductCard key={p.id} product={p} isCompareSelected={compareList.some(c => c.id === p.id)} onToggleCompare={toggleCompare} onClick={handleOpenProduct} variant="grid" />)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Articles */}
                            {articles.length > 0 && (
                                <div className={`${currentTheme.pageBackground} py-16`}>
                                    <div className="container mx-auto px-4">
                                        <h2 className="text-3xl font-bold text-white text-center mb-8">Gidsen & Advies</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            {articles.slice(0, 4).map(a => (
                                                <div key={a.id} onClick={() => handleOpenArticle(a)} className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-xl overflow-hidden cursor-pointer hover:border-slate-600 transition group`}>
                                                    {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="h-40 w-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                                                    <div className="p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`text-xs px-2 py-0.5 rounded ${getArticleTypeColorClasses(a.type).bg} ${getArticleTypeColorClasses(a.type).text}`}>
                                                                {getArticleTypeLabel(a.type)}
                                                            </span>
                                                        </div>
                                                        <h3 className="font-bold text-white text-sm mb-2 line-clamp-2">{a.title}</h3>
                                                        <div className={`text-xs ${currentTheme.accentText}`}>Lees meer &rarr;</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {articles.length > 4 && (
                                            <div className="text-center mt-8">
                                                <button 
                                                    onClick={() => handleNavigate('artikelen')}
                                                    className={`${currentTheme.buttonClass} px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 transition hover:scale-105`}
                                                >
                                                    Bekijk alle artikelen <i className="fas fa-arrow-right"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ... OTHER VIEWS ... */}
                    {view === 'admin' && isAuthenticated && <AdminPanel onAddProduct={handleAddProduct} onDeleteProduct={handleDeleteProduct} customProducts={customProducts} articles={articles} setArticles={setArticles} onLogout={handleLogout} />}
                    {view === 'login' && <div className="py-20"><Login onLoginSuccess={handleLoginSuccess} /></div>}
                    
                    {/* ARTIKELEN OVERVIEW PAGE */}
                    {view === 'artikelen' && (
                        <div className={`animate-fade-in pb-20 ${currentTheme.pageBackground}`}>
                            {/* Header */}
                            <div className={`${currentTheme.sectionBackground} border-b ${currentTheme.borderColor} py-12`}>
                                <div className="container mx-auto px-4">
                                    {/* Breadcrumbs */}
                                    <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                                        <button onClick={() => handleNavigate('home')} className="hover:text-white transition">Home</button>
                                        <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                                        <span className="text-white font-medium">Artikelen</span>
                                    </nav>
                                    <h1 className="text-4xl font-extrabold text-white mb-4">Artikelen & Koopgidsen</h1>
                                    <p className="text-xl text-slate-400 max-w-2xl">Ontdek onze expertgidsen, vergelijkingen en kooptips voor de beste producten.</p>
                                </div>
                            </div>
                            
                            <div className="container mx-auto px-4 py-8">
                                {/* Filters */}
                                <div className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-xl p-4 mb-8`}>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {/* Search */}
                                        <div className="relative">
                                            <input 
                                                type="text"
                                                value={articleSearchTerm}
                                                onChange={e => setArticleSearchTerm(e.target.value)}
                                                placeholder="Zoeken in artikelen..."
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                            />
                                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
                                        </div>
                                        
                                        {/* Category Filter */}
                                        <select 
                                            value={articleCategoryFilter}
                                            onChange={e => setArticleCategoryFilter(e.target.value)}
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                        >
                                            <option value="">Alle categorieën</option>
                                            {Object.entries(CATEGORIES).map(([k, v]) => (
                                                <option key={k} value={k}>{v.name}</option>
                                            ))}
                                        </select>
                                        
                                        {/* Type Filter */}
                                        <select 
                                            value={articleTypeFilter}
                                            onChange={e => setArticleTypeFilter(e.target.value as ArticleType | '')}
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                        >
                                            <option value="">Alle types</option>
                                            <option value="comparison">Vergelijking</option>
                                            <option value="list">Toplijst</option>
                                            <option value="guide">Koopgids</option>
                                            <option value="informational">Informatief</option>
                                        </select>
                                        
                                        {/* Sort */}
                                        <select 
                                            value={articleSortBy}
                                            onChange={e => setArticleSortBy(e.target.value as 'newest' | 'oldest' | 'alphabetical')}
                                            className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                        >
                                            <option value="newest">Nieuwste eerst</option>
                                            <option value="oldest">Oudste eerst</option>
                                            <option value="alphabetical">Alfabetisch</option>
                                        </select>
                                    </div>
                                </div>
                                
                                {/* Results count */}
                                <div className="text-slate-400 text-sm mb-6">
                                    {filteredArticles.length} artikel{filteredArticles.length !== 1 ? 'en' : ''} gevonden
                                </div>
                                
                                {/* Articles Grid */}
                                {filteredArticles.length === 0 ? (
                                    <div className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-xl p-12 text-center`}>
                                        <i className="fas fa-newspaper text-4xl text-slate-600 mb-4"></i>
                                        <h3 className="text-xl font-bold text-white mb-2">Geen artikelen gevonden</h3>
                                        <p className="text-slate-400">Probeer andere filters of zoektermen.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredArticles.map(article => (
                                            <div 
                                                key={article.id} 
                                                onClick={() => handleOpenArticle(article)}
                                                className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-xl overflow-hidden cursor-pointer hover:border-slate-600 transition group flex flex-col`}
                                            >
                                                {/* Thumbnail */}
                                                {article.imageUrl && (
                                                    <div className="relative h-48 overflow-hidden">
                                                        <img 
                                                            src={article.imageUrl} 
                                                            alt={article.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                                        />
                                                        {/* Type badge */}
                                                        <div className="absolute top-3 left-3">
                                                            <span className={`text-xs px-2 py-1 rounded font-medium ${getArticleTypeColorClasses(article.type).bgFull} text-white`}>
                                                                {getArticleTypeLabel(article.type)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Content */}
                                                <div className="p-5 flex-1 flex flex-col">
                                                    {/* Category tag */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xs text-slate-500">
                                                            <i className={`fas ${CATEGORIES[article.category]?.icon || 'fa-folder'} mr-1`}></i>
                                                            {CATEGORIES[article.category]?.name || article.category}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Title */}
                                                    <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-blue-400 transition">
                                                        {article.title}
                                                    </h3>
                                                    
                                                    {/* Summary */}
                                                    <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-1">
                                                        {article.summary}
                                                    </p>
                                                    
                                                    {/* Footer */}
                                                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                                            <span><i className="fas fa-user mr-1"></i>{article.author}</span>
                                                            <span><i className="fas fa-calendar mr-1"></i>{article.date}</span>
                                                        </div>
                                                        <span className={`text-sm font-medium ${currentTheme.accentText}`}>
                                                            Lees meer <i className="fas fa-arrow-right ml-1"></i>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* ABOUT PAGE */}
                    {view === 'about' && (
                        <div className={`animate-fade-in pb-20 ${currentTheme.pageBackground}`}>
                            <div className={`${currentTheme.sectionBackground} border-b ${currentTheme.borderColor} py-16 text-center`}>
                                <h1 className="text-4xl font-extrabold text-white mb-6">Over ProductPraat</h1>
                                <p className="text-xl text-slate-400">Datagedreven, onafhankelijk en transparant.</p>
                            </div>
                            <div className="container mx-auto px-4 py-16 max-w-4xl text-slate-300 leading-relaxed space-y-6">
                                <p>Wij geloven dat data niet liegt. Daarom combineren we menselijke expertise met geavanceerde AI-analyse om duizenden specificaties en reviews terug te brengen tot één helder advies.</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                                    <div className={`${currentTheme.sectionBackground} p-6 rounded-xl border ${currentTheme.borderColor} text-center`}>
                                        <h4 className="font-bold text-white mb-2">AI Analyse</h4>
                                        <p className="text-xs text-slate-500">Miljoenen datapunten geanalyseerd.</p>
                                    </div>
                                    <div className={`${currentTheme.sectionBackground} p-6 rounded-xl border ${currentTheme.borderColor} text-center`}>
                                        <h4 className="font-bold text-white mb-2">Onafhankelijk</h4>
                                        <p className="text-xs text-slate-500">Geen gesponsorde topposities.</p>
                                    </div>
                                    <div className={`${currentTheme.sectionBackground} p-6 rounded-xl border ${currentTheme.borderColor} text-center`}>
                                        <h4 className="font-bold text-white mb-2">Actueel</h4>
                                        <p className="text-xs text-slate-500">Dagelijkse updates.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTACT PAGE */}
                    {view === 'contact' && (
                        <div className={`animate-fade-in pb-20 ${currentTheme.pageBackground}`}>
                            <div className="container mx-auto px-4 py-16 max-w-2xl">
                                <h1 className="text-3xl font-extrabold text-white mb-8 text-center">Contact</h1>
                                <div className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-2xl p-8`}>
                                    <p className="text-slate-400 mb-6">Vragen of opmerkingen? Stuur een mail naar de redactie.</p>
                                    <a href="mailto:redactie@productpraat.nl" className={`block text-center py-4 rounded-xl font-bold ${currentTheme.buttonClass}`}>redactie@productpraat.nl</a>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'category' && (
                        <div className={`container mx-auto px-4 py-8 ${currentTheme.pageBackground}`}>
                            {/* Breadcrumbs */}
                            <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                                <button onClick={() => handleNavigate('home')} className="hover:text-white transition">Home</button>
                                <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                                <span className="text-white font-medium">{CATEGORIES[activeCategory]?.name}</span>
                            </nav>
                            <h1 className="text-3xl font-bold text-white mb-6">{CATEGORIES[activeCategory]?.name}</h1>
                            <div className="grid gap-6">{visibleProducts.map(p => <ProductCard key={p.id} product={p} isCompareSelected={compareList.some(c => c.id === p.id)} onToggleCompare={toggleCompare} onClick={handleOpenProduct} />)}</div>
                        </div>
                    )}
                    {(view === 'details' || view === 'product') && selectedProduct && (
                        <div className={`container mx-auto px-4 py-8 ${currentTheme.pageBackground}`}>
                            {/* Breadcrumbs */}
                            <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6" aria-label="Breadcrumb">
                                <button onClick={() => handleNavigate('home')} className="hover:text-white transition">Home</button>
                                <i className="fas fa-chevron-right text-xs text-slate-600" aria-hidden="true"></i>
                                <button onClick={() => handleCategorySelect(selectedProduct.category)} className="hover:text-white transition">
                                    {CATEGORIES[selectedProduct.category]?.name || selectedProduct.category}
                                </button>
                                <i className="fas fa-chevron-right text-xs text-slate-600" aria-hidden="true"></i>
                                <span className="text-white font-medium">{selectedProduct.brand} {selectedProduct.model}</span>
                            </nav>
                            <div className="grid lg:grid-cols-2 gap-8">
                                {/* Image Gallery */}
                                <div className="space-y-4">
                                    <div className="bg-white p-8 rounded-xl border border-slate-800">
                                        <img 
                                            src={selectedProduct.image} 
                                            alt={`${selectedProduct.brand} ${selectedProduct.model}`}
                                            className="max-w-full max-h-96 object-contain mx-auto" 
                                            referrerPolicy="no-referrer" 
                                        />
                                    </div>
                                    {/* Thumbnail gallery if multiple images */}
                                    {selectedProduct.images && selectedProduct.images.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {selectedProduct.images.slice(0, 5).map((img, idx) => (
                                                <button 
                                                    key={idx}
                                                    onClick={() => {
                                                        // Update main image
                                                        setSelectedProduct({...selectedProduct, image: img});
                                                    }}
                                                    className={`flex-shrink-0 w-20 h-20 bg-white rounded-lg border-2 overflow-hidden transition ${
                                                        selectedProduct.image === img ? 'border-blue-500' : 'border-slate-700 hover:border-slate-500'
                                                    }`}
                                                >
                                                    <img 
                                                        src={img} 
                                                        alt={`${selectedProduct.brand} ${selectedProduct.model} - afbeelding ${idx + 1}`}
                                                        className="w-full h-full object-contain" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold text-white mb-4">{selectedProduct.brand} {selectedProduct.model}</h1>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="text-4xl font-bold text-[#1877F2]">{selectedProduct.score}</div>
                                        {/* Display Bol.com rating if available */}
                                        {selectedProduct.bolReviewsRaw && selectedProduct.bolReviewsRaw.totalReviews > 0 && (
                                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <i 
                                                            key={star} 
                                                            className={`fas fa-star text-sm ${
                                                                star <= Math.round(selectedProduct.bolReviewsRaw?.averageRating ?? 0) 
                                                                    ? 'text-yellow-400' 
                                                                    : 'text-slate-600'
                                                            }`}
                                                        ></i>
                                                    ))}
                                                </div>
                                                <span className="text-sm text-slate-400">
                                                    ({selectedProduct.bolReviewsRaw.totalReviews} reviews)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Price */}
                                    <div className="text-3xl font-bold text-white mb-4">€{selectedProduct.price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</div>
                                    
                                    {/* Pros and Cons */}
                                    {(selectedProduct.pros?.length > 0 || selectedProduct.cons?.length > 0) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                            {selectedProduct.pros && selectedProduct.pros.length > 0 && (
                                                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                                                    <h3 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                                                        <i className="fas fa-plus-circle"></i> Pluspunten
                                                    </h3>
                                                    <ul className="space-y-1">
                                                        {selectedProduct.pros.map((pro, idx) => (
                                                            <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                                                                <i className="fas fa-check text-xs mt-1.5 text-green-400"></i>
                                                                <span>{pro}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {selectedProduct.cons && selectedProduct.cons.length > 0 && (
                                                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                                    <h3 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                                                        <i className="fas fa-minus-circle"></i> Minpunten
                                                    </h3>
                                                    <ul className="space-y-1">
                                                        {selectedProduct.cons.map((con, idx) => (
                                                            <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                                                                <i className="fas fa-times text-xs mt-1.5 text-red-400"></i>
                                                                <span>{con}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {selectedProduct.keywords && selectedProduct.keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {selectedProduct.keywords.map((kw, i) => (
                                                <span key={i} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">{kw}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div dangerouslySetInnerHTML={{ __html: selectedProduct.longDescription || '' }} className="prose prose-invert mb-8" />
                                    <a 
                                        href={selectedProduct.affiliateLink || selectedProduct.affiliateUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`w-full py-4 rounded-xl font-bold text-lg mb-8 flex items-center justify-center ${currentTheme.buttonClass}`}
                                    >
                                        <i className="fas fa-external-link-alt mr-2"></i>Bekijk aanbieding
                                    </a>
                                    <UserReviewSection productId={selectedProduct.id} />
                                </div>
                            </div>
                        </div>
                    )}
                    {/* 404 Not Found Page */}
                    {view === '404' && (
                        <div className={`container mx-auto px-4 py-16 text-center ${currentTheme.pageBackground}`}>
                            <div className="max-w-md mx-auto">
                                <div className="text-8xl font-black text-slate-700 mb-4">404</div>
                                <h1 className="text-3xl font-bold text-white mb-4">Pagina niet gevonden</h1>
                                <p className="text-slate-400 mb-8">
                                    Het product dat je zoekt bestaat niet of is verplaatst. 
                                    Probeer te zoeken of bekijk onze categorieën.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <button 
                                        onClick={() => handleNavigate('home')} 
                                        className={`px-6 py-3 rounded-xl font-bold ${currentTheme.buttonClass}`}
                                    >
                                        <i className="fas fa-home mr-2"></i>Naar Home
                                    </button>
                                    <button 
                                        onClick={() => handleCategorySelect('wasmachines')} 
                                        className="px-6 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition"
                                    >
                                        <i className="fas fa-th-large mr-2"></i>Bekijk Categorieën
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {view === 'article' && selectedArticle && (
                        <div className={`animate-fade-in pb-20 ${currentTheme.pageBackground}`}>
                            <div className="container mx-auto px-4 py-8 max-w-4xl">
                                {/* Breadcrumbs */}
                                <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6" aria-label="Breadcrumb">
                                    <button onClick={() => handleNavigate('home')} className="hover:text-white transition">Home</button>
                                    <i className="fas fa-chevron-right text-xs text-slate-600" aria-hidden="true"></i>
                                    <button onClick={() => handleNavigate('artikelen')} className="hover:text-white transition">Artikelen</button>
                                    <i className="fas fa-chevron-right text-xs text-slate-600" aria-hidden="true"></i>
                                    <span className="text-white font-medium line-clamp-1">{selectedArticle.title}</span>
                                </nav>
                                
                                {/* Article Header */}
                                <header className="mb-8">
                                    {/* Type badge and Category */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`text-xs px-2 py-1 rounded font-medium ${getArticleTypeColorClasses(selectedArticle.type).bgFull} text-white`}>
                                            {getArticleTypeLabel(selectedArticle.type)}
                                        </span>
                                        <span className="text-sm text-slate-500">
                                            <i className={`fas ${CATEGORIES[selectedArticle.category]?.icon || 'fa-folder'} mr-1`}></i>
                                            {CATEGORIES[selectedArticle.category]?.name || selectedArticle.category}
                                        </span>
                                    </div>
                                    
                                    <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">{selectedArticle.title}</h1>
                                    
                                    {/* Meta info */}
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-6">
                                        <span className="flex items-center gap-1">
                                            <i className="fas fa-user"></i> {selectedArticle.author}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <i className="fas fa-calendar"></i> {selectedArticle.date}
                                        </span>
                                        {selectedArticle.lastUpdated && selectedArticle.lastUpdated !== selectedArticle.created_at && (
                                            <span className="flex items-center gap-1 text-green-400">
                                                <i className="fas fa-sync-alt"></i> Bijgewerkt: {new Date(selectedArticle.lastUpdated).toLocaleDateString('nl-NL')}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <i className="fas fa-clock"></i> {getReadingTime(selectedArticle.htmlContent)} min leestijd
                                        </span>
                                    </div>
                                    
                                    {/* Tags */}
                                    {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedArticle.tags.map((tag, i) => (
                                                <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </header>
                                
                                {/* Featured Image */}
                                {selectedArticle.imageUrl && (
                                    <div className="mb-8 rounded-xl overflow-hidden">
                                        <img 
                                            src={selectedArticle.imageUrl} 
                                            alt={selectedArticle.title}
                                            className="w-full h-64 md:h-96 object-cover"
                                        />
                                    </div>
                                )}
                                
                                {/* Summary */}
                                {selectedArticle.summary && (
                                    <div className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-xl p-6 mb-8`}>
                                        <p className="text-lg text-slate-300 leading-relaxed italic">
                                            {selectedArticle.summary}
                                        </p>
                                    </div>
                                )}
                                
                                {/* Article Content */}
                                <article className="article-preview mb-12">
                                    <div dangerouslySetInnerHTML={{ __html: removeFirstH1FromHtml(selectedArticle.htmlContent) }} />
                                </article>
                                
                                {/* Related Articles */}
                                {getRelatedArticles(selectedArticle).length > 0 && (
                                    <section className="mt-16 pt-8 border-t border-slate-800">
                                        <h2 className="text-2xl font-bold text-white mb-6">Gerelateerde Artikelen</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {getRelatedArticles(selectedArticle).map(related => (
                                                <div 
                                                    key={related.id}
                                                    onClick={() => handleOpenArticle(related)}
                                                    className={`${currentTheme.sectionBackground} border ${currentTheme.borderColor} rounded-xl overflow-hidden cursor-pointer hover:border-slate-600 transition group`}
                                                >
                                                    {related.imageUrl && (
                                                        <img 
                                                            src={related.imageUrl} 
                                                            alt={related.title}
                                                            className="h-32 w-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    )}
                                                    <div className="p-4">
                                                        <span className={`text-xs px-2 py-0.5 rounded ${getArticleTypeColorClasses(related.type).bg} ${getArticleTypeColorClasses(related.type).text}`}>
                                                            {getArticleTypeLabel(related.type)}
                                                        </span>
                                                        <h3 className="font-bold text-white text-sm mt-2 line-clamp-2 group-hover:text-blue-400 transition">
                                                            {related.title}
                                                        </h3>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                
                                {/* Back to articles button */}
                                <div className="mt-8 pt-8 border-t border-slate-800 text-center">
                                    <button 
                                        onClick={() => handleNavigate('artikelen')}
                                        className={`${currentTheme.buttonClass} px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2`}
                                    >
                                        <i className="fas fa-arrow-left"></i> Terug naar artikelen
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
                {renderFooter()}
            </div>
            
            {/* Article Preview Styling */}
            <style>{`
                .article-preview h1 {
                    /* Fallback styling in case H1 is not removed programmatically */
                    font-size: 2rem;
                    font-weight: 800;
                    color: white;
                    margin-bottom: 1.5rem;
                    line-height: 1.2;
                }
                
                .article-preview h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: white;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                    border-bottom: 2px solid #1e40af;
                    padding-bottom: 0.5rem;
                }
                
                .article-preview h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #e2e8f0;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                }
                
                .article-preview p {
                    color: #cbd5e1;
                    line-height: 1.7;
                    margin-bottom: 1rem;
                }
                
                .article-preview strong {
                    color: white;
                    font-weight: 600;
                }
                
                .article-preview ul, .article-preview ol {
                    color: #cbd5e1;
                    margin-left: 1.5rem;
                    margin-bottom: 1rem;
                }
                
                .article-preview ul {
                    list-style-type: disc;
                }
                
                .article-preview ol {
                    list-style-type: decimal;
                }
                
                .article-preview li {
                    margin-bottom: 0.5rem;
                    line-height: 1.6;
                }
                
                .article-preview blockquote {
                    border-left: 4px solid #3b82f6;
                    font-style: italic;
                    color: #94a3b8;
                    margin: 1.5rem 0;
                    background: rgba(59, 130, 246, 0.1);
                    padding: 1rem 1rem 1rem 1.5rem;
                    border-radius: 0.5rem;
                }
                
                .article-preview table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1.5rem 0;
                    border: 1px solid #334155;
                }
                
                .article-preview thead {
                    background: #1e293b;
                }
                
                .article-preview th {
                    border: 1px solid #334155;
                    padding: 0.75rem 1rem;
                    text-align: left;
                    font-weight: 600;
                    color: white;
                }
                
                .article-preview td {
                    border: 1px solid #334155;
                    padding: 0.75rem 1rem;
                    color: #cbd5e1;
                }
                
                .article-preview tbody tr:hover {
                    background: rgba(59, 130, 246, 0.1);
                }
                
                .article-preview figure {
                    margin: 1.5rem 0;
                }
                
                .article-preview figure img {
                    width: 100%;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                }
                
                .article-preview figcaption {
                    font-size: 0.875rem;
                    color: #94a3b8;
                    text-align: center;
                    margin-top: 0.5rem;
                }
            `}</style>
        </div>
    );
};
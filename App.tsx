import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { ProductCard } from './components/ProductCard';
import { AdminPanel } from './components/AdminPanel';
import { Login } from './components/Login';
import { HomeView } from './components/views/HomeView';
import { ProductView } from './components/views/ProductView';
import { Product, CATEGORIES, Article, ArticleType } from './types';
import { db } from './services/storage';
import { seoService } from './services/seoService';
import { authService } from './services/authService';
import { urlRouter, generateSlug, getCanonicalUrl, getArticleUrl, generateArticleSlug, ARTICLE_TYPE_LABELS, ARTICLE_TYPE_COLORS, removeFirstH1FromHtml, isProductUrl, parseProductUrl, isArticleUrl, isArticlesOverviewUrl, parseArticleUrl, getProductUrl } from './services/urlService';
import { ShopPage } from './src/pages/ShopPage';
import { ProductDetailPage } from './src/pages/ProductDetailPage';

type ViewType = 'home' | 'category' | 'admin' | 'product' | 'article' | 'about' | 'contact' | 'login' | 'artikelen' | '404' | 'search' | 'bolshop' | 'bolproduct';

const theme = {
    pageBackground: 'bg-slate-950',
    sectionBackground: 'bg-slate-900',
    borderColor: 'border-slate-800',
    accentText: 'text-[#1877F2]',
    buttonClass: 'bg-[#1877F2] hover:bg-blue-600 text-white'
};

export const App: React.FC = () => {
    const [view, setView] = useState<ViewType>('home');
    const [activeCategory, setActiveCategory] = useState<string>('wasmachines');
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [selectedBolProductEan, setSelectedBolProductEan] = useState<string>('');
    const [shopCategory, setShopCategory] = useState<string>('');

    // URL Routing handler
    const handleUrlRouting = (prods: Product[], arts: Article[]) => {
        const path = window.location.pathname;
        
        // Check for Bol.com shop routes first
        if (path === '/bolshop' || path.startsWith('/bolshop/')) {
            const productMatch = path.match(/^\/bolshop\/product\/([^\/]+)\/?$/);
            if (productMatch) {
                setSelectedBolProductEan(productMatch[1]);
                setView('bolproduct');
                return;
            }
            const categoryMatch = path.match(/^\/bolshop\/([^\/]+)\/?$/);
            if (categoryMatch && categoryMatch[1] !== 'product') {
                setShopCategory(categoryMatch[1]);
            }
            setView('bolshop');
            return;
        }
        
        if (isProductUrl(path)) {
            const parsed = parseProductUrl(path);
            if (parsed) {
                const product = prods.find(p => {
                    const slug = (p.slug || generateSlug(p.brand, p.model)).toLowerCase();
                    return p.category.toLowerCase() === parsed.category.toLowerCase() && slug === parsed.slug.toLowerCase();
                });
                if (product) { setSelectedProduct(product); setActiveCategory(product.category); setView('product'); return; }
            }
            setView('404'); return;
        }
        
        if (isArticlesOverviewUrl(path)) { setView('artikelen'); return; }
        
        if (isArticleUrl(path)) {
            const parsed = parseArticleUrl(path);
            if (parsed) {
                const article = arts.find(a => (a.slug || generateArticleSlug(a)).toLowerCase() === parsed.slug.toLowerCase());
                if (article) { setSelectedArticle(article); setView('article'); return; }
            }
            setView('404'); return;
        }
        
        const categoryMatch = path.match(/^\/shop\/([^\/]+)\/?$/);
        if (categoryMatch && CATEGORIES[categoryMatch[1].toLowerCase()]) {
            setActiveCategory(categoryMatch[1].toLowerCase()); setView('category'); return;
        }
        
        if (path === '/' || path === '') setView('home');
        else if (path === '/about') setView('about');
        else if (path === '/contact') setView('contact');
        else if (path === '/admin' || path === '/dashboard') setView(isAuthenticated ? 'admin' : 'login');
    };

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const [isAuth, prods, arts] = await Promise.all([
                    authService.isAuthenticated(),
                    db.getAll(),
                    db.getArticles()
                ]);
                setIsAuthenticated(isAuth);
                setProducts(prods);
                setArticles(arts);
                handleUrlRouting(prods, arts);
            } catch (e) { console.error("Failed to load data", e); }
            finally { setIsLoading(false); }
        };
        loadData();
    }, []);

    useEffect(() => {
        const handlePopState = () => handleUrlRouting(products, articles);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [products, articles]);

    // SEO
    useEffect(() => {
        seoService.clearSchema();
        if (view === 'home') seoService.updateMeta("ProductPraat.nl - Wij testen ALLES", "100% onafhankelijke reviews.", undefined, window.location.origin);
        else if (view === 'product' && selectedProduct) {
            seoService.updateMeta(selectedProduct.metaDescription || `${selectedProduct.brand} ${selectedProduct.model} Review`, selectedProduct.description || '', selectedProduct.image, getCanonicalUrl(selectedProduct));
            seoService.setProductSchema(selectedProduct);
        }
        else if (view === 'bolshop') {
            seoService.updateMeta("Bol.com Shop - ProductPraat", "Vind de beste deals en producten via Bol.com.", undefined, window.location.origin + '/bolshop');
        }
    }, [view, selectedProduct]);

    const visibleProducts = useMemo(() => products.filter(p => p.category === activeCategory).sort((a, b) => b.score - a.score), [products, activeCategory]);

    // Navigation handlers
    const handleNavigate = (target: 'home' | 'admin' | 'about' | 'contact' | 'artikelen' | 'bolshop') => {
        if (target === 'admin' && !isAuthenticated) { setView('login'); urlRouter.push('/dashboard'); }
        else if (target === 'admin') { setView('admin'); urlRouter.push('/dashboard'); }
        else if (target === 'artikelen') { setView('artikelen'); urlRouter.push('/artikelen'); }
        else if (target === 'bolshop') { setView('bolshop'); urlRouter.push('/bolshop'); }
        else { setView(target); urlRouter.push(target === 'home' ? '/' : `/${target}`); }
        window.scrollTo(0, 0);
    };

    const handleCategorySelect = (categoryId: string) => { setActiveCategory(categoryId); setView('category'); urlRouter.push(`/shop/${categoryId}`); window.scrollTo(0, 0); };
    const handleOpenProduct = (id: string) => {
        const product = products.find(p => p.id === id);
        if (product) { setSelectedProduct(product); setActiveCategory(product.category); setView('product'); urlRouter.push(getProductUrl(product)); window.scrollTo(0, 0); }
    };
    const handleOpenArticle = (article: Article) => { setSelectedArticle(article); setView('article'); urlRouter.push(getArticleUrl(article)); window.scrollTo(0, 0); };
    const handleSearch = (e?: React.FormEvent) => { if (e) e.preventDefault(); if (searchTerm.trim()) { setView('search'); urlRouter.push(`/search?q=${encodeURIComponent(searchTerm)}`); } };
    const handleLoginSuccess = () => { setIsAuthenticated(true); setView('admin'); urlRouter.push('/dashboard'); };
    const handleLogout = async () => { await authService.logout(); setIsAuthenticated(false); setView('login'); urlRouter.push('/dashboard'); };
    const handleAddProduct = async (newProduct: Product) => {
        try {
            console.log('🚀 handleAddProduct called with:', newProduct.brand, newProduct.model);
            const updated = await db.add(newProduct);
            console.log('✅ Product toegevoegd, updated list length:', updated.length);
            setProducts(updated);
            
            if (CATEGORIES[newProduct.category]) {
                setActiveCategory(newProduct.category);
                setView('category');
                urlRouter.push(`/shop/${newProduct.category}`);
            }
        } catch (error) {
            console.error('❌ handleAddProduct failed:', error);
            alert(`Fout bij toevoegen product: ${error instanceof Error ? error.message : String(error)}`);
            throw error; // Re-throw so caller knows it failed
        }
    };
    const handleDeleteProduct = async (id: string) => { const updated = await db.remove(id); setProducts(updated); };

    // Footer
    const renderFooter = () => (
        <footer className={`${theme.pageBackground} text-slate-400 border-t ${theme.borderColor} mt-auto text-center`}>
            <div className="container mx-auto px-4 py-8">
                <div className="font-extrabold text-xl text-white mb-4">Product<span className={theme.accentText}>Praat</span></div>
                <div className="flex justify-center gap-6 text-sm mb-4">
                    <button onClick={() => handleNavigate('about')} className="hover:text-white transition">Over ons</button>
                    <button onClick={() => handleNavigate('contact')} className="hover:text-white transition">Contact</button>
                </div>
                <div className="text-xs text-slate-600">&copy; 2026 ProductPraat.nl <button onClick={() => handleNavigate('admin')} className="ml-4 hover:text-slate-400"><i className="fas fa-lock"></i></button></div>
            </div>
        </footer>
    );

    if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><i className="fas fa-spinner fa-spin text-4xl text-[#1877F2]"></i></div>;

    return (
        <div className={`flex flex-col min-h-screen ${theme.pageBackground} text-slate-200`}>
            <Header onNavigate={handleNavigate} onSelectCategory={handleCategorySelect} activeView={view} />
            <main className="flex-1 flex flex-col">
                {view === 'home' && <HomeView products={products} articles={articles} searchTerm={searchTerm} setSearchTerm={setSearchTerm} onSearch={handleSearch} onSelectCategory={handleCategorySelect} onOpenProduct={handleOpenProduct} onOpenArticle={handleOpenArticle} onNavigateToArticles={() => handleNavigate('artikelen')} />}
               {view === 'admin' && isAuthenticated && <SimpleDashboard products={products} onLogout={handleLogout} />}
                {view === 'login' && <div className="py-20"><Login onLoginSuccess={handleLoginSuccess} /></div>}
                {view === 'product' && selectedProduct && <ProductView product={selectedProduct} onNavigateHome={() => handleNavigate('home')} onNavigateCategory={handleCategorySelect} />}
                {view === 'category' && (
                    <div className="container mx-auto px-4 py-8">
                        <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                            <button onClick={() => handleNavigate('home')} className="hover:text-white">Home</button>
                            <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                            <span className="text-white font-medium">{CATEGORIES[activeCategory]?.name}</span>
                        </nav>
                        <h1 className="text-3xl font-bold text-white mb-6">{CATEGORIES[activeCategory]?.name}</h1>
                        <div className="grid gap-6">{visibleProducts.map(p => <ProductCard key={p.id} product={p} isCompareSelected={false} onToggleCompare={() => {}} onClick={handleOpenProduct} />)}</div>
                    </div>
                )}
                {view === 'artikelen' && (
                    <div className="container mx-auto px-4 py-8">
                        <h1 className="text-3xl font-bold text-white mb-6">Artikelen & Koopgidsen</h1>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {articles.map(a => (
                                <div key={a.id} onClick={() => handleOpenArticle(a)} className={`${theme.sectionBackground} border ${theme.borderColor} rounded-xl overflow-hidden cursor-pointer hover:border-slate-600 transition`}>
                                    {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="h-40 w-full object-cover" />}
                                    <div className="p-4">
                                        <span className={`text-xs px-2 py-0.5 rounded ${ARTICLE_TYPE_COLORS[a.type]?.bg} ${ARTICLE_TYPE_COLORS[a.type]?.text}`}>{ARTICLE_TYPE_LABELS[a.type]}</span>
                                        <h3 className="font-bold text-white text-sm mt-2">{a.title}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {view === 'article' && selectedArticle && (
                    <div className="container mx-auto px-4 py-8 max-w-4xl">
                        <button onClick={() => handleNavigate('artikelen')} className="text-sm text-slate-400 hover:text-white mb-4"><i className="fas fa-arrow-left mr-2"></i>Terug</button>
                        <h1 className="text-4xl font-bold text-white mb-4">{selectedArticle.title}</h1>
                        {selectedArticle.imageUrl && <img src={selectedArticle.imageUrl} alt={selectedArticle.title} className="w-full h-64 object-cover rounded-xl mb-6" />}
                        <article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: removeFirstH1FromHtml(selectedArticle.htmlContent) }} />
                    </div>
                )}
                {view === 'about' && (
                    <div className="container mx-auto px-4 py-16 max-w-4xl">
                        <h1 className="text-4xl font-bold text-white mb-6 text-center">Over ProductPraat</h1>
                        <p className="text-slate-300 text-center">Datagedreven, onafhankelijk en transparant productadvies.</p>
                    </div>
                )}
                {view === 'contact' && (
                    <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
                        <h1 className="text-3xl font-bold text-white mb-8">Contact</h1>
                        <a href="mailto:redactie@productpraat.nl" className={`${theme.buttonClass} px-6 py-3 rounded-xl font-bold inline-block`}>redactie@productpraat.nl</a>
                    </div>
                )}
                {view === '404' && (
                    <div className="container mx-auto px-4 py-16 text-center">
                        <div className="text-8xl font-black text-slate-700 mb-4">404</div>
                        <h1 className="text-3xl font-bold text-white mb-4">Pagina niet gevonden</h1>
                        <button onClick={() => handleNavigate('home')} className={`${theme.buttonClass} px-6 py-3 rounded-xl font-bold`}>Naar Home</button>
                    </div>
                )}
                {view === 'search' && (
                    <div className="container mx-auto px-4 py-8">
                        <h1 className="text-2xl font-bold text-white mb-6">Zoekresultaten voor "{searchTerm}"</h1>
                        <div className="grid gap-6">{products.filter(p => p.brand.toLowerCase().includes(searchTerm.toLowerCase()) || p.model.toLowerCase().includes(searchTerm.toLowerCase())).map(p => <ProductCard key={p.id} product={p} isCompareSelected={false} onToggleCompare={() => {}} onClick={handleOpenProduct} />)}</div>
                    </div>
                )}
                {view === 'bolshop' && (
                    <ShopPage
                        initialCategory={shopCategory}
                        onNavigateHome={() => handleNavigate('home')}
                    />
                )}
                {view === 'bolproduct' && selectedBolProductEan && (
                    <ProductDetailPage
                        ean={selectedBolProductEan}
                        onNavigateBack={() => { setView('bolshop'); urlRouter.push('/bolshop'); }}
                        onNavigateCategory={(categoryId) => { setShopCategory(categoryId); setView('bolshop'); urlRouter.push(`/bolshop/${categoryId}`); }}
                    />
                )}
            </main>
            {renderFooter()}
        </div>
    );
};

import { useEffect, useCallback } from 'react';
import { Product, Article, CATEGORIES } from '../../types';
import { parseProductUrl, isProductUrl, getProductUrl, urlRouter, generateSlug, isArticleUrl, isArticlesOverviewUrl, parseArticleUrl, getArticleUrl, generateArticleSlug } from '../../services/urlService';
import type { ViewType } from './useAppState';

interface UseRoutingProps {
    products: Product[];
    articles: Article[];
    isAuthenticated: boolean;
    setView: (view: ViewType) => void;
    setActiveCategory: (category: string) => void;
    setSelectedProduct: (product: Product | null) => void;
    setSelectedArticle: (article: Article | null) => void;
}

export const useRouting = ({
    products,
    articles,
    isAuthenticated,
    setView,
    setActiveCategory,
    setSelectedProduct,
    setSelectedArticle
}: UseRoutingProps) => {
    
    const handleUrlRouting = useCallback(() => {
        const path = window.location.pathname;
        
        // Product URL: /shop/{category}/{slug}
        if (isProductUrl(path)) {
            const parsed = parseProductUrl(path);
            if (parsed) {
                const { category, slug } = parsed;
                const categoryProducts = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
                const product = categoryProducts.find(p => {
                    const productSlug = (p.slug || generateSlug(p.brand, p.model)).toLowerCase();
                    return productSlug === slug.toLowerCase();
                });
                
                if (product) {
                    setSelectedProduct(product);
                    setActiveCategory(product.category);
                    setView('product');
                    return;
                }
                setView('404');
                return;
            }
        }
        
        // Articles overview: /artikelen
        if (isArticlesOverviewUrl(path)) {
            setView('artikelen');
            return;
        }
        
        // Single article: /artikelen/{slug}
        if (isArticleUrl(path)) {
            const parsed = parseArticleUrl(path);
            if (parsed) {
                const article = articles.find(a => {
                    const articleSlug = (a.slug || generateArticleSlug(a)).toLowerCase();
                    return articleSlug === parsed.slug.toLowerCase();
                });
                
                if (article) {
                    setSelectedArticle(article);
                    setView('article');
                    return;
                }
                setView('404');
                return;
            }
        }
        
        // Category URL: /shop/{category}
        const categoryMatch = path.match(/^\/shop\/([^\/]+)\/?$/);
        if (categoryMatch) {
            const category = categoryMatch[1].toLowerCase();
            if (CATEGORIES[category]) {
                setActiveCategory(category);
                setView('category');
                return;
            }
        }
        
        // Static routes
        if (path === '/' || path === '') {
            setView('home');
        } else if (path === '/about') {
            setView('about');
        } else if (path === '/contact') {
            setView('contact');
        } else if (path === '/admin' || path === '/dashboard') {
            setView(isAuthenticated ? 'admin' : 'login');
        }
    }, [products, articles, isAuthenticated, setView, setActiveCategory, setSelectedProduct, setSelectedArticle]);

    // Initial routing
    useEffect(() => {
        if (products.length > 0 || articles.length > 0) {
            handleUrlRouting();
        }
    }, [products.length > 0, articles.length > 0]);

    // Browser back/forward
    useEffect(() => {
        const handlePopState = () => handleUrlRouting();
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [handleUrlRouting]);

    // Navigation helpers
    const navigateTo = useCallback((target: 'home' | 'admin' | 'about' | 'contact' | 'artikelen') => {
        if (target === 'admin' && !isAuthenticated) {
            setView('login');
            urlRouter.push('/dashboard');
        } else if (target === 'admin') {
            setView('admin');
            urlRouter.push('/dashboard');
        } else if (target === 'artikelen') {
            setView('artikelen');
            urlRouter.push('/artikelen');
        } else {
            setView(target);
            if (target === 'home') urlRouter.push('/');
            else urlRouter.push(`/${target}`);
        }
        window.scrollTo(0, 0);
    }, [isAuthenticated, setView]);

    const navigateToCategory = useCallback((categoryId: string) => {
        setActiveCategory(categoryId);
        setView('category');
        urlRouter.push(`/shop/${categoryId}`);
        window.scrollTo(0, 0);
    }, [setActiveCategory, setView]);

    const navigateToProduct = useCallback((product: Product) => {
        setSelectedProduct(product);
        setActiveCategory(product.category);
        setView('product');
        urlRouter.push(getProductUrl(product));
        window.scrollTo(0, 0);
    }, [setSelectedProduct, setActiveCategory, setView]);

    const navigateToArticle = useCallback((article: Article) => {
        setSelectedArticle(article);
        setView('article');
        urlRouter.push(getArticleUrl(article));
        window.scrollTo(0, 0);
    }, [setSelectedArticle, setView]);

    return {
        navigateTo,
        navigateToCategory,
        navigateToProduct,
        navigateToArticle
    };
};

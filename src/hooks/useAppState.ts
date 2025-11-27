import { useState, useEffect, useMemo } from 'react';
import { Product, Article, CATEGORIES } from '../../types';
import { db } from '../../services/storage';
import { authService } from '../../services/authService';

export type ViewType = 'home' | 'category' | 'admin' | 'product' | 'article' | 'about' | 'contact' | 'login' | 'artikelen' | '404';

export interface AppState {
    view: ViewType;
    setView: (view: ViewType) => void;
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    products: Product[];
    setProducts: (products: Product[]) => void;
    articles: Article[];
    setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
    selectedProduct: Product | null;
    setSelectedProduct: (product: Product | null) => void;
    selectedArticle: Article | null;
    setSelectedArticle: (article: Article | null) => void;
    isAuthenticated: boolean;
    setIsAuthenticated: (auth: boolean) => void;
    isLoading: boolean;
}

export const useAppState = (): AppState => {
    const [view, setView] = useState<ViewType>('home');
    const [activeCategory, setActiveCategory] = useState<string>('wasmachines');
    const [products, setProducts] = useState<Product[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const isAuth = await authService.isAuthenticated();
                setIsAuthenticated(isAuth);
                
                const prods = await db.getAll();
                setProducts(prods);
                
                const arts = await db.getArticles();
                setArticles(arts);
            } catch (e) {
                console.error("Failed to load data", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    return {
        view,
        setView,
        activeCategory,
        setActiveCategory,
        products,
        setProducts,
        articles,
        setArticles,
        selectedProduct,
        setSelectedProduct,
        selectedArticle,
        setSelectedArticle,
        isAuthenticated,
        setIsAuthenticated,
        isLoading
    };
};

// Helper hooks for derived state
export const useVisibleProducts = (products: Product[], activeCategory: string) => {
    return useMemo(() => {
        return products
            .filter(p => p.category === activeCategory)
            .sort((a, b) => b.score - a.score);
    }, [products, activeCategory]);
};

export const useLatestReviews = (products: Product[], count: number = 4) => {
    return useMemo(() => products.slice(0, count), [products, count]);
};

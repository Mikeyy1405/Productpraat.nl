import React from 'react';
import { Product, Article, CATEGORIES } from '../../types';
import { ProductCard } from '../ProductCard';
import { ARTICLE_TYPE_LABELS, ARTICLE_TYPE_COLORS } from '../../services/urlService';

interface HomeViewProps {
    products: Product[];
    articles: Article[];
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onSearch: (e: React.FormEvent) => void;
    onSelectCategory: (category: string) => void;
    onOpenProduct: (id: string) => void;
    onOpenArticle: (article: Article) => void;
    onNavigateToArticles: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
    products,
    articles,
    searchTerm,
    setSearchTerm,
    onSearch,
    onSelectCategory,
    onOpenProduct,
    onOpenArticle,
    onNavigateToArticles
}) => {
    const latestReviews = products.slice(0, 4);
    const getArticleTypeLabel = (type: string) => ARTICLE_TYPE_LABELS[type as keyof typeof ARTICLE_TYPE_LABELS] || type;
    const getArticleTypeColors = (type: string) => ARTICLE_TYPE_COLORS[type as keyof typeof ARTICLE_TYPE_COLORS] || ARTICLE_TYPE_COLORS['informational'];

    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-slate-950 border-b border-slate-800">
                <div className="container mx-auto px-4 py-24 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md text-xs font-bold mb-8 bg-slate-900/80 text-blue-400 border-slate-700">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        <i className="fas fa-check-circle"></i>
                        Update: Testresultaten {new Date().toLocaleString('nl-NL', { month: 'long' })} {new Date().getFullYear()} Live
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black text-white mb-8">
                        Wij testen <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-blue-500 to-purple-500">alles</span>. Jij kiest de beste.
                    </h1>
                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed font-light">
                        Het meest complete consumentenplatform van de Benelux. 100% onafhankelijk, datagedreven en eerlijk.
                    </p>
                    
                    <form onSubmit={onSearch} className="w-full max-w-2xl mx-auto relative">
                        <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-2 flex shadow-2xl">
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                placeholder="Zoek product..." 
                                className="w-full py-4 px-4 bg-transparent text-white outline-none" 
                            />
                            <button type="submit" className="bg-[#1877F2] hover:bg-blue-600 text-white px-8 rounded-xl font-bold">Zoek</button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Categories Grid */}
            <div className="bg-slate-950 py-16 border-b border-slate-800">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(CATEGORIES).map(([k, d]) => (
                            <div 
                                key={k} 
                                onClick={() => onSelectCategory(k)} 
                                className="bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-blue-500 cursor-pointer transition flex flex-col items-center text-center"
                            >
                                <i className={`fas ${d.icon} text-2xl mb-2 text-[#1877F2]`}></i>
                                <h3 className="font-bold text-slate-200">{d.name}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Latest Reviews */}
            {latestReviews.length > 0 && (
                <div className="bg-slate-900 py-16 border-b border-slate-800">
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-white text-center mb-8">Onlangs Getest</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {latestReviews.map(p => (
                                <ProductCard 
                                    key={p.id} 
                                    product={p} 
                                    isCompareSelected={false} 
                                    onToggleCompare={() => {}} 
                                    onClick={onOpenProduct} 
                                    variant="grid" 
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Articles */}
            {articles.length > 0 && (
                <div className="bg-slate-950 py-16">
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl font-bold text-white text-center mb-8">Gidsen & Advies</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {articles.slice(0, 4).map(a => (
                                <div 
                                    key={a.id} 
                                    onClick={() => onOpenArticle(a)} 
                                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-slate-600 transition group"
                                >
                                    {a.imageUrl && <img src={a.imageUrl} alt={a.title} className="h-40 w-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-xs px-2 py-0.5 rounded ${getArticleTypeColors(a.type).bg} ${getArticleTypeColors(a.type).text}`}>
                                                {getArticleTypeLabel(a.type)}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-white text-sm mb-2 line-clamp-2">{a.title}</h3>
                                        <div className="text-xs text-[#1877F2]">Lees meer &rarr;</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {articles.length > 4 && (
                            <div className="text-center mt-8">
                                <button 
                                    onClick={onNavigateToArticles}
                                    className="bg-[#1877F2] hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 transition hover:scale-105"
                                >
                                    Bekijk alle artikelen <i className="fas fa-arrow-right"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

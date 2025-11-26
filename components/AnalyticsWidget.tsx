import React, { useState, useEffect } from 'react';
import { Product, Article } from '../types';

interface AnalyticsWidgetProps {
    products: Product[];
    articles: Article[];
}

export const AnalyticsWidget: React.FC<AnalyticsWidgetProps> = ({ products, articles }) => {
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalArticles: 0,
        avgProductScore: 0,
        productsAddedThisWeek: 0,
        articlesAddedThisWeek: 0,
        topCategory: '',
        topCategoryCount: 0
    });

    useEffect(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Count products added this week
        const productsThisWeek = products.filter(p => {
            const parts = p.id.split('-');
            if (parts.length < 2) return false;
            const timestamp = parseInt(parts[1]);
            return !isNaN(timestamp) && new Date(timestamp) > oneWeekAgo;
        }).length;

        // Count articles added this week
        const articlesThisWeek = articles.filter(a => {
            return a.created_at && new Date(a.created_at) > oneWeekAgo;
        }).length;

        // Calculate average score
        const avgScore = products.length > 0 
            ? products.reduce((sum, p) => sum + p.score, 0) / products.length 
            : 0;

        // Find top category
        const categoryCount: Record<string, number> = {};
        products.forEach(p => {
            categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
        });
        const categoryEntries = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
        const topCat = categoryEntries.length > 0 ? categoryEntries[0] : null;

        setStats({
            totalProducts: products.length,
            totalArticles: articles.length,
            avgProductScore: Math.round(avgScore * 10) / 10,
            productsAddedThisWeek: productsThisWeek,
            articlesAddedThisWeek: articlesThisWeek,
            topCategory: topCat ? topCat[0] : 'N/A',
            topCategoryCount: topCat ? topCat[1] : 0
        });
    }, [products, articles]);

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <i className="fas fa-chart-line text-blue-400"></i> Analytics Overzicht
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-2xl font-bold text-blue-400">{stats.totalProducts}</div>
                    <div className="text-xs text-slate-400">Totaal Producten</div>
                    {stats.productsAddedThisWeek > 0 && (
                        <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                            <i className="fas fa-arrow-up"></i> +{stats.productsAddedThisWeek} deze week
                        </div>
                    )}
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-2xl font-bold text-green-400">{stats.totalArticles}</div>
                    <div className="text-xs text-slate-400">Totaal Artikelen</div>
                    {stats.articlesAddedThisWeek > 0 && (
                        <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                            <i className="fas fa-arrow-up"></i> +{stats.articlesAddedThisWeek} deze week
                        </div>
                    )}
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="text-2xl font-bold text-yellow-400">{stats.avgProductScore.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">Gem. Score</div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                        <div 
                            className="bg-gradient-to-r from-yellow-500 to-green-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${(stats.avgProductScore / 10) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {stats.topCategory !== 'N/A' && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                    <div className="text-xs text-slate-400 mb-2">Top Categorie</div>
                    <div className="flex items-center justify-between">
                        <span className="text-white font-medium capitalize">{stats.topCategory}</span>
                        <span className="text-blue-400 font-bold">{stats.topCategoryCount} producten</span>
                    </div>
                </div>
            )}
        </div>
    );
};

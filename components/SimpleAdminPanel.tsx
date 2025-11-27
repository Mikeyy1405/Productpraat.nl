import React, { useState } from 'react';
import { Product, CATEGORIES } from '../types';
import { ProductGenerator } from './ProductGenerator';
import { db } from '../services/storage';

interface SimpleAdminPanelProps {
    products: Product[];
    onAddProduct: (product: Product) => Promise<void>;
    onDeleteProduct: (id: string) => Promise<void>;
    onLogout: () => void;
}

export const SimpleAdminPanel: React.FC<SimpleAdminPanelProps> = ({
    products,
    onAddProduct,
    onDeleteProduct,
    onLogout
}) => {
    const [showProductGenerator, setShowProductGenerator] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    /** Show notification and auto-hide after 3 seconds */
    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    /** Handle product add with error handling */
    const handleAddProduct = async (product: Product) => {
        try {
            await onAddProduct(product);
            setShowProductGenerator(false);
            showNotification('success', `${product.brand} ${product.model} is succesvol toegevoegd!`);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Er ging iets mis bij het toevoegen.';
            showNotification('error', errorMessage);
            // Re-throw so the ProductGenerator knows it failed
            throw e;
        }
    };

    /** Handle product delete with error handling */
    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Weet je zeker dat je dit product wilt verwijderen?')) return;
        
        setIsDeleting(id);
        try {
            await onDeleteProduct(id);
            showNotification('success', 'Product is succesvol verwijderd.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Er ging iets mis bij het verwijderen.';
            showNotification('error', errorMessage);
        } finally {
            setIsDeleting(null);
        }
    };

    const filteredProducts = products.filter(p => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return p.brand.toLowerCase().includes(term) || 
               p.model.toLowerCase().includes(term) ||
               p.category.toLowerCase().includes(term);
    });

    // Stats
    const totalProducts = products.length;
    const categoryCount = new Set(products.map(p => p.category)).size;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in ${
                    notification.type === 'success' 
                        ? 'bg-green-900/90 border border-green-500/30 text-green-300' 
                        : 'bg-red-900/90 border border-red-500/30 text-red-300'
                }`}>
                    <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                    <span>{notification.message}</span>
                    <button 
                        onClick={() => setNotification(null)} 
                        className="ml-2 hover:text-white transition"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">ProductPraat Admin</h1>
                    <p className="text-slate-400 mt-1">Simpel beheer van je producten</p>
                </div>
                <button 
                    onClick={onLogout}
                    className="text-slate-400 hover:text-white transition flex items-center gap-2"
                >
                    <i className="fas fa-sign-out-alt"></i> Uitloggen
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-blue-400">{totalProducts}</div>
                    <div className="text-slate-400 text-sm">Producten</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-green-400">{categoryCount}</div>
                    <div className="text-slate-400 text-sm">Categorieën</div>
                </div>
            </div>

            {/* Add Product Button */}
            <button
                onClick={() => setShowProductGenerator(true)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-4 rounded-xl font-bold text-lg shadow-lg mb-8 flex items-center justify-center gap-3 transition"
            >
                <i className="fas fa-plus-circle text-xl"></i>
                Voeg Product Toe via URL
            </button>

            {/* Product Generator Modal */}
            {showProductGenerator && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800">
                            <h2 className="text-xl font-bold text-white">Product Toevoegen</h2>
                            <button onClick={() => setShowProductGenerator(false)} className="text-slate-400 hover:text-white">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="p-4">
                            <ProductGenerator 
                                onSave={handleAddProduct}
                                onCancel={() => setShowProductGenerator(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Zoeken in producten..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-blue-500"
                    />
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                </div>
            </div>

            {/* Product List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                    <h2 className="font-bold text-white">Alle Producten ({filteredProducts.length})</h2>
                </div>
                <div className="divide-y divide-slate-800 max-h-96 overflow-auto">
                    {filteredProducts.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <i className="fas fa-inbox text-3xl mb-2"></i>
                            <p>Geen producten gevonden</p>
                        </div>
                    ) : (
                        filteredProducts.map(p => (
                            <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-slate-800/50">
                                <img 
                                    src={p.imageUrl || p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.brand)}&background=0f172a&color=3b82f6`} 
                                    className="w-12 h-12 object-contain bg-white rounded" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.brand)}&background=0f172a&color=3b82f6`;
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-white truncate">{p.brand} {p.model}</div>
                                    <div className="text-sm text-slate-400">
                                        {CATEGORIES[p.category]?.name} • €{p.price}
                                        {p.isAiGenerated && <span className="ml-2 text-xs text-blue-400"><i className="fas fa-robot"></i> AI</span>}
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-sm font-bold ${p.score >= 8 ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                                    {p.score.toFixed(1)}
                                </span>
                                <button
                                    onClick={() => handleDeleteProduct(p.id)}
                                    disabled={isDeleting === p.id}
                                    className="text-red-400 hover:text-red-300 p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDeleting === p.id ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                        <i className="fas fa-trash"></i>
                                    )}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

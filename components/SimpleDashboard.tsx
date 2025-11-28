import React, { useState } from 'react';
import { Product, CATEGORIES } from '../types';

interface SimpleDashboardProps {
    products: Product[];
    onLogout: () => void;
}

export const SimpleDashboard: React.FC<SimpleDashboardProps> = ({ 
    products, 
    onLogout 
}) => {
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<string>('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([
        'televisies', 'laptops', 'smartphones'
    ]);
    const [productsPerCategory, setProductsPerCategory] = useState(5);

    const handleImport = async () => {
        if (selectedCategories.length === 0) {
            setImportStatus('❌ Selecteer minimaal 1 categorie');
            return;
        }

        setIsImporting(true);
        setImportStatus('🔄 Producten ophalen van Bol.com...');
        
        try {
            const response = await fetch('/api/admin/quick-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categories: selectedCategories,
                    limit: productsPerCategory
                })
            });

            const result = await response.json();
            
            if (result.success) {
                setImportStatus(`✅ ${result.imported} producten geïmporteerd!`);
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setImportStatus(`❌ ${result.message || 'Import mislukt'}`);
                setIsImporting(false);
            }
        } catch (err) {
            setImportStatus(`❌ Fout: ${err instanceof Error ? err.message : 'Onbekende fout'}`);
            setIsImporting(false);
        }
    };

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev => 
            prev.includes(cat) 
                ? prev.filter(c => c !== cat)
                : [...prev, cat]
        );
    };

    const uniqueCategories = new Set(products.map(p => p.category));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
            <div className="max-w-6xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
                            <span>🚀</span>
                            Productpraat Dashboard
                        </h1>
                        <p className="text-slate-400">Eenvoudig & krachtig</p>
                    </div>
                    <button
                        onClick={onLogout}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
                    >
                        <i className="fas fa-sign-out-alt mr-2"></i>
                        Uitloggen
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center mb-3">
                            <i className="fas fa-box text-blue-400 text-xl"></i>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{products.length}</div>
                        <div className="text-slate-400 text-sm">Totaal Producten</div>
                    </div>
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center mb-3">
                            <i className="fas fa-th-large text-green-400 text-xl"></i>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">{uniqueCategories.size}</div>
                        <div className="text-slate-400 text-sm">Categorieën</div>
                    </div>
                    
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-3">
                            <i className="fas fa-robot text-purple-400 text-xl"></i>
                        </div>
                        <div className="text-3xl font-bold text-white mb-1">AI</div>
                        <div className="text-slate-400 text-sm">Unieke Content</div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8">
                    <div className="text-center mb-6">
                        <div className="text-5xl mb-4">🎉</div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                            {products.length === 0 ? 'Start je Webshop in 1 Minuut' : 'Meer Producten Importeren'}
                        </h2>
                        <p className="text-slate-300">Importeer automatisch populaire Bol.com producten</p>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-300 mb-3">
                            📦 Selecteer Categorieën ({selectedCategories.length} geselecteerd):
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {Object.entries(CATEGORIES).slice(0, 12).map(([key, cat]) => (
                                <button
                                    key={key}
                                    onClick={() => toggleCategory(key)}
                                    disabled={isImporting}
                                    className={`p-3 rounded-lg border transition ${
                                        selectedCategories.includes(key)
                                            ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    } disabled:opacity-50`}
                                >
                                    <div className="text-sm font-medium">{cat.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-300 mb-3">
                            🔢 Producten per categorie: <span className="text-blue-400 font-bold text-lg">{productsPerCategory}</span>
                        </label>
                        <input
                            type="range"
                            min="3"
                            max="10"
                            value={productsPerCategory}
                            onChange={(e) => setProductsPerCategory(parseInt(e.target.value))}
                            disabled={isImporting}
                            className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="text-center mt-2 text-sm text-slate-400">
                            Totaal: <span className="text-white font-bold">{selectedCategories.length * productsPerCategory}</span> producten
                        </div>
                    </div>

                    <button
                        onClick={handleImport}
                        disabled={isImporting || selectedCategories.length === 0}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 \
                            disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all shadow-lg \
                            flex items-center justify-center gap-3 text-lg"
                    >
                        {isImporting ? (
                            <>
                                <i className="fas fa-circle-notch fa-spin"></i>
                                Bezig met importeren...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-rocket"></i>
                                Importeer {selectedCategories.length * productsPerCategory} Producten
                            </>
                        )}
                    </button>

                    {importStatus && (
                        <div className={`mt-4 p-4 rounded-lg border text-center font-medium ${
                            importStatus.startsWith('✅') 
                                ? 'bg-green-900/30 border-green-500/30 text-green-400'
                                : importStatus.startsWith('❌')
                                ? 'bg-red-900/30 border-red-500/30 text-red-400'
                                : 'bg-blue-900/30 border-blue-500/30 text-blue-400'
                        }`}>
                            {importStatus}
                        </div>
                    )}
                </div>

                {products.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                        <h3 className="text-2xl font-bold text-white mb-6">
                            <i className="fas fa-box-open text-blue-400 mr-2"></i>
                            Jouw Producten ({products.length})
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {products.slice(0, 12).map(product => (
                                <div 
                                    key={product.id}
                                    className="bg-slate-950 border border-slate-800 rounded-lg p-4 hover:border-blue-500/50 transition"
                                >
                                    <div className="aspect-square bg-white rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                        <img 
                                            src={product.imageUrl || product.image}
                                            alt={product.model}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <div className="text-xs text-slate-500 mb-1">{product.brand}</div>
                                    <div className="text-sm font-medium text-white mb-2 line-clamp-2">{product.model}</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-blue-400 font-bold">
                                            <i className="fas fa-star text-xs mr-1"></i>
                                            {product.score || product.rating || 'N/A'}
                                        </span>
                                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                            {CATEGORIES[product.category]?.name || product.category}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {products.length > 12 && (
                            <div className="text-center mt-6 text-slate-400">
                                En nog {products.length - 12} producten meer...
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
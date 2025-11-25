
import React, { useState, useRef, useEffect } from 'react';
import { aiService } from '../services/aiService';
import { fetchBolProduct, searchBolProducts } from '../services/bolService';
import { Product, CATEGORIES, Article, ArticleType } from '../types';
import { db } from '../services/storage';

interface AdminPanelProps {
    onAddProduct: (product: Product) => Promise<void>;
    onDeleteProduct: (id: string) => Promise<void>;
    customProducts: Product[];
    onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onAddProduct, onDeleteProduct, customProducts, onLogout }) => {
    // --- TABS ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'articles'>('products');
    const [productSubTab, setProductSubTab] = useState<'import' | 'bulk' | 'autopilot' | 'list'>('import');

    // --- LOGGING & PROCESSING ---
    const [pilotLogs, setPilotLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const stopProcessRef = useRef(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // --- STATE: AUTO PILOT & BULK ---
    const [pilotCategory, setPilotCategory] = useState<string>('wasmachines');
    const [bulkInput, setBulkInput] = useState('');

    // --- STATE: SINGLE IMPORT (EDITOR) ---
    const [importUrl, setImportUrl] = useState('');
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

    // --- STATE: ARTICLES ---
    const [studioType, setStudioType] = useState<ArticleType>('comparison');
    const [studioTopic, setStudioTopic] = useState('');
    const [studioCategory, setStudioCategory] = useState('wasmachines');
    const [generatedArticle, setGeneratedArticle] = useState<Partial<Article> | null>(null);
    const [savedArticles, setSavedArticles] = useState<Article[]>([]);

    useEffect(() => {
        db.getArticles().then(setSavedArticles);
    }, []);

    const addLog = (msg: string) => { 
        setPilotLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]); 
    };

    const showError = (msg: string) => {
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(null), 5000);
    };

    const handleResetDatabase = async () => { 
        if (confirm("LET OP: Dit wist ALLE data uit Supabase (Producten & Artikelen). Weet je het zeker?")) { 
            await db.clear(); 
            window.location.reload(); 
        } 
    };

    // ========================================================================
    // 1. BULK IMPORT HANDLER (URL-based)
    // ========================================================================
    const handleBulkImport = async () => {
        if (!bulkInput.trim()) return;
        const lines = bulkInput.split('\n').filter(line => line.trim().length > 0);
        
        setIsProcessing(true);
        stopProcessRef.current = false;
        setProgress(0);
        addLog(`📦 Start Bulk Import: ${lines.length} items`);

        for (const [index, line] of lines.entries()) {
            if (stopProcessRef.current) {
                addLog(`⏹️ Import gestopt door gebruiker`);
                break;
            }
            
            try {
                addLog(`> Verwerken (${index + 1}/${lines.length}): ${line.substring(0, 30)}...`);
                
                // Use server-side import with AI enrichment
                const { bolData, aiData } = await aiService.importFromUrl(line.trim());
                
                // Check existence
                const exists = customProducts.find(p => p.ean === bolData.ean || p.model === aiData.model);
                if (exists) {
                    addLog(`- Bestaat al, overgeslagen.`);
                    setProgress(((index + 1) / lines.length) * 100);
                    continue;
                }

                // Save to DB
                const newProduct: Product = {
                    id: `bulk-${Date.now()}-${Math.random()}`,
                    brand: aiData.brand || 'Merk',
                    model: aiData.model || 'Model',
                    price: bolData.price || 0,
                    score: aiData.score || 7.5,
                    category: aiData.category || Object.keys(CATEGORIES).find(c => bolData.title.toLowerCase().includes(c)) || 'overig',
                    image: bolData.image,
                    specs: aiData.specs || {},
                    pros: aiData.pros || [],
                    cons: aiData.cons || [],
                    description: aiData.description,
                    longDescription: aiData.longDescription,
                    expertOpinion: aiData.expertOpinion,
                    userReviewsSummary: aiData.userReviewsSummary,
                    affiliateUrl: bolData.url,
                    ean: bolData.ean,
                    scoreBreakdown: aiData.scoreBreakdown,
                    suitability: aiData.suitability,
                    faq: aiData.faq,
                    predicate: aiData.predicate
                };

                await onAddProduct(newProduct);
                addLog(`✅ Toegevoegd: ${newProduct.brand} ${newProduct.model}`);

            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                addLog(`❌ Fout bij regel ${index + 1}: ${errorMsg}`);
            }

            setProgress(((index + 1) / lines.length) * 100);
        }

        setIsProcessing(false);
        addLog(`🎉 Bulk Import Voltooid.`);
    };

    // ========================================================================
    // 2. SINGLE IMPORT HANDLER (Server-side with AI)
    // ========================================================================
    const handleSingleImport = async () => {
        if (!importUrl) return;
        setIsProcessing(true);
        setEditingProduct(null);
        setErrorMessage(null);
        
        try {
            // Use server-side import with AI enrichment
            const { bolData, aiData } = await aiService.importFromUrl(importUrl);

            const draft: Partial<Product> = {
                id: `man-${Date.now()}`,
                brand: aiData.brand || 'Merk',
                model: aiData.model || 'Model',
                price: bolData.price || 0,
                score: aiData.score || 8.0,
                category: aiData.category || Object.keys(CATEGORIES).find(c => bolData.title.toLowerCase().includes(c)) || 'overig',
                image: bolData.image,
                specs: aiData.specs || {},
                pros: aiData.pros || [],
                cons: aiData.cons || [],
                description: aiData.description,
                longDescription: aiData.longDescription,
                expertOpinion: aiData.expertOpinion,
                userReviewsSummary: aiData.userReviewsSummary,
                affiliateUrl: bolData.url,
                ean: bolData.ean,
                scoreBreakdown: aiData.scoreBreakdown,
                suitability: aiData.suitability,
                faq: aiData.faq,
                predicate: aiData.predicate
            };

            setEditingProduct(draft);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            showError(`Fout bij importeren: ${errorMsg}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const saveEditedProduct = async () => {
        if (!editingProduct || !editingProduct.brand) return;
        try {
            await onAddProduct(editingProduct as Product);
            setEditingProduct(null);
            setImportUrl('');
            alert("Product succesvol toegevoegd!");
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            showError(`Fout bij opslaan: ${errorMsg}`);
        }
    };

    // ========================================================================
    // 3. AUTO PILOT (Category Launch) - Server-side
    // ========================================================================
    const runCategoryLaunch = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        stopProcessRef.current = false;
        const catName = CATEGORIES[pilotCategory].name;
        addLog(`🚀 START CATEGORY LAUNCH: ${catName}`);

        try {
            addLog(`📦 Fase 1: Producten zoeken via server...`);
            const candidates = await searchBolProducts(catName, 5);
            
            addLog(`  Gevonden: ${candidates.length} producten`);

            for (const [index, candidate] of candidates.entries()) {
                if (stopProcessRef.current) {
                    addLog(`⏹️ Launch gestopt door gebruiker`);
                    break;
                }
                
                const exists = customProducts.find(p => p.model.toLowerCase().includes(candidate.title.toLowerCase()));
                
                if (!exists) {
                    addLog(`> Importeren (${index + 1}/${candidates.length}): ${candidate.title.substring(0,30)}...`);
                    try {
                        // Use server-side import with AI enrichment
                        const { bolData, aiData } = await aiService.importFromUrl(candidate.url || candidate.ean);
                        
                        const newProduct: Product = {
                            id: `auto-${Date.now()}-${Math.random()}`,
                            brand: aiData.brand || 'Merk',
                            model: aiData.model || 'Model',
                            price: bolData.price || 0,
                            score: aiData.score || 7.5,
                            category: pilotCategory,
                            image: bolData.image,
                            specs: aiData.specs || {},
                            pros: aiData.pros || [],
                            cons: aiData.cons || [],
                            description: aiData.description,
                            longDescription: aiData.longDescription,
                            expertOpinion: aiData.expertOpinion,
                            userReviewsSummary: aiData.userReviewsSummary,
                            affiliateUrl: bolData.url,
                            ean: bolData.ean,
                            scoreBreakdown: aiData.scoreBreakdown,
                            suitability: aiData.suitability,
                            faq: aiData.faq
                        };
                        await onAddProduct(newProduct);
                        addLog(`✅ Product toegevoegd: ${newProduct.brand} ${newProduct.model}`);
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : String(err);
                        addLog(`! Fout bij product: ${errorMsg}`);
                    }
                } else {
                    addLog(`- Product bestaat al, overgeslagen`);
                }
            }

            if (stopProcessRef.current) throw new Error("Gestopt door gebruiker");

            addLog(`📝 Fase 2: Content Generatie...`);
            
            // Generate guide article via server
            const guideTitle = `De Ultieme ${catName} Koopgids 2026`;
            addLog(`  Schrijven: ${guideTitle}...`);
            try {
                const guide = await aiService.generateArticle('guide', guideTitle, pilotCategory);
                if (guide.title) {
                    const art = { ...guide, id: `art-${Date.now()}-G`, category: pilotCategory, type: 'guide', author: 'Redactie', date: new Date().toLocaleDateString() } as Article;
                    await db.addArticle(art);
                    addLog(`✅ Koopgids gepubliceerd`);
                }
            } catch (guideErr) {
                const errorMsg = guideErr instanceof Error ? guideErr.message : String(guideErr);
                addLog(`! Fout bij koopgids: ${errorMsg}`);
            }

            // Generate list article via server
            const listTitle = `Top 5 Beste ${catName} van dit moment`;
            addLog(`  Schrijven: ${listTitle}...`);
            try {
                const list = await aiService.generateArticle('list', listTitle, pilotCategory);
                if (list.title) {
                    const art = { ...list, id: `art-${Date.now()}-L`, category: pilotCategory, type: 'list', author: 'Redactie', date: new Date().toLocaleDateString() } as Article;
                    const updated = await db.addArticle(art);
                    setSavedArticles(updated);
                    addLog(`✅ Toplijst gepubliceerd`);
                }
            } catch (listErr) {
                const errorMsg = listErr instanceof Error ? listErr.message : String(listErr);
                addLog(`! Fout bij toplijst: ${errorMsg}`);
            }

            addLog(`🎉 KLAAR! Categorie ${catName} is gevuld.`);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            addLog(`❌ Fout: ${errorMsg}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // ========================================================================
    // 4. ARTICLES (Server-side AI generation)
    // ========================================================================
    const handleGenerateArticle = async () => { 
        if (!studioTopic.trim()) {
            showError('Vul een onderwerp in');
            return;
        }
        setIsProcessing(true); 
        setGeneratedArticle(null);
        setErrorMessage(null);
        
        try { 
            const result = await aiService.generateArticle(studioType, studioTopic, studioCategory); 
            setGeneratedArticle(result); 
        } catch(e) { 
            const errorMsg = e instanceof Error ? e.message : String(e);
            showError(`Fout bij genereren: ${errorMsg}`);
        } finally { 
            setIsProcessing(false); 
        }
    };

    const handleSaveArticle = async () => { 
        if(generatedArticle?.title){ 
            try {
                const art = { ...generatedArticle, id:`art-${Date.now()}`, category:studioCategory, type:studioType, author:'Redactie', date:new Date().toLocaleDateString() } as Article;
                const updated = await db.addArticle(art);
                setSavedArticles(updated);
                setGeneratedArticle(null); 
                alert('Artikel opgeslagen!');
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                showError(`Fout bij opslaan: ${errorMsg}`);
            }
        }
    };

    const handleDeleteArticle = async (id: string) => { 
        if(confirm('Artikel verwijderen?')) {
            const updated = await db.deleteArticle(id);
            setSavedArticles(updated);
        }
    };

    // --- RENDER ---
    return (
        <div className="container mx-auto px-4 py-12 max-w-7xl animate-fade-in text-slate-200">
            {/* Error Toast */}
            {errorMessage && (
                <div className="fixed top-4 right-4 bg-red-900/90 border border-red-700 text-white px-6 py-4 rounded-xl shadow-lg z-50 animate-fade-in">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-exclamation-circle text-red-400"></i>
                        <span>{errorMessage}</span>
                        <button onClick={() => setErrorMessage(null)} className="ml-4 text-red-400 hover:text-white">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white">Redactie Dashboard</h1>
                    <p className="text-slate-400 text-sm">Beheer producten, content en AI-automatisering</p>
                </div>
                <div className="flex gap-3">
                     <button onClick={handleResetDatabase} className="px-4 py-2 rounded-lg bg-red-950/50 border border-red-900 text-red-400 text-xs font-bold hover:bg-red-900 hover:text-white transition">
                        <i className="fas fa-trash mr-2"></i> DB Wissen
                     </button>
                     <button onClick={onLogout} className="bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-700 transition">
                        Uitloggen
                     </button>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex border-b border-slate-800 mb-8">
                {[
                    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
                    { id: 'products', icon: 'fa-box-open', label: 'Producten' },
                    { id: 'articles', icon: 'fa-newspaper', label: 'Artikelen' }
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-4 font-bold text-sm flex items-center gap-2 border-b-2 transition ${activeTab === tab.id ? 'border-[#1877F2] text-white bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        <i className={`fas ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </div>

            {/* === TAB: DASHBOARD === */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-bold uppercase">Producten</div>
                        <div className="text-4xl font-black text-white">{customProducts.length}</div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-bold uppercase">Artikelen</div>
                        <div className="text-4xl font-black text-blue-500">{savedArticles.length}</div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                        <div className="text-slate-400 text-xs font-bold uppercase">Status</div>
                        <div className="text-4xl font-black text-green-500">Online</div>
                    </div>
                </div>
            )}

            {/* === TAB: PRODUCTS === */}
            {activeTab === 'products' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Product Sidebar */}
                    <div className="lg:col-span-1 space-y-2">
                        <button onClick={() => setProductSubTab('import')} className={`w-full text-left p-3 rounded-lg font-medium text-sm transition ${productSubTab === 'import' ? 'bg-[#1877F2] text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <i className="fas fa-magic mr-2"></i> Single Import
                        </button>
                        <button onClick={() => setProductSubTab('bulk')} className={`w-full text-left p-3 rounded-lg font-medium text-sm transition ${productSubTab === 'bulk' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <i className="fas fa-layer-group mr-2"></i> Bulk Import
                        </button>
                        <button onClick={() => setProductSubTab('autopilot')} className={`w-full text-left p-3 rounded-lg font-medium text-sm transition ${productSubTab === 'autopilot' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <i className="fas fa-rocket mr-2"></i> Auto-Pilot
                        </button>
                        <button onClick={() => setProductSubTab('list')} className={`w-full text-left p-3 rounded-lg font-medium text-sm transition ${productSubTab === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                            <i className="fas fa-list mr-2"></i> Lijst ({customProducts.length})
                        </button>
                    </div>

                    {/* Product Content Area */}
                    <div className="lg:col-span-3">
                        
                        {/* 1. SINGLE IMPORT */}
                        {productSubTab === 'import' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                <h2 className="text-xl font-bold text-white mb-4">Single Import & Editor</h2>
                                {!editingProduct ? (
                                    <div>
                                        <label className="label">Bol.com URL</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="https://www.bol.com/..." className="input flex-1" />
                                            <button onClick={handleSingleImport} disabled={isProcessing} className="bg-[#1877F2] text-white px-6 rounded-xl font-bold">
                                                {isProcessing ? 'Bezig...' : 'Importeer'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="label">Merk</label><input className="input" value={editingProduct.brand} onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} /></div>
                                            <div><label className="label">Model</label><input className="input" value={editingProduct.model} onChange={e => setEditingProduct({...editingProduct, model: e.target.value})} /></div>
                                            <div><label className="label">Prijs</label><input className="input" type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} /></div>
                                            <div><label className="label">Score</label><input className="input" type="number" step="0.1" value={editingProduct.score} onChange={e => setEditingProduct({...editingProduct, score: Number(e.target.value)})} /></div>
                                        </div>
                                        <div><label className="label">Beschrijving</label><textarea className="input h-24" value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                                        <div className="flex gap-2 mt-4">
                                            <button onClick={saveEditedProduct} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold">Opslaan & Publiceren</button>
                                            <button onClick={() => setEditingProduct(null)} className="px-6 bg-slate-800 text-white rounded-xl">Annuleren</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. BULK IMPORT */}
                        {productSubTab === 'bulk' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                <h2 className="text-xl font-bold text-white mb-4">Bulk Import</h2>
                                <p className="text-xs text-slate-400 mb-4">Plak Bol.com URL's (één per regel). De AI zal ze importeren en herschrijven.</p>
                                <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} className="w-full h-48 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white font-mono mb-4 outline-none focus:border-purple-500" placeholder="https://url1...&#10;https://url2..." />
                                <div className="flex gap-3">
                                    <button onClick={handleBulkImport} disabled={isProcessing || !bulkInput} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2">
                                        {isProcessing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>} Start Bulk
                                    </button>
                                    {isProcessing && <button onClick={() => stopProcessRef.current = true} className="bg-red-900/50 text-red-400 px-4 rounded-xl text-xs font-bold">STOP</button>}
                                </div>
                                {isProcessing && (
                                    <div className="mt-6">
                                        <div className="w-full bg-slate-800 rounded-full h-2 mb-2"><div className="bg-purple-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div></div>
                                        <div className="bg-black p-4 rounded-xl border border-slate-800 h-32 overflow-y-auto font-mono text-xs">
                                            {pilotLogs.map((l,i) => <div key={i} className="mb-1 text-slate-400 border-b border-slate-900/50 pb-1">{l}</div>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. AUTO PILOT */}
                        {productSubTab === 'autopilot' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                                <h2 className="text-xl font-bold text-white mb-4">Category Launch</h2>
                                <p className="text-xs text-slate-400 mb-4">Vult automatisch een categorie met 5 bestsellers, een gids en een toplijst.</p>
                                <div className="flex gap-2 mb-4">
                                    <select value={pilotCategory} onChange={e => setPilotCategory(e.target.value)} disabled={isProcessing} className="flex-1 bg-slate-950 border border-slate-700 text-white p-3 rounded-xl">
                                        {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.name}</option>)}
                                    </select>
                                    <button onClick={runCategoryLaunch} disabled={isProcessing} className="bg-orange-600 hover:bg-orange-500 text-white px-6 rounded-xl font-bold flex items-center gap-2">
                                        {isProcessing ? <><i className="fas fa-spinner fa-spin"></i> Bezig...</> : <><i className="fas fa-rocket"></i> START LAUNCH</>}
                                    </button>
                                    {isProcessing && (
                                        <button onClick={() => stopProcessRef.current = true} className="bg-red-900/50 border border-red-800 text-red-400 px-4 rounded-xl text-xs font-bold hover:bg-red-900 hover:text-white transition">
                                            <i className="fas fa-stop mr-1"></i> STOP
                                        </button>
                                    )}
                                </div>
                                {(isProcessing || pilotLogs.length > 0) && (
                                    <div className="bg-black p-4 rounded-xl h-48 overflow-y-auto font-mono text-xs border border-slate-800">
                                        {pilotLogs.length === 0 ? (
                                            <div className="text-slate-500">Wachten op logs...</div>
                                        ) : (
                                            pilotLogs.map((l,i) => (
                                                <div key={i} className={`mb-1 pb-1 border-b border-slate-900/50 ${l.includes('✅') ? 'text-green-400' : l.includes('❌') ? 'text-red-400' : l.includes('🚀') || l.includes('🎉') ? 'text-orange-400' : 'text-slate-400'}`}>
                                                    {l}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. LIST */}
                        {productSubTab === 'list' && (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between">
                                    <h3 className="font-bold text-white">Alle Producten</h3>
                                    <span className="text-xs text-slate-500">{customProducts.length} items</span>
                                </div>
                                <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
                                    {customProducts.map(p => (
                                        <div key={p.id} className="p-4 flex justify-between items-center hover:bg-slate-800/50">
                                            <div className="flex items-center gap-4">
                                                <img src={p.image} className="w-8 h-8 object-contain bg-white rounded" />
                                                <div>
                                                    <div className="font-bold text-white text-sm">{p.brand} {p.model}</div>
                                                    <div className="text-xs text-slate-500">{CATEGORIES[p.category]?.name}</div>
                                                </div>
                                            </div>
                                            <button onClick={() => onDeleteProduct(p.id)} className="text-red-500"><i className="fas fa-trash"></i></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* === TAB: ARTICLES === */}
            {activeTab === 'articles' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Artikel Studio</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Type</label><select value={studioType} onChange={(e) => setStudioType(e.target.value as any)} className="input-select"><option value="comparison">Vergelijking</option><option value="list">Toplijst</option><option value="guide">Gids</option></select></div>
                                <div><label className="label">Categorie</label><select value={studioCategory} onChange={(e) => setStudioCategory(e.target.value)} className="input-select">{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}</select></div>
                            </div>
                            <div><label className="label">Onderwerp</label><input type="text" value={studioTopic} onChange={(e)=>setStudioTopic(e.target.value)} placeholder="Bijv: Beste Airfryers 2026..." className="input" /></div>
                            <button onClick={handleGenerateArticle} disabled={isProcessing} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{isProcessing ? 'Schrijven...' : 'Genereer Artikel'}</button>
                            {generatedArticle && (
                                <div className="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <h3 className="font-bold text-white">{generatedArticle.title}</h3>
                                    <button onClick={handleSaveArticle} className="text-green-400 font-bold text-sm mt-2">Opslaan</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-4">Gepubliceerd</h3>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {savedArticles.map(a => (
                                <div key={a.id} className="flex justify-between text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800">
                                    <span>{a.title}</span>
                                    <button onClick={()=>handleDeleteArticle(a.id)} className="text-red-500">Del</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .label { display: block; font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.5rem; }
                .input { width: 100%; background-color: #020617; border: 1px solid #334155; border-radius: 0.75rem; padding: 0.75rem 1rem; color: white; outline: none; transition: all; }
                .input:focus { border-color: #1877F2; }
                .input-select { width: 100%; background-color: #020617; border: 1px solid #334155; border-radius: 0.75rem; padding: 0.75rem 1rem; color: white; outline: none; cursor: pointer; }
            `}</style>
        </div>
    );
};

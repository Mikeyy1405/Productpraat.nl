
import React, { useState, useRef, useEffect } from 'react';
import { generateProductFromInput, generateArticle } from '../services/geminiService';
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

    const handleResetDatabase = async () => { 
        if (confirm("LET OP: Dit wist ALLE data uit Supabase (Producten & Artikelen). Weet je het zeker?")) { 
            await db.clear(); 
            window.location.reload(); 
        } 
    };

    // ========================================================================
    // 1. BULK IMPORT HANDLER
    // ========================================================================
    const handleBulkImport = async () => {
        if (!bulkInput.trim()) return;
        const lines = bulkInput.split('\n').filter(line => line.trim().length > 0);
        
        setIsProcessing(true);
        stopProcessRef.current = false;
        setProgress(0);
        addLog(`📦 Start Bulk Import: ${lines.length} items`);

        for (const [index, line] of lines.entries()) {
            if (stopProcessRef.current) break;
            
            try {
                addLog(`> Verwerken (${index + 1}/${lines.length}): ${line.substring(0, 30)}...`);
                
                // 1. Bol Data Fetch
                const bolData = await fetchBolProduct(line);
                
                // 2. Check existence
                const exists = customProducts.find(p => p.ean === bolData.ean || p.model === bolData.title);
                if (exists) {
                    addLog(`- Bestaat al, overgeslagen.`);
                    setProgress(((index + 1) / lines.length) * 100);
                    continue;
                }

                // 3. AI Review Generation
                addLog(`  AI schrijft review...`);
                const aiResult = await generateProductFromInput(`Titel: ${bolData.title}\nPrijs: ${bolData.price}\nSpecs: ${JSON.stringify(bolData.specs)}`);

                // 4. Save to DB
                const newProduct: Product = {
                    id: `bulk-${Date.now()}-${Math.random()}`,
                    brand: aiResult.brand || 'Merk',
                    model: aiResult.model || 'Model',
                    price: bolData.price || 0,
                    score: aiResult.score || 7.5,
                    category: Object.keys(CATEGORIES).find(c => bolData.title.toLowerCase().includes(c)) || 'overig',
                    image: bolData.image,
                    specs: aiResult.specs || {},
                    pros: aiResult.pros || [],
                    cons: aiResult.cons || [],
                    description: aiResult.description,
                    longDescription: aiResult.longDescription,
                    expertOpinion: aiResult.expertOpinion,
                    userReviewsSummary: aiResult.userReviewsSummary,
                    affiliateUrl: bolData.url,
                    ean: bolData.ean,
                    scoreBreakdown: aiResult.scoreBreakdown,
                    suitability: aiResult.suitability,
                    faq: aiResult.faq,
                    predicate: aiResult.predicate
                };

                await onAddProduct(newProduct);
                addLog(`✅ Toegevoegd: ${newProduct.brand} ${newProduct.model}`);

            } catch (e) {
                addLog(`❌ Fout bij regel ${index + 1}: ${e}`);
            }

            setProgress(((index + 1) / lines.length) * 100);
            await new Promise(r => setTimeout(r, 2000)); // Respect rate limits
        }

        setIsProcessing(false);
        addLog(`🎉 Bulk Import Voltooid.`);
    };

    // ========================================================================
    // 2. SINGLE IMPORT HANDLER
    // ========================================================================
    const handleSingleImport = async () => {
        if (!importUrl) return;
        setIsProcessing(true);
        setEditingProduct(null);
        
        try {
            const bolData = await fetchBolProduct(importUrl);
            const aiResult = await generateProductFromInput(`Titel: ${bolData.title}\nPrijs: ${bolData.price}\nSpecs: ${JSON.stringify(bolData.specs)}`);

            const draft: Partial<Product> = {
                id: `man-${Date.now()}`,
                brand: aiResult.brand || 'Merk',
                model: aiResult.model || 'Model',
                price: bolData.price || 0,
                score: aiResult.score || 8.0,
                category: Object.keys(CATEGORIES).find(c => bolData.title.toLowerCase().includes(c)) || 'overig',
                image: bolData.image,
                specs: aiResult.specs || {},
                pros: aiResult.pros || [],
                cons: aiResult.cons || [],
                description: aiResult.description,
                longDescription: aiResult.longDescription,
                expertOpinion: aiResult.expertOpinion,
                userReviewsSummary: aiResult.userReviewsSummary,
                affiliateUrl: bolData.url,
                ean: bolData.ean,
                scoreBreakdown: aiResult.scoreBreakdown,
                suitability: aiResult.suitability,
                faq: aiResult.faq,
                predicate: aiResult.predicate
            };

            setEditingProduct(draft);
        } catch (e) {
            alert(`Fout bij importeren: ${e}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const saveEditedProduct = async () => {
        if (!editingProduct || !editingProduct.brand) return;
        await onAddProduct(editingProduct as Product);
        setEditingProduct(null);
        setImportUrl('');
        alert("Product succesvol toegevoegd!");
    };

    // ========================================================================
    // 3. AUTO PILOT (Category Launch)
    // ========================================================================
    const runCategoryLaunch = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        stopProcessRef.current = false;
        const catName = CATEGORIES[pilotCategory].name;
        addLog(`🚀 START CATEGORY LAUNCH: ${catName}`);

        try {
            addLog(`📦 Fase 1: Producten zoeken...`);
            const candidates = await searchBolProducts(catName, 5);
            
            for (const candidate of candidates) {
                if (stopProcessRef.current) break;
                const exists = customProducts.find(p => p.model.toLowerCase().includes(candidate.title.toLowerCase()));
                
                if (!exists) {
                    addLog(`> Importeren: ${candidate.title.substring(0,30)}...`);
                    try {
                        const bolData = await fetchBolProduct(candidate.url);
                        const aiResult = await generateProductFromInput(`Titel: ${bolData.title}\nPrijs: ${bolData.price}\nSpecs: ${JSON.stringify(bolData.specs)}`);
                        
                        const newProduct: Product = {
                            id: `auto-${Date.now()}-${Math.random()}`,
                            brand: aiResult.brand || 'Merk',
                            model: aiResult.model || 'Model',
                            price: bolData.price || 0,
                            score: aiResult.score || 7.5,
                            category: pilotCategory,
                            image: bolData.image,
                            specs: aiResult.specs || {},
                            pros: aiResult.pros || [],
                            cons: aiResult.cons || [],
                            description: aiResult.description,
                            longDescription: aiResult.longDescription,
                            expertOpinion: aiResult.expertOpinion,
                            userReviewsSummary: aiResult.userReviewsSummary,
                            affiliateUrl: bolData.url,
                            ean: bolData.ean,
                            scoreBreakdown: aiResult.scoreBreakdown,
                            suitability: aiResult.suitability,
                            faq: aiResult.faq
                        };
                        await onAddProduct(newProduct);
                    } catch (err) {
                        addLog(`! Fout bij product: ${err}`);
                    }
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            if (stopProcessRef.current) throw new Error("Gestopt");

            addLog(`📝 Fase 2: Content Generatie...`);
            const guideTitle = `De Ultieme ${catName} Koopgids 2026`;
            const guide = await generateArticle('guide', guideTitle, pilotCategory);
            if (guide.title) {
                const art = { ...guide, id: `art-${Date.now()}-G`, category: pilotCategory, type: 'guide', author: 'Redactie', date: new Date().toLocaleDateString() } as Article;
                await db.addArticle(art);
                addLog(`✅ Koopgids gepubliceerd`);
            }

            const listTitle = `Top 5 Beste ${catName} van dit moment`;
            const list = await generateArticle('list', listTitle, pilotCategory);
            if (list.title) {
                const art = { ...list, id: `art-${Date.now()}-L`, category: pilotCategory, type: 'list', author: 'Redactie', date: new Date().toLocaleDateString() } as Article;
                const updated = await db.addArticle(art);
                setSavedArticles(updated);
                addLog(`✅ Toplijst gepubliceerd`);
            }

            addLog(`🎉 KLAAR! Categorie ${catName} is gevuld.`);
        } catch (e) {
            addLog(`❌ Fout: ${e}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // ========================================================================
    // 4. ARTICLES
    // ========================================================================
    const handleGenerateArticle = async () => { 
        setIsProcessing(true); setGeneratedArticle(null);
        try { const r = await generateArticle(studioType, studioTopic, studioCategory); setGeneratedArticle(r); } 
        catch(e){ console.error(e); } finally { setIsProcessing(false); }
    };

    const handleSaveArticle = async () => { 
        if(generatedArticle?.title){ 
            const art = { ...generatedArticle, id:`art-${Date.now()}`, category:studioCategory, type:studioType, author:'Redactie', date:new Date().toLocaleDateString() } as Article;
            const updated = await db.addArticle(art);
            setSavedArticles(updated);
            setGeneratedArticle(null); 
            alert('Opgeslagen');
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
                                    <select value={pilotCategory} onChange={e => setPilotCategory(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 text-white p-3 rounded-xl">
                                        {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.name}</option>)}
                                    </select>
                                    <button onClick={runCategoryLaunch} disabled={isProcessing} className="bg-orange-600 text-white px-6 rounded-xl font-bold">START LAUNCH</button>
                                </div>
                                {isProcessing && <div className="bg-black p-4 rounded-xl h-48 overflow-y-auto font-mono text-xs">{pilotLogs.map((l,i)=><div key={i}>{l}</div>)}</div>}
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

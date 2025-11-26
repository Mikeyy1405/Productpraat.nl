
import React, { useState, useRef, useEffect, useCallback } from 'react';
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

// Toast notification types
interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onAddProduct, onDeleteProduct, customProducts, onLogout }) => {
    // --- MAIN NAVIGATION ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'articles'>('dashboard');
    const [productSubTab, setProductSubTab] = useState<'import' | 'bulk' | 'autopilot' | 'list'>('import');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // --- LOGGING & PROCESSING ---
    const [pilotLogs, setPilotLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('');
    const stopProcessRef = useRef(false);
    const [isPaused, setIsPaused] = useState(false);
    const pauseRef = useRef(false);

    // --- STATE: AUTO PILOT & BULK ---
    const [pilotCategory, setPilotCategory] = useState<string>('wasmachines');
    const [bulkInput, setBulkInput] = useState('');
    const [bulkProgress, setBulkProgress] = useState<{current: number; total: number; statuses: ('pending' | 'processing' | 'success' | 'error')[]}>({current: 0, total: 0, statuses: []});
    
    // --- STATE: BULK CATEGORY IMPORT ---
    const [bulkCategorySelected, setBulkCategorySelected] = useState<string>('wasmachines');
    const [bulkCategoryLimit, setBulkCategoryLimit] = useState<number>(5);
    const [bulkImportMode, setBulkImportMode] = useState<'urls' | 'category'>('urls');

    // --- STATE: SINGLE IMPORT (EDITOR) ---
    const [importUrl, setImportUrl] = useState('');
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [importStep, setImportStep] = useState<1 | 2 | 3>(1);

    // --- STATE: ARTICLES ---
    const [studioType, setStudioType] = useState<ArticleType>('comparison');
    const [studioTopic, setStudioTopic] = useState('');
    const [studioCategory, setStudioCategory] = useState('wasmachines');
    const [generatedArticle, setGeneratedArticle] = useState<Partial<Article> | null>(null);
    const [savedArticles, setSavedArticles] = useState<Article[]>([]);
    const [articleSearchTerm, setArticleSearchTerm] = useState('');

    // --- STATE: PRODUCT LIST ---
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productSortBy, setProductSortBy] = useState<'name' | 'price' | 'score' | 'category'>('name');
    const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

    // --- TOAST NOTIFICATIONS ---
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        db.getArticles().then(setSavedArticles);
    }, []);

    // Toast notification system
    const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addLog = (msg: string) => { 
        setPilotLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]); 
    };

    const showError = (msg: string) => {
        showToast(msg, 'error');
    };

    // Helper function to get best image from import data
    const getBestImage = (bolData: { images?: string[]; image: string }) => {
        return bolData.images?.[0] || bolData.image;
    };

    // Helper function to get all images from import data
    const getAllImages = (aiData: { images?: string[] }, bolData: { images?: string[]; image: string }) => {
        return aiData.images || bolData.images || [bolData.image];
    };

    const handleResetDatabase = async () => { 
        if (confirm("LET OP: Dit wist ALLE data uit Supabase (Producten & Artikelen). Weet je het zeker?")) { 
            await db.clear(); 
            window.location.reload(); 
        } 
    };

    // ========================================================================
    // 1. BULK IMPORT HANDLER (URL-based) with Pause/Resume
    // ========================================================================
    const handleBulkImport = async () => {
        if (!bulkInput.trim()) return;
        const lines = bulkInput.split('\n').filter(line => line.trim().length > 0);
        
        setIsProcessing(true);
        stopProcessRef.current = false;
        pauseRef.current = false;
        setProgress(0);
        setLoadingMessage('Bulk import starten...');
        setBulkProgress({ current: 0, total: lines.length, statuses: lines.map(() => 'pending') });
        addLog(`📦 Start Bulk Import: ${lines.length} items`);
        showToast(`Bulk import gestart: ${lines.length} producten`, 'info');

        for (const [index, line] of lines.entries()) {
            // Handle pause
            while (pauseRef.current && !stopProcessRef.current) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (stopProcessRef.current) {
                addLog(`⏹️ Import gestopt door gebruiker`);
                showToast('Import gestopt', 'warning');
                break;
            }
            
            // Update status to processing
            setBulkProgress(prev => ({
                ...prev,
                current: index,
                statuses: prev.statuses.map((s, i) => i === index ? 'processing' : s)
            }));
            
            try {
                setLoadingMessage(`Verwerken: ${line.substring(0, 40)}...`);
                addLog(`> Verwerken (${index + 1}/${lines.length}): ${line.substring(0, 30)}...`);
                
                const { bolData, aiData } = await aiService.importFromUrl(line.trim());
                
                const exists = customProducts.find(p => p.ean === bolData.ean || p.model === aiData.model);
                if (exists) {
                    addLog(`- Bestaat al, overgeslagen.`);
                    setBulkProgress(prev => ({
                        ...prev,
                        statuses: prev.statuses.map((s, i) => i === index ? 'success' : s)
                    }));
                    setProgress(((index + 1) / lines.length) * 100);
                    continue;
                }

                const newProduct: Product = {
                    id: `bulk-${Date.now()}-${Math.random()}`,
                    slug: aiData.slug,
                    brand: aiData.brand || 'Merk',
                    model: aiData.model || 'Model',
                    price: bolData.price || 0,
                    score: aiData.score || 7.5,
                    category: aiData.category || Object.keys(CATEGORIES).find(c => bolData.title.toLowerCase().includes(c)) || 'overig',
                    image: getBestImage(bolData),
                    images: getAllImages(aiData, bolData),
                    specs: aiData.specs || {},
                    pros: aiData.pros || [],
                    cons: aiData.cons || [],
                    description: aiData.description,
                    metaDescription: aiData.metaDescription,
                    keywords: aiData.keywords || [],
                    longDescription: aiData.longDescription,
                    expertOpinion: aiData.expertOpinion,
                    userReviewsSummary: aiData.userReviewsSummary,
                    affiliateUrl: bolData.url,
                    ean: bolData.ean,
                    scoreBreakdown: aiData.scoreBreakdown,
                    suitability: aiData.suitability,
                    faq: aiData.faq,
                    predicate: aiData.predicate,
                    bolReviewsRaw: aiData.bolReviewsRaw
                };

                await onAddProduct(newProduct);
                addLog(`✅ Toegevoegd: ${newProduct.brand} ${newProduct.model}`);
                
                setBulkProgress(prev => ({
                    ...prev,
                    statuses: prev.statuses.map((s, i) => i === index ? 'success' : s)
                }));

            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                addLog(`❌ Fout bij regel ${index + 1}: ${errorMsg}`);
                setBulkProgress(prev => ({
                    ...prev,
                    statuses: prev.statuses.map((s, i) => i === index ? 'error' : s)
                }));
            }

            setProgress(((index + 1) / lines.length) * 100);
        }

        setIsProcessing(false);
        setLoadingMessage('');
        setIsPaused(false);
        addLog(`🎉 Bulk Import Voltooid.`);
        showToast('Bulk import voltooid!', 'success');
    };

    // ========================================================================
    // 1B. BULK IMPORT BY CATEGORY HANDLER (Server-side with AI)
    // ========================================================================
    const handleBulkCategoryImport = async () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        stopProcessRef.current = false;
        setProgress(0);
        setLoadingMessage(`Producten zoeken in categorie ${CATEGORIES[bulkCategorySelected].name}...`);
        addLog(`📦 Start Bulk Category Import: ${CATEGORIES[bulkCategorySelected].name} (max ${bulkCategoryLimit} producten)`);
        showToast(`Bulk category import gestart: ${CATEGORIES[bulkCategorySelected].name}`, 'info');

        try {
            // Call the server-side bulk search and add endpoint
            const candidates = await aiService.bulkSearchAndAdd(CATEGORIES[bulkCategorySelected].name, bulkCategoryLimit);
            
            addLog(`✅ ${candidates.length} producten gevonden en verwerkt door server`);
            
            setBulkProgress({ current: 0, total: candidates.length, statuses: candidates.map(() => 'pending') });

            // Process each candidate and save to database
            for (const [index, candidate] of candidates.entries()) {
                if (stopProcessRef.current) {
                    addLog(`⏹️ Import gestopt door gebruiker`);
                    showToast('Import gestopt', 'warning');
                    break;
                }

                setBulkProgress(prev => ({
                    ...prev,
                    current: index,
                    statuses: prev.statuses.map((s, i) => i === index ? 'processing' : s)
                }));

                try {
                    setLoadingMessage(`Opslaan: ${candidate.bolData.title.substring(0, 40)}...`);
                    addLog(`> Opslaan (${index + 1}/${candidates.length}): ${candidate.bolData.title.substring(0, 30)}...`);
                    
                    const exists = customProducts.find(p => p.ean === candidate.bolData.ean || p.model === candidate.aiData.model);
                    if (exists) {
                        addLog(`- Bestaat al, overgeslagen.`);
                        setBulkProgress(prev => ({
                            ...prev,
                            statuses: prev.statuses.map((s, i) => i === index ? 'success' : s)
                        }));
                        setProgress(((index + 1) / candidates.length) * 100);
                        continue;
                    }

                    const newProduct: Product = {
                        id: `bulk-cat-${Date.now()}-${Math.random()}`,
                        slug: candidate.aiData.slug,
                        brand: candidate.aiData.brand || 'Merk',
                        model: candidate.aiData.model || 'Model',
                        price: candidate.bolData.price || 0,
                        score: candidate.aiData.score || 7.5,
                        category: bulkCategorySelected,
                        image: getBestImage(candidate.bolData),
                        images: getAllImages(candidate.aiData, candidate.bolData),
                        specs: candidate.aiData.specs || {},
                        pros: candidate.aiData.pros || [],
                        cons: candidate.aiData.cons || [],
                        description: candidate.aiData.description,
                        metaDescription: candidate.aiData.metaDescription,
                        keywords: candidate.aiData.keywords || [],
                        longDescription: candidate.aiData.longDescription,
                        expertOpinion: candidate.aiData.expertOpinion,
                        userReviewsSummary: candidate.aiData.userReviewsSummary,
                        affiliateUrl: candidate.bolData.url, // This contains the affiliate link from server
                        ean: candidate.bolData.ean,
                        scoreBreakdown: candidate.aiData.scoreBreakdown,
                        suitability: candidate.aiData.suitability,
                        faq: candidate.aiData.faq,
                        predicate: candidate.aiData.predicate,
                        bolReviewsRaw: candidate.aiData.bolReviewsRaw
                    };

                    await onAddProduct(newProduct);
                    addLog(`✅ Toegevoegd: ${newProduct.brand} ${newProduct.model}`);
                    
                    setBulkProgress(prev => ({
                        ...prev,
                        statuses: prev.statuses.map((s, i) => i === index ? 'success' : s)
                    }));

                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    addLog(`❌ Fout bij product ${index + 1}: ${errorMsg}`);
                    setBulkProgress(prev => ({
                        ...prev,
                        statuses: prev.statuses.map((s, i) => i === index ? 'error' : s)
                    }));
                }

                setProgress(((index + 1) / candidates.length) * 100);
            }

            addLog(`🎉 Bulk Category Import Voltooid: ${candidates.length} producten verwerkt`);
            showToast('Bulk category import voltooid!', 'success');
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            addLog(`❌ Fout: ${errorMsg}`);
            showToast(`Fout: ${errorMsg}`, 'error');
        } finally {
            setIsProcessing(false);
            setLoadingMessage('');
        }
    };

    const togglePause = () => {
        pauseRef.current = !pauseRef.current;
        setIsPaused(!isPaused);
        if (pauseRef.current) {
            addLog('⏸️ Import gepauzeerd');
            showToast('Import gepauzeerd', 'info');
        } else {
            addLog('▶️ Import hervat');
            showToast('Import hervat', 'info');
        }
    };

    // ========================================================================
    // 2. SINGLE IMPORT HANDLER (Server-side with AI) with Wizard Steps
    // ========================================================================
    const handleSingleImport = async () => {
        if (!importUrl) return;
        setIsProcessing(true);
        setEditingProduct(null);
        setLoadingMessage('Product ophalen van Bol.com...');
        setImportStep(1);
        
        try {
            setLoadingMessage('AI analyse bezig...');
            setImportStep(2);
            
            const { bolData, aiData } = await aiService.importFromUrl(importUrl);

            const draft: Partial<Product> = {
                id: `man-${Date.now()}`,
                slug: aiData.slug,
                brand: aiData.brand || 'Merk',
                model: aiData.model || 'Model',
                price: bolData.price || 0,
                score: aiData.score || 8.0,
                category: aiData.category || Object.keys(CATEGORIES).find(c => bolData.title.toLowerCase().includes(c)) || 'overig',
                image: getBestImage(bolData),
                images: getAllImages(aiData, bolData),
                specs: aiData.specs || {},
                pros: aiData.pros || [],
                cons: aiData.cons || [],
                description: aiData.description,
                metaDescription: aiData.metaDescription,
                keywords: aiData.keywords || [],
                longDescription: aiData.longDescription,
                expertOpinion: aiData.expertOpinion,
                userReviewsSummary: aiData.userReviewsSummary,
                affiliateUrl: bolData.url,
                ean: bolData.ean,
                scoreBreakdown: aiData.scoreBreakdown,
                suitability: aiData.suitability,
                faq: aiData.faq,
                predicate: aiData.predicate,
                bolReviewsRaw: aiData.bolReviewsRaw
            };

            setEditingProduct(draft);
            setImportStep(3);
            showToast('Product succesvol geïmporteerd!', 'success');
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
            setImportStep(1);
            showToast('Product succesvol toegevoegd!', 'success');
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            showError(`Fout bij opslaan: ${errorMsg}`);
        }
    };

    // ========================================================================
    // 3. AUTO PILOT (Category Launch) - Server-side with progress timeline
    // ========================================================================
    const [autopilotPhase, setAutopilotPhase] = useState<1 | 2 | 3>(1);
    
    const runCategoryLaunch = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        stopProcessRef.current = false;
        setAutopilotPhase(1);
        const catName = CATEGORIES[pilotCategory].name;
        addLog(`🚀 START CATEGORY LAUNCH: ${catName}`);
        showToast(`Category Launch gestart: ${catName}`, 'info');
        setLoadingMessage(`Fase 1: Producten zoeken...`);

        try {
            addLog(`📦 Fase 1: Producten zoeken via server...`);
            const candidates = await searchBolProducts(catName, 5);
            
            addLog(`  Gevonden: ${candidates.length} producten`);

            for (const [index, candidate] of candidates.entries()) {
                if (stopProcessRef.current) {
                    addLog(`⏹️ Launch gestopt door gebruiker`);
                    showToast('Launch gestopt', 'warning');
                    break;
                }
                
                const exists = customProducts.find(p => p.model.toLowerCase().includes(candidate.title.toLowerCase()));
                
                if (!exists) {
                    setLoadingMessage(`Product ${index + 1}/${candidates.length}: ${candidate.title.substring(0, 30)}...`);
                    addLog(`> Importeren (${index + 1}/${candidates.length}): ${candidate.title.substring(0,30)}...`);
                    try {
                        const { bolData, aiData } = await aiService.importFromUrl(candidate.url || candidate.ean);
                        
                        const newProduct: Product = {
                            id: `auto-${Date.now()}-${Math.random()}`,
                            slug: aiData.slug,
                            brand: aiData.brand || 'Merk',
                            model: aiData.model || 'Model',
                            price: bolData.price || 0,
                            score: aiData.score || 7.5,
                            category: pilotCategory,
                            image: getBestImage(bolData),
                            images: getAllImages(aiData, bolData),
                            specs: aiData.specs || {},
                            pros: aiData.pros || [],
                            cons: aiData.cons || [],
                            description: aiData.description,
                            metaDescription: aiData.metaDescription,
                            keywords: aiData.keywords || [],
                            longDescription: aiData.longDescription,
                            expertOpinion: aiData.expertOpinion,
                            userReviewsSummary: aiData.userReviewsSummary,
                            affiliateUrl: bolData.url,
                            ean: bolData.ean,
                            scoreBreakdown: aiData.scoreBreakdown,
                            suitability: aiData.suitability,
                            faq: aiData.faq,
                            bolReviewsRaw: aiData.bolReviewsRaw
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

            setAutopilotPhase(2);
            setLoadingMessage('Fase 2: Content genereren...');
            addLog(`📝 Fase 2: Content Generatie...`);
            
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

            setAutopilotPhase(3);
            addLog(`🎉 KLAAR! Categorie ${catName} is gevuld.`);
            showToast(`Category Launch voltooid: ${catName}`, 'success');
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            addLog(`❌ Fout: ${errorMsg}`);
            showToast(`Fout: ${errorMsg}`, 'error');
        } finally {
            setIsProcessing(false);
            setLoadingMessage('');
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
        setLoadingMessage('Artikel schrijven met AI...');
        
        try { 
            const result = await aiService.generateArticle(studioType, studioTopic, studioCategory); 
            setGeneratedArticle(result);
            showToast('Artikel gegenereerd!', 'success');
        } catch(e) { 
            const errorMsg = e instanceof Error ? e.message : String(e);
            showError(`Fout bij genereren: ${errorMsg}`);
        } finally { 
            setIsProcessing(false);
            setLoadingMessage('');
        }
    };

    const handleSaveArticle = async () => { 
        if(generatedArticle?.title){ 
            try {
                const art = { ...generatedArticle, id:`art-${Date.now()}`, category:studioCategory, type:studioType, author:'Redactie', date:new Date().toLocaleDateString() } as Article;
                const updated = await db.addArticle(art);
                setSavedArticles(updated);
                setGeneratedArticle(null);
                showToast('Artikel opgeslagen!', 'success');
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
            showToast('Artikel verwijderd', 'info');
        }
    };

    // ========================================================================
    // 5. PRODUCT LIST HELPERS
    // ========================================================================
    const filteredProducts = customProducts
        .filter(p => {
            if (!productSearchTerm) return true;
            const term = productSearchTerm.toLowerCase();
            return p.brand.toLowerCase().includes(term) || 
                   p.model.toLowerCase().includes(term) ||
                   p.category.toLowerCase().includes(term);
        })
        .sort((a, b) => {
            let comparison = 0;
            switch (productSortBy) {
                case 'name':
                    comparison = `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
                    break;
                case 'price':
                    comparison = a.price - b.price;
                    break;
                case 'score':
                    comparison = a.score - b.score;
                    break;
                case 'category':
                    comparison = a.category.localeCompare(b.category);
                    break;
            }
            return productSortOrder === 'asc' ? comparison : -comparison;
        });

    const toggleProductSelection = (id: string) => {
        setSelectedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAllProducts = () => {
        if (selectedProducts.size === filteredProducts.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedProducts.size === 0) return;
        if (!confirm(`Weet je zeker dat je ${selectedProducts.size} producten wilt verwijderen?`)) return;
        
        for (const id of selectedProducts) {
            await onDeleteProduct(id);
        }
        setSelectedProducts(new Set());
        showToast(`${selectedProducts.size} producten verwijderd`, 'success');
    };

    // Handle price sync for all products with EAN
    const [isSyncingPrices, setIsSyncingPrices] = useState(false);
    
    const handleSyncPrices = async () => {
        const productsWithEan = customProducts.filter(p => p.ean);
        if (productsWithEan.length === 0) {
            showToast('Geen producten met EAN gevonden', 'warning');
            return;
        }

        setIsSyncingPrices(true);
        addLog(`🔄 Start price sync voor ${productsWithEan.length} producten...`);
        showToast(`Price sync gestart voor ${productsWithEan.length} producten`, 'info');

        try {
            const result = await aiService.syncPrices(productsWithEan.map(p => ({
                id: p.id,
                ean: p.ean,
                price: p.price,
                brand: p.brand,
                model: p.model
            })));

            if (result.updates.length > 0) {
                addLog(`✅ ${result.updates.length} prijzen geüpdatet:`);
                result.updates.forEach(u => {
                    addLog(`  - ${u.brand} ${u.model}: €${u.oldPrice} → €${u.newPrice}`);
                });
                showToast(`${result.updates.length} prijzen geüpdatet!`, 'success');
            } else {
                addLog(`ℹ️ Alle prijzen zijn actueel`);
                showToast('Alle prijzen zijn actueel', 'info');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            addLog(`❌ Fout bij price sync: ${errorMsg}`);
            showToast(`Fout: ${errorMsg}`, 'error');
        } finally {
            setIsSyncingPrices(false);
        }
    };

    const filteredArticles = savedArticles.filter(a => {
        if (!articleSearchTerm) return true;
        return a.title.toLowerCase().includes(articleSearchTerm.toLowerCase());
    });

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map(toast => (
                    <div 
                        key={toast.id} 
                        className={`animate-fade-in flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md ${
                            toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-100' :
                            toast.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-100' :
                            toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100' :
                            'bg-blue-900/90 border-blue-700 text-blue-100'
                        }`}
                    >
                        <i className={`fas ${
                            toast.type === 'success' ? 'fa-check-circle' :
                            toast.type === 'error' ? 'fa-exclamation-circle' :
                            toast.type === 'warning' ? 'fa-exclamation-triangle' :
                            'fa-info-circle'
                        }`}></i>
                        <span className="text-sm font-medium">{toast.message}</span>
                        <button onClick={() => removeToast(toast.id)} className="ml-2 opacity-60 hover:opacity-100 transition">
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                ))}
            </div>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)}></div>
            )}

            <div className="flex min-h-screen">
                {/* Sidebar Navigation */}
                <aside className={`
                    fixed lg:sticky top-0 left-0 h-screen z-40 
                    bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800
                    transition-all duration-300 ease-in-out
                    ${sidebarCollapsed ? 'w-20' : 'w-64'}
                    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    {/* Logo Area */}
                    <div className="p-4 border-b border-slate-800">
                        <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                    <i className="fas fa-chart-line text-white"></i>
                                </div>
                                {!sidebarCollapsed && (
                                    <div>
                                        <div className="font-bold text-white text-sm">ProductPraat</div>
                                        <div className="text-xs text-slate-500">Redactie Panel</div>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                className="hidden lg:flex text-slate-400 hover:text-white transition p-1"
                            >
                                <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
                            </button>
                        </div>
                    </div>

                    {/* Navigation Items */}
                    <nav className="p-3 space-y-1">
                        {[
                            { id: 'dashboard', icon: 'fa-th-large', label: 'Dashboard', color: 'blue' },
                            { id: 'products', icon: 'fa-box-open', label: 'Producten', color: 'purple' },
                            { id: 'articles', icon: 'fa-newspaper', label: 'Artikelen', color: 'green' }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id as any); setMobileMenuOpen(false); }}
                                className={`
                                    w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                                    ${sidebarCollapsed ? 'justify-center' : ''}
                                    ${activeTab === item.id 
                                        ? `bg-${item.color}-600/20 text-${item.color}-400 border border-${item.color}-500/30 shadow-lg` 
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }
                                `}
                                title={sidebarCollapsed ? item.label : ''}
                            >
                                <i className={`fas ${item.icon} text-lg`}></i>
                                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
                                {!sidebarCollapsed && item.id === 'products' && (
                                    <span className="ml-auto bg-slate-700 text-xs px-2 py-0.5 rounded-full">{customProducts.length}</span>
                                )}
                                {!sidebarCollapsed && item.id === 'articles' && (
                                    <span className="ml-auto bg-slate-700 text-xs px-2 py-0.5 rounded-full">{savedArticles.length}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Bottom Actions */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-800 space-y-2">
                        <button 
                            onClick={handleResetDatabase}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-red-400 hover:bg-red-950/50 transition ${sidebarCollapsed ? 'justify-center' : ''}`}
                            title={sidebarCollapsed ? 'Database Wissen' : ''}
                        >
                            <i className="fas fa-trash-alt"></i>
                            {!sidebarCollapsed && <span className="text-sm">Database Wissen</span>}
                        </button>
                        <button 
                            onClick={onLogout}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition ${sidebarCollapsed ? 'justify-center' : ''}`}
                            title={sidebarCollapsed ? 'Uitloggen' : ''}
                        >
                            <i className="fas fa-sign-out-alt"></i>
                            {!sidebarCollapsed && <span className="text-sm">Uitloggen</span>}
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 min-h-screen">
                    {/* Top Header Bar */}
                    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
                        <div className="flex items-center justify-between px-6 py-4">
                            <div className="flex items-center gap-4">
                                {/* Mobile Menu Toggle */}
                                <button 
                                    onClick={() => setMobileMenuOpen(true)}
                                    className="lg:hidden text-slate-400 hover:text-white p-2"
                                >
                                    <i className="fas fa-bars text-xl"></i>
                                </button>
                                
                                {/* Breadcrumbs */}
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-500">Dashboard</span>
                                    <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                                    <span className="text-white font-medium capitalize">{activeTab}</span>
                                    {activeTab === 'products' && (
                                        <>
                                            <i className="fas fa-chevron-right text-xs text-slate-600"></i>
                                            <span className="text-blue-400 capitalize">{productSubTab}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* Quick Actions */}
                            <div className="flex items-center gap-3">
                                {isProcessing && (
                                    <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-800">
                                        <i className="fas fa-spinner fa-spin"></i>
                                        <span className="hidden sm:inline">{loadingMessage || 'Bezig...'}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    <span className="text-xs text-slate-400 hidden sm:inline">API Online</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Page Content */}
                    <div className="p-6">
                        {/* === DASHBOARD TAB === */}
                        {activeTab === 'dashboard' && (
                            <div className="animate-fade-in space-y-6">
                                {/* Stats Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 p-6 rounded-2xl border border-blue-500/30 shadow-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-blue-600/30 flex items-center justify-center">
                                                <i className="fas fa-box-open text-blue-400 text-xl"></i>
                                            </div>
                                            <span className="text-green-400 text-xs flex items-center gap-1">
                                                <i className="fas fa-arrow-up"></i> +12%
                                            </span>
                                        </div>
                                        <div className="text-3xl font-black text-white mb-1">{customProducts.length}</div>
                                        <div className="text-slate-400 text-sm">Producten</div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-br from-green-600/20 to-green-900/20 p-6 rounded-2xl border border-green-500/30 shadow-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-green-600/30 flex items-center justify-center">
                                                <i className="fas fa-newspaper text-green-400 text-xl"></i>
                                            </div>
                                            <span className="text-green-400 text-xs flex items-center gap-1">
                                                <i className="fas fa-arrow-up"></i> +5
                                            </span>
                                        </div>
                                        <div className="text-3xl font-black text-white mb-1">{savedArticles.length}</div>
                                        <div className="text-slate-400 text-sm">Artikelen</div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 p-6 rounded-2xl border border-purple-500/30 shadow-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center">
                                                <i className="fas fa-tags text-purple-400 text-xl"></i>
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-white mb-1">{Object.keys(CATEGORIES).length}</div>
                                        <div className="text-slate-400 text-sm">Categorieën</div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 p-6 rounded-2xl border border-emerald-500/30 shadow-xl">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-600/30 flex items-center justify-center">
                                                <i className="fas fa-check-circle text-emerald-400 text-xl"></i>
                                            </div>
                                        </div>
                                        <div className="text-3xl font-black text-emerald-400 mb-1">Online</div>
                                        <div className="text-slate-400 text-sm">Systeem Status</div>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <i className="fas fa-bolt text-yellow-400"></i> Snelle Acties
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <button 
                                            onClick={() => { setActiveTab('products'); setProductSubTab('import'); }}
                                            className="p-4 bg-slate-800 hover:bg-blue-600/20 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group"
                                        >
                                            <i className="fas fa-plus-circle text-2xl text-blue-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Nieuw Product</div>
                                        </button>
                                        <button 
                                            onClick={() => { setActiveTab('products'); setProductSubTab('bulk'); }}
                                            className="p-4 bg-slate-800 hover:bg-purple-600/20 rounded-xl border border-slate-700 hover:border-purple-500/50 transition-all group"
                                        >
                                            <i className="fas fa-layer-group text-2xl text-purple-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Bulk Import</div>
                                        </button>
                                        <button 
                                            onClick={() => { setActiveTab('articles'); }}
                                            className="p-4 bg-slate-800 hover:bg-green-600/20 rounded-xl border border-slate-700 hover:border-green-500/50 transition-all group"
                                        >
                                            <i className="fas fa-pen-fancy text-2xl text-green-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Nieuw Artikel</div>
                                        </button>
                                        <button 
                                            onClick={() => { setActiveTab('products'); setProductSubTab('autopilot'); }}
                                            className="p-4 bg-slate-800 hover:bg-orange-600/20 rounded-xl border border-slate-700 hover:border-orange-500/50 transition-all group"
                                        >
                                            <i className="fas fa-rocket text-2xl text-orange-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Auto-Pilot</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Recent Activity & Category Overview */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Recent Products */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <i className="fas fa-clock text-blue-400"></i> Recente Producten
                                        </h3>
                                        <div className="space-y-3">
                                            {customProducts.slice(0, 5).map(p => (
                                                <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                                                    <img src={p.image} className="w-10 h-10 object-contain bg-white rounded-lg" referrerPolicy="no-referrer" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-white text-sm truncate">{p.brand} {p.model}</div>
                                                        <div className="text-xs text-slate-500">{CATEGORIES[p.category]?.name}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-blue-400">€{p.price}</div>
                                                </div>
                                            ))}
                                            {customProducts.length === 0 && (
                                                <div className="text-center py-8 text-slate-500">
                                                    <i className="fas fa-inbox text-3xl mb-2"></i>
                                                    <div>Nog geen producten</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Category Distribution */}
                                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <i className="fas fa-chart-pie text-purple-400"></i> Categorieën
                                        </h3>
                                        <div className="space-y-3">
                                            {Object.entries(CATEGORIES).slice(0, 6).map(([key, cat]) => {
                                                const count = customProducts.filter(p => p.category === key).length;
                                                const percentage = customProducts.length > 0 ? (count / customProducts.length) * 100 : 0;
                                                return (
                                                    <div key={key} className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-slate-300 flex items-center gap-2">
                                                                <i className={`fas ${cat.icon} text-xs text-slate-500`}></i>
                                                                {cat.name}
                                                            </span>
                                                            <span className="text-slate-400">{count}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === PRODUCTS TAB === */}
                        {activeTab === 'products' && (
                            <div className="animate-fade-in">
                                {/* Product Sub-Navigation */}
                                <div className="flex flex-wrap gap-2 mb-6 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                    {[
                                        { id: 'import', icon: 'fa-magic', label: 'Single Import', color: 'blue' },
                                        { id: 'bulk', icon: 'fa-layer-group', label: 'Bulk Import', color: 'purple' },
                                        { id: 'autopilot', icon: 'fa-rocket', label: 'Auto-Pilot', color: 'orange' },
                                        { id: 'list', icon: 'fa-list', label: `Producten (${customProducts.length})`, color: 'slate' }
                                    ].map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => setProductSubTab(sub.id as any)}
                                            className={`
                                                flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all
                                                ${productSubTab === sub.id 
                                                    ? `bg-${sub.color}-600 text-white shadow-lg` 
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                }
                                            `}
                                        >
                                            <i className={`fas ${sub.icon}`}></i>
                                            <span className="hidden sm:inline">{sub.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* 1. SINGLE IMPORT with Wizard */}
                                {productSubTab === 'import' && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                        {/* Import Steps Header */}
                                        <div className="bg-slate-950 p-4 border-b border-slate-800">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-magic text-blue-400"></i> Single Import Wizard
                                                </h2>
                                            </div>
                                            {/* Step Indicator */}
                                            <div className="flex items-center gap-2">
                                                {[
                                                    { step: 1, label: 'URL Invoeren' },
                                                    { step: 2, label: 'AI Verwerking' },
                                                    { step: 3, label: 'Bewerken & Opslaan' }
                                                ].map((s, idx) => (
                                                    <React.Fragment key={s.step}>
                                                        <div className={`
                                                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
                                                            ${(editingProduct ? 3 : importStep) >= s.step 
                                                                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                                                                : 'bg-slate-800 text-slate-500'
                                                            }
                                                        `}>
                                                            <span className={`
                                                                w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                                                                ${(editingProduct ? 3 : importStep) >= s.step ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}
                                                            `}>
                                                                {(editingProduct ? 3 : importStep) > s.step ? <i className="fas fa-check"></i> : s.step}
                                                            </span>
                                                            <span className="hidden sm:inline">{s.label}</span>
                                                        </div>
                                                        {idx < 2 && <i className="fas fa-chevron-right text-slate-600 text-xs"></i>}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-6">
                                            {!editingProduct ? (
                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-400 mb-2">
                                                            <i className="fas fa-link mr-2"></i>Bol.com Product URL
                                                        </label>
                                                        <div className="flex gap-3">
                                                            <input 
                                                                type="text" 
                                                                value={importUrl} 
                                                                onChange={e => setImportUrl(e.target.value)} 
                                                                placeholder="https://www.bol.com/nl/p/..." 
                                                                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                            <button 
                                                                onClick={handleSingleImport} 
                                                                disabled={isProcessing || !importUrl}
                                                                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white px-6 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                                                            >
                                                                {isProcessing ? (
                                                                    <><i className="fas fa-spinner fa-spin"></i> Importeren...</>
                                                                ) : (
                                                                    <><i className="fas fa-download"></i> Importeer</>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {isProcessing && (
                                                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center">
                                                                <i className="fas fa-spinner fa-spin text-blue-400"></i>
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-white">{loadingMessage}</div>
                                                                <div className="text-sm text-blue-400">Dit kan enkele seconden duren...</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-6 animate-fade-in">
                                                    {/* Product Preview with Image */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                        <div className="lg:col-span-1">
                                                            <div className="bg-white rounded-xl p-4 aspect-square flex items-center justify-center">
                                                                <img 
                                                                    src={editingProduct.image} 
                                                                    alt={editingProduct.model}
                                                                    className="max-w-full max-h-full object-contain"
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                            </div>
                                                            <div className="mt-4 text-center">
                                                                <div className="text-3xl font-black text-blue-400">{editingProduct.score}</div>
                                                                <div className="text-xs text-slate-500">Score</div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="lg:col-span-2 space-y-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Merk</label>
                                                                    <input 
                                                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition" 
                                                                        value={editingProduct.brand || ''} 
                                                                        onChange={e => setEditingProduct({...editingProduct, brand: e.target.value})} 
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Model</label>
                                                                    <input 
                                                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition" 
                                                                        value={editingProduct.model || ''} 
                                                                        onChange={e => setEditingProduct({...editingProduct, model: e.target.value})} 
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Prijs (€)</label>
                                                                    <input 
                                                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition" 
                                                                        type="number" 
                                                                        value={editingProduct.price || 0} 
                                                                        onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} 
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Score</label>
                                                                    <input 
                                                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition" 
                                                                        type="number" 
                                                                        step="0.1"
                                                                        min="0"
                                                                        max="10"
                                                                        value={editingProduct.score || 0} 
                                                                        onChange={e => setEditingProduct({...editingProduct, score: Number(e.target.value)})} 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Categorie</label>
                                                                <select 
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                                                    value={editingProduct.category || ''}
                                                                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                                                                >
                                                                    {Object.entries(CATEGORIES).map(([k, v]) => (
                                                                        <option key={k} value={k}>{v.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Beschrijving</label>
                                                                <textarea 
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition h-24 resize-none" 
                                                                    value={editingProduct.description || ''} 
                                                                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} 
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-3 pt-4 border-t border-slate-800">
                                                        <button 
                                                            onClick={saveEditedProduct} 
                                                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
                                                        >
                                                            <i className="fas fa-check-circle"></i> Opslaan & Publiceren
                                                        </button>
                                                        <button 
                                                            onClick={() => { setEditingProduct(null); setImportStep(1); }}
                                                            className="px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition"
                                                        >
                                                            Annuleren
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 2. BULK IMPORT with Progress Tracking */}
                                {productSubTab === 'bulk' && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                        <div className="bg-gradient-to-r from-purple-900/30 to-slate-900 p-4 border-b border-slate-800">
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <i className="fas fa-layer-group text-purple-400"></i> Bulk Import
                                            </h2>
                                            <p className="text-sm text-slate-400 mt-1">Importeer meerdere producten tegelijk met AI-verrijking</p>
                                        </div>
                                        
                                        <div className="p-6 space-y-4">
                                            {/* Import Mode Toggle */}
                                            <div className="flex gap-2 mb-4">
                                                <button
                                                    onClick={() => setBulkImportMode('urls')}
                                                    disabled={isProcessing}
                                                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                                        bulkImportMode === 'urls'
                                                            ? 'bg-purple-600 text-white shadow-lg'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                    }`}
                                                >
                                                    <i className="fas fa-link"></i>
                                                    <span>Import via URLs</span>
                                                </button>
                                                <button
                                                    onClick={() => setBulkImportMode('category')}
                                                    disabled={isProcessing}
                                                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                                        bulkImportMode === 'category'
                                                            ? 'bg-purple-600 text-white shadow-lg'
                                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                    }`}
                                                >
                                                    <i className="fas fa-tags"></i>
                                                    <span>Import via Categorie</span>
                                                </button>
                                            </div>

                                            {/* URL-based Import */}
                                            {bulkImportMode === 'urls' && (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-400 mb-2">
                                                            Bol.com URLs (één per regel)
                                                        </label>
                                                        <textarea 
                                                            value={bulkInput} 
                                                            onChange={(e) => setBulkInput(e.target.value)}
                                                            disabled={isProcessing}
                                                            className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white font-mono outline-none focus:border-purple-500 transition disabled:opacity-50"
                                                            placeholder="https://www.bol.com/nl/p/product-1/...&#10;https://www.bol.com/nl/p/product-2/...&#10;https://www.bol.com/nl/p/product-3/..."
                                                        />
                                                        <div className="mt-2 text-xs text-slate-500">
                                                            {bulkInput.split('\n').filter(l => l.trim()).length} URLs gevonden
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap gap-3">
                                                        <button 
                                                            onClick={handleBulkImport} 
                                                            disabled={isProcessing || !bulkInput.trim()}
                                                            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all"
                                                        >
                                                            {isProcessing && !isPaused ? (
                                                                <><i className="fas fa-spinner fa-spin"></i> Bezig...</>
                                                            ) : (
                                                                <><i className="fas fa-play"></i> Start Bulk Import</>
                                                            )}
                                                        </button>
                                                        
                                                        {isProcessing && (
                                                            <>
                                                                <button 
                                                                    onClick={togglePause}
                                                                    className={`px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition ${
                                                                        isPaused 
                                                                            ? 'bg-green-600 hover:bg-green-500 text-white' 
                                                                            : 'bg-yellow-600/20 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-600/30'
                                                                    }`}
                                                                >
                                                                    <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                                                                    {isPaused ? 'Hervat' : 'Pauzeer'}
                                                                </button>
                                                                <button 
                                                                    onClick={() => stopProcessRef.current = true}
                                                                    className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl font-bold hover:bg-red-900/50 transition flex items-center gap-2"
                                                                >
                                                                    <i className="fas fa-stop"></i> Stop
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Category-based Import */}
                                            {bulkImportMode === 'category' && (
                                                <>
                                                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <i className="fas fa-info-circle text-purple-400"></i>
                                                            <span className="text-sm font-medium text-purple-300">Automatisch importeren</span>
                                                        </div>
                                                        <p className="text-xs text-purple-200/70">
                                                            Zoek automatisch populaire producten in een categorie via de Bol.com API en importeer ze met affiliate links en AI-gegenereerde content.
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                                                                <i className="fas fa-tags mr-1"></i>Categorie
                                                            </label>
                                                            <select 
                                                                value={bulkCategorySelected} 
                                                                onChange={(e) => setBulkCategorySelected(e.target.value)}
                                                                disabled={isProcessing}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition cursor-pointer disabled:opacity-50"
                                                            >
                                                                {Object.entries(CATEGORIES).map(([k, v]) => (
                                                                    <option key={k} value={k}>{v.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                                                                <i className="fas fa-list-ol mr-1"></i>Aantal producten
                                                            </label>
                                                            <select 
                                                                value={bulkCategoryLimit} 
                                                                onChange={(e) => setBulkCategoryLimit(Number(e.target.value))}
                                                                disabled={isProcessing}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition cursor-pointer disabled:opacity-50"
                                                            >
                                                                <option value={3}>3 producten</option>
                                                                <option value={5}>5 producten</option>
                                                                <option value={10}>10 producten</option>
                                                                <option value={15}>15 producten</option>
                                                                <option value={20}>20 producten</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-3 mt-4">
                                                        <button 
                                                            onClick={handleBulkCategoryImport} 
                                                            disabled={isProcessing}
                                                            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all"
                                                        >
                                                            {isProcessing ? (
                                                                <><i className="fas fa-spinner fa-spin"></i> Bezig met {CATEGORIES[bulkCategorySelected].name}...</>
                                                            ) : (
                                                                <><i className="fas fa-search"></i> Zoek & Importeer {CATEGORIES[bulkCategorySelected].name}</>
                                                            )}
                                                        </button>
                                                        
                                                        {isProcessing && (
                                                            <button 
                                                                onClick={() => stopProcessRef.current = true}
                                                                className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl font-bold hover:bg-red-900/50 transition flex items-center gap-2"
                                                            >
                                                                <i className="fas fa-stop"></i> Stop
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Progress Section */}
                                            {(isProcessing || progress > 0) && (
                                                <div className="space-y-4 pt-4">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-slate-400">Voortgang</span>
                                                        <span className="text-white font-bold">{Math.round(progress)}%</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-500"
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    
                                                    {/* Status indicators */}
                                                    {bulkProgress.statuses.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-3">
                                                            {bulkProgress.statuses.map((status, idx) => (
                                                                <div 
                                                                    key={idx}
                                                                    className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                                                                        status === 'success' ? 'bg-green-600/30 text-green-400' :
                                                                        status === 'error' ? 'bg-red-600/30 text-red-400' :
                                                                        status === 'processing' ? 'bg-blue-600/30 text-blue-400' :
                                                                        'bg-slate-800 text-slate-500'
                                                                    }`}
                                                                    title={`Item ${idx + 1}: ${status}`}
                                                                >
                                                                    {status === 'success' ? <i className="fas fa-check"></i> :
                                                                     status === 'error' ? <i className="fas fa-times"></i> :
                                                                     status === 'processing' ? <i className="fas fa-spinner fa-spin"></i> :
                                                                     idx + 1}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Log output */}
                                                    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                                        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                                                            <span className="text-xs font-bold text-slate-400 uppercase">Console Output</span>
                                                            <button 
                                                                onClick={() => setPilotLogs([])}
                                                                className="text-xs text-slate-500 hover:text-slate-300"
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                        <div className="p-4 h-48 overflow-y-auto font-mono text-xs custom-scroll">
                                                            {pilotLogs.length === 0 ? (
                                                                <div className="text-slate-600">Wachten op logs...</div>
                                                            ) : (
                                                                pilotLogs.map((log, i) => (
                                                                    <div 
                                                                        key={i} 
                                                                        className={`py-1 border-b border-slate-900/50 ${
                                                                            log.includes('✅') ? 'text-green-400' : 
                                                                            log.includes('❌') ? 'text-red-400' : 
                                                                            log.includes('📦') || log.includes('🎉') ? 'text-purple-400' :
                                                                            'text-slate-400'
                                                                        }`}
                                                                    >
                                                                        {log}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 3. AUTO PILOT with Timeline */}
                                {productSubTab === 'autopilot' && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                        <div className="bg-gradient-to-r from-orange-900/30 to-slate-900 p-4 border-b border-slate-800">
                                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                <i className="fas fa-rocket text-orange-400"></i> Category Launch
                                            </h2>
                                            <p className="text-sm text-slate-400 mt-1">Vul automatisch een categorie met producten en content</p>
                                        </div>
                                        
                                        <div className="p-6 space-y-6">
                                            {/* Category Selector */}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {Object.entries(CATEGORIES).slice(0, 8).map(([key, cat]) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => setPilotCategory(key)}
                                                        disabled={isProcessing}
                                                        className={`
                                                            p-4 rounded-xl border transition-all text-center
                                                            ${pilotCategory === key 
                                                                ? 'bg-orange-600/20 border-orange-500/50 text-orange-400' 
                                                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                                                            }
                                                            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                                                        `}
                                                    >
                                                        <i className={`fas ${cat.icon} text-xl mb-2`}></i>
                                                        <div className="text-sm font-medium">{cat.name}</div>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Progress Timeline */}
                                            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                                                <div className="flex items-center gap-4">
                                                    {[
                                                        { phase: 1, label: 'Producten zoeken', icon: 'fa-search' },
                                                        { phase: 2, label: 'Content genereren', icon: 'fa-pen' },
                                                        { phase: 3, label: 'Klaar!', icon: 'fa-check' }
                                                    ].map((p, idx) => (
                                                        <React.Fragment key={p.phase}>
                                                            <div className={`
                                                                flex items-center gap-3 flex-1
                                                                ${autopilotPhase >= p.phase && isProcessing ? 'text-orange-400' : 
                                                                  autopilotPhase > p.phase ? 'text-green-400' : 'text-slate-500'}
                                                            `}>
                                                                <div className={`
                                                                    w-10 h-10 rounded-full flex items-center justify-center border-2
                                                                    ${autopilotPhase > p.phase ? 'bg-green-600/20 border-green-500' :
                                                                      autopilotPhase === p.phase && isProcessing ? 'bg-orange-600/20 border-orange-500' : 
                                                                      'bg-slate-800 border-slate-700'}
                                                                `}>
                                                                    {autopilotPhase > p.phase ? (
                                                                        <i className="fas fa-check text-green-400"></i>
                                                                    ) : autopilotPhase === p.phase && isProcessing ? (
                                                                        <i className={`fas ${p.icon} fa-spin text-orange-400`}></i>
                                                                    ) : (
                                                                        <i className={`fas ${p.icon}`}></i>
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-medium hidden sm:block">{p.label}</span>
                                                            </div>
                                                            {idx < 2 && (
                                                                <div className={`flex-shrink-0 w-12 h-0.5 ${
                                                                    autopilotPhase > p.phase ? 'bg-green-500' : 'bg-slate-700'
                                                                }`}></div>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-wrap gap-3">
                                                <button 
                                                    onClick={runCategoryLaunch} 
                                                    disabled={isProcessing}
                                                    className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-600/20 flex items-center gap-2 transition-all"
                                                >
                                                    {isProcessing ? (
                                                        <><i className="fas fa-spinner fa-spin"></i> Bezig met {CATEGORIES[pilotCategory].name}...</>
                                                    ) : (
                                                        <><i className="fas fa-rocket"></i> Start Launch: {CATEGORIES[pilotCategory].name}</>
                                                    )}
                                                </button>
                                                
                                                {isProcessing && (
                                                    <button 
                                                        onClick={() => stopProcessRef.current = true}
                                                        className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl font-bold hover:bg-red-900/50 transition flex items-center gap-2"
                                                    >
                                                        <i className="fas fa-stop"></i> Stop
                                                    </button>
                                                )}
                                            </div>

                                            {/* Logs */}
                                            {(isProcessing || pilotLogs.length > 0) && (
                                                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                                                    <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Launch Log</span>
                                                        <button 
                                                            onClick={() => setPilotLogs([])}
                                                            className="text-xs text-slate-500 hover:text-slate-300"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                    <div className="p-4 h-64 overflow-y-auto font-mono text-xs custom-scroll">
                                                        {pilotLogs.length === 0 ? (
                                                            <div className="text-slate-600">Wachten op activiteit...</div>
                                                        ) : (
                                                            pilotLogs.map((log, i) => (
                                                                <div 
                                                                    key={i} 
                                                                    className={`py-1 border-b border-slate-900/50 ${
                                                                        log.includes('✅') ? 'text-green-400' : 
                                                                        log.includes('❌') ? 'text-red-400' : 
                                                                        log.includes('🚀') || log.includes('🎉') ? 'text-orange-400' :
                                                                        log.includes('📦') || log.includes('📝') ? 'text-blue-400' :
                                                                        'text-slate-400'
                                                                    }`}
                                                                >
                                                                    {log}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 4. PRODUCT LIST with Search, Sort, and Bulk Actions */}
                                {productSubTab === 'list' && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                        {/* List Header */}
                                        <div className="bg-slate-950 p-4 border-b border-slate-800">
                                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-list text-slate-400"></i> 
                                                    Alle Producten
                                                    <span className="text-sm font-normal text-slate-500">({filteredProducts.length})</span>
                                                </h2>
                                                
                                                <div className="flex flex-wrap gap-2">
                                                    {/* Search */}
                                                    <div className="relative">
                                                        <input 
                                                            type="text"
                                                            value={productSearchTerm}
                                                            onChange={e => setProductSearchTerm(e.target.value)}
                                                            placeholder="Zoeken..."
                                                            className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-blue-500 w-48"
                                                        />
                                                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                                    </div>
                                                    
                                                    {/* Sort */}
                                                    <select 
                                                        value={productSortBy}
                                                        onChange={e => setProductSortBy(e.target.value as any)}
                                                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none cursor-pointer"
                                                    >
                                                        <option value="name">Naam</option>
                                                        <option value="price">Prijs</option>
                                                        <option value="score">Score</option>
                                                        <option value="category">Categorie</option>
                                                    </select>
                                                    
                                                    <button
                                                        onClick={() => setProductSortOrder(productSortOrder === 'asc' ? 'desc' : 'asc')}
                                                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white hover:bg-slate-700 transition"
                                                    >
                                                        <i className={`fas fa-sort-${productSortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    </button>
                                                    
                                                    {/* Sync Prices Button */}
                                                    <button
                                                        onClick={handleSyncPrices}
                                                        disabled={isSyncingPrices || customProducts.length === 0}
                                                        className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-lg shadow-green-600/20"
                                                    >
                                                        {isSyncingPrices ? (
                                                            <><i className="fas fa-spinner fa-spin"></i> Syncing...</>
                                                        ) : (
                                                            <><i className="fas fa-sync-alt"></i> Sync Prijzen</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Bulk Actions */}
                                            {selectedProducts.size > 0 && (
                                                <div className="mt-4 flex items-center gap-3 bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                                                    <span className="text-sm text-blue-400">
                                                        {selectedProducts.size} geselecteerd
                                                    </span>
                                                    <button 
                                                        onClick={handleBulkDelete}
                                                        className="bg-red-600/20 border border-red-500/50 text-red-400 px-3 py-1 rounded-lg text-sm hover:bg-red-600/30 transition flex items-center gap-1"
                                                    >
                                                        <i className="fas fa-trash"></i> Verwijderen
                                                    </button>
                                                    <button 
                                                        onClick={() => setSelectedProducts(new Set())}
                                                        className="text-sm text-slate-400 hover:text-white"
                                                    >
                                                        Deselecteer
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Table Header */}
                                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-900/50 text-xs font-bold text-slate-500 uppercase border-b border-slate-800">
                                            <div className="col-span-1 flex items-center">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                                                    onChange={selectAllProducts}
                                                    className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="col-span-4">Product</div>
                                            <div className="col-span-2">Categorie</div>
                                            <div className="col-span-2">Prijs</div>
                                            <div className="col-span-2">Score</div>
                                            <div className="col-span-1">Acties</div>
                                        </div>
                                        
                                        {/* Product List */}
                                        <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto custom-scroll">
                                            {filteredProducts.length === 0 ? (
                                                <div className="p-12 text-center text-slate-500">
                                                    <i className="fas fa-inbox text-4xl mb-3"></i>
                                                    <div>Geen producten gevonden</div>
                                                </div>
                                            ) : (
                                                filteredProducts.map(p => (
                                                    <div 
                                                        key={p.id} 
                                                        className={`
                                                            grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-800/50 transition
                                                            ${selectedProducts.has(p.id) ? 'bg-blue-900/10' : ''}
                                                        `}
                                                    >
                                                        <div className="col-span-1 flex items-center">
                                                            <input 
                                                                type="checkbox"
                                                                checked={selectedProducts.has(p.id)}
                                                                onChange={() => toggleProductSelection(p.id)}
                                                                className="rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                                            />
                                                        </div>
                                                        <div className="col-span-11 md:col-span-4 flex items-center gap-3">
                                                            <img 
                                                                src={p.image} 
                                                                className="w-10 h-10 object-contain bg-white rounded-lg flex-shrink-0" 
                                                                referrerPolicy="no-referrer"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-white text-sm truncate">{p.brand} {p.model}</div>
                                                                <div className="text-xs text-slate-500 md:hidden">{CATEGORIES[p.category]?.name} • €{p.price}</div>
                                                            </div>
                                                        </div>
                                                        <div className="hidden md:block col-span-2">
                                                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                                <i className={`fas ${CATEGORIES[p.category]?.icon} text-slate-500`}></i>
                                                                {CATEGORIES[p.category]?.name}
                                                            </span>
                                                        </div>
                                                        <div className="hidden md:block col-span-2 text-sm font-medium text-white">
                                                            €{p.price.toLocaleString()}
                                                        </div>
                                                        <div className="hidden md:block col-span-2">
                                                            <span className={`
                                                                inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold
                                                                ${p.score >= 8 ? 'bg-green-600/20 text-green-400' :
                                                                  p.score >= 6 ? 'bg-yellow-600/20 text-yellow-400' :
                                                                  'bg-red-600/20 text-red-400'}
                                                            `}>
                                                                {p.score.toFixed(1)}
                                                            </span>
                                                        </div>
                                                        <div className="hidden md:flex col-span-1 gap-2">
                                                            <button 
                                                                onClick={() => onDeleteProduct(p.id)}
                                                                className="text-red-400 hover:text-red-300 transition p-1"
                                                                title="Verwijderen"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* === ARTICLES TAB === */}
                        {activeTab === 'articles' && (
                            <div className="animate-fade-in">
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    {/* Article Studio - Left Panel */}
                                    <div className="xl:col-span-2 space-y-6">
                                        {/* Article Generator */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                            <div className="bg-gradient-to-r from-green-900/30 to-slate-900 p-4 border-b border-slate-800">
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-pen-fancy text-green-400"></i> Artikel Studio
                                                </h2>
                                                <p className="text-sm text-slate-400 mt-1">Genereer professionele artikelen met AI</p>
                                            </div>
                                            
                                            <div className="p-6 space-y-5">
                                                {/* Template Selection */}
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-3">Template Type</label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {[
                                                            { type: 'guide', icon: 'fa-book', label: 'Koopgids', desc: 'Complete gids' },
                                                            { type: 'list', icon: 'fa-list-ol', label: 'Toplijst', desc: 'Top 5/10 lijst' },
                                                            { type: 'comparison', icon: 'fa-balance-scale', label: 'Vergelijking', desc: 'A vs B' }
                                                        ].map(t => (
                                                            <button
                                                                key={t.type}
                                                                onClick={() => setStudioType(t.type as ArticleType)}
                                                                className={`
                                                                    p-4 rounded-xl border text-center transition-all
                                                                    ${studioType === t.type 
                                                                        ? 'bg-green-600/20 border-green-500/50 text-green-400' 
                                                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                                                                    }
                                                                `}
                                                            >
                                                                <i className={`fas ${t.icon} text-xl mb-2`}></i>
                                                                <div className="font-medium text-sm">{t.label}</div>
                                                                <div className="text-xs opacity-60">{t.desc}</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Categorie</label>
                                                        <select 
                                                            value={studioCategory} 
                                                            onChange={(e) => setStudioCategory(e.target.value)}
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition cursor-pointer"
                                                        >
                                                            {Object.entries(CATEGORIES).map(([k, v]) => (
                                                                <option key={k} value={k}>{v.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Onderwerp / Titel</label>
                                                        <input 
                                                            type="text" 
                                                            value={studioTopic} 
                                                            onChange={(e) => setStudioTopic(e.target.value)}
                                                            placeholder="Bijv: De Beste Airfryers van 2026..."
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition"
                                                        />
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={handleGenerateArticle} 
                                                    disabled={isProcessing || !studioTopic.trim()}
                                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    {isProcessing ? (
                                                        <><i className="fas fa-spinner fa-spin"></i> AI schrijft artikel...</>
                                                    ) : (
                                                        <><i className="fas fa-magic"></i> Genereer Artikel</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Generated Article Preview */}
                                        {generatedArticle && (
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-fade-in">
                                                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                                                    <h3 className="font-bold text-white flex items-center gap-2">
                                                        <i className="fas fa-file-alt text-green-400"></i> Preview
                                                    </h3>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={handleSaveArticle}
                                                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                                                        >
                                                            <i className="fas fa-save"></i> Opslaan
                                                        </button>
                                                        <button 
                                                            onClick={() => setGeneratedArticle(null)}
                                                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                        >
                                                            Annuleren
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-6">
                                                    <h2 className="text-2xl font-bold text-white mb-4">{generatedArticle.title}</h2>
                                                    {generatedArticle.summary && (
                                                        <p className="text-slate-400 mb-4 leading-relaxed">{generatedArticle.summary}</p>
                                                    )}
                                                    {generatedArticle.htmlContent && (
                                                        <div 
                                                            className="prose prose-invert prose-sm max-w-none"
                                                            dangerouslySetInnerHTML={{ __html: generatedArticle.htmlContent }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Published Articles - Right Panel */}
                                    <div className="xl:col-span-1">
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden sticky top-24">
                                            <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-bold text-white flex items-center gap-2">
                                                        <i className="fas fa-newspaper text-blue-400"></i> Gepubliceerd
                                                        <span className="text-xs text-slate-500">({savedArticles.length})</span>
                                                    </h3>
                                                </div>
                                                {/* Search */}
                                                <div className="mt-3 relative">
                                                    <input 
                                                        type="text"
                                                        value={articleSearchTerm}
                                                        onChange={e => setArticleSearchTerm(e.target.value)}
                                                        placeholder="Zoeken in artikelen..."
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-blue-500"
                                                    />
                                                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                                </div>
                                            </div>
                                            
                                            <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto custom-scroll">
                                                {filteredArticles.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-500">
                                                        <i className="fas fa-file-alt text-3xl mb-2"></i>
                                                        <div className="text-sm">Geen artikelen gevonden</div>
                                                    </div>
                                                ) : (
                                                    filteredArticles.map(article => (
                                                        <div 
                                                            key={article.id} 
                                                            className="p-4 hover:bg-slate-800/50 transition group"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium text-white text-sm truncate">{article.title}</h4>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className={`
                                                                            text-xs px-2 py-0.5 rounded
                                                                            ${article.type === 'guide' ? 'bg-blue-600/20 text-blue-400' :
                                                                              article.type === 'list' ? 'bg-purple-600/20 text-purple-400' :
                                                                              'bg-green-600/20 text-green-400'}
                                                                        `}>
                                                                            {article.type === 'guide' ? 'Gids' : 
                                                                             article.type === 'list' ? 'Toplijst' : 'Vergelijking'}
                                                                        </span>
                                                                        <span className="text-xs text-slate-500">{article.date}</span>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleDeleteArticle(article.id)}
                                                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition p-1"
                                                                    title="Verwijderen"
                                                                >
                                                                    <i className="fas fa-trash text-sm"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Custom Styles */}
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-track { background: #1e293b; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
            `}</style>
        </div>
    );
};

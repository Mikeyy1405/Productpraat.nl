
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiService } from '../services/aiService';
import { fetchBolProduct, searchBolProducts, searchBolProductsDetailed, importProductByEan, BolSearchProduct } from '../services/bolService';
import { Product, CATEGORIES, Article, ArticleType, AffiliateNetworkId } from '../types';
import { db } from '../services/storage';
import { generateArticleSlug, ARTICLE_TYPE_LABELS, ARTICLE_TYPE_COLORS, removeFirstH1FromHtml } from '../services/urlService';
import { validateProduct, validateArticle, checkDuplicateProduct, ValidationResult } from '../utils/validation';
import { AnalyticsWidget } from './AnalyticsWidget';
import { ProductGenerator } from './ProductGenerator';
import { CMSDashboard } from '../src/cms';
import { AutomationTab } from './AutomationTab';
import { 
    loadAffiliateConfig, 
    saveAffiliateConfig, 
    updateNetworkConfig,
    getNetworkStats,
    getTotalStats,
    getTopProducts as getAffiliateTopProducts,
    getDailyStats,
    getRecentClicks,
    getRecentConversions,
    clearTrackingData,
    exportAllData,
    AffiliateNetworkConfig,
    AffiliateConfig,
    AffiliateNetworkId as AffiliateUtilsNetworkId
} from '../utils/affiliateUtils';

interface AdminPanelProps {
    onAddProduct: (product: Product) => Promise<void>;
    onDeleteProduct: (id: string) => Promise<void>;
    customProducts: Product[];
    articles: Article[];
    setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
    onLogout: () => void;
}

// Toast notification types
interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

// Import error state
interface ImportError {
    message: string;
    code?: string;
    troubleshooting?: string[];
    canRetry: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onAddProduct, onDeleteProduct, customProducts, articles, setArticles, onLogout }) => {
    // --- MAIN NAVIGATION ---
    const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'articles' | 'cms' | 'affiliate' | 'automation'>('dashboard');
    const [productSubTab, setProductSubTab] = useState<'import' | 'bulk' | 'autopilot' | 'list' | 'url-import'>('import');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // --- STATE: URL-BASED PRODUCT GENERATOR ---
    const [showProductGenerator, setShowProductGenerator] = useState(false);
    
    // --- STATE: AFFILIATE MANAGEMENT ---
    const [affiliateConfig, setAffiliateConfig] = useState<AffiliateConfig>(() => loadAffiliateConfig());
    const [affiliateSubTab, setAffiliateSubTab] = useState<'networks' | 'stats' | 'analytics'>('networks');

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
    const [importError, setImportError] = useState<ImportError | null>(null);
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    
    // --- STATE: BOL.COM PRODUCT SEARCH ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<BolSearchProduct[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [selectedSearchProduct, setSelectedSearchProduct] = useState<BolSearchProduct | null>(null);
    const [importMode, setImportMode] = useState<'url' | 'search'>('search');

    // --- STATE: ARTICLES ---
    const [studioType, setStudioType] = useState<ArticleType>('comparison');
    const [studioTopic, setStudioTopic] = useState('');
    const [studioCategory, setStudioCategory] = useState('wasmachines');
    const [generatedArticle, setGeneratedArticle] = useState<Partial<Article> | null>(null);
    const [articleSearchTerm, setArticleSearchTerm] = useState('');
    const [editingArticle, setEditingArticle] = useState<Article | null>(null);
    const [articleSubTab, setArticleSubTab] = useState<'generate' | 'list'>('generate');

    // --- STATE: PRODUCT LIST ---
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [productSortBy, setProductSortBy] = useState<'name' | 'price' | 'score' | 'category'>('name');
    const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

    // --- TOAST NOTIFICATIONS ---
    const [toasts, setToasts] = useState<Toast[]>([]);

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
    // PRODUCT SEARCH HANDLERS
    // ========================================================================
    const handleProductSearch = async () => {
        if (!searchQuery.trim()) {
            showError('Vul een zoekterm in');
            return;
        }
        
        setIsSearching(true);
        setSearchError(null);
        setSearchResults([]);
        setSelectedSearchProduct(null);
        addLog(`🔍 Zoeken naar: "${searchQuery}"`);
        
        try {
            const result = await searchBolProductsDetailed(searchQuery.trim(), 50);
            
            if (result.error) {
                setSearchError(result.error);
                addLog(`❌ Zoeken mislukt: ${result.error}`);
                showToast(result.error, 'error');
            } else if (result.products.length === 0) {
                setSearchError('Geen producten gevonden. Probeer een andere zoekterm.');
                addLog(`ℹ️ Geen producten gevonden voor: "${searchQuery}"`);
            } else {
                setSearchResults(result.products);
                addLog(`✅ ${result.products.length} producten gevonden`);
                showToast(`${result.products.length} producten gevonden`, 'success');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            setSearchError(errorMsg);
            addLog(`❌ Zoeken fout: ${errorMsg}`);
            showToast(`Zoeken mislukt: ${errorMsg}`, 'error');
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleSelectSearchProduct = (product: BolSearchProduct) => {
        setSelectedSearchProduct(product);
        addLog(`📦 Geselecteerd: ${product.title.substring(0, 50)}...`);
    };
    
    const handleImportSelectedProduct = async () => {
        if (!selectedSearchProduct) {
            showError('Selecteer eerst een product');
            return;
        }
        
        setIsProcessing(true);
        setLoadingMessage('Product importeren...');
        addLog(`📥 Importeren: ${selectedSearchProduct.title.substring(0, 40)}...`);
        
        try {
            setImportStep(2);
            setLoadingMessage('AI analyse bezig...');
            
            const { bolData, aiData, warnings } = await importProductByEan(selectedSearchProduct.ean);
            
            addLog(`✅ AI data ontvangen - Merk: ${aiData.brand}, Model: ${aiData.model}`);
            
            // Display warnings if any
            if (warnings && warnings.length > 0) {
                addLog(`⚠️ Waarschuwingen: ${warnings.join(', ')}`);
                showToast(`Product geïmporteerd met waarschuwingen`, 'warning');
            }
            
            const draft: Partial<Product> = {
                id: `search-${Date.now()}`,
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
            
            // Direct opslaan zonder editing step
            setLoadingMessage('Product opslaan...');
            addLog('💾 Product opslaan in database...');

            try {
                await onAddProduct(draft as Product);
                addLog('✅ Product opgeslagen!');
                showToast('✅ Product succesvol toegevoegd!', 'success');
                
                // Reset for next product
                setSelectedSearchProduct(null);
                setSearchQuery('');
                setSearchResults([]);
                setImportStep(1);
            } catch (saveError: unknown) {
                const saveErrorMsg = saveError instanceof Error ? saveError.message : String(saveError);
                addLog(`❌ Opslaan mislukt: ${saveErrorMsg}`);
                showError(`Opslaan mislukt: ${saveErrorMsg}`);
                // Show in edit mode so user can try again
                setEditingProduct(draft);
                setImportStep(3);
            }
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            addLog(`❌ Import fout: ${errorMsg}`);
            showToast(`Import mislukt: ${errorMsg}`, 'error');
            setImportStep(1);
        } finally {
            setIsProcessing(false);
            setLoadingMessage('');
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
    // 1B. BULK IMPORT BY CATEGORY HANDLER (Server-side with AI) - WITH STREAMING PROGRESS
    // ========================================================================
    const abortControllerRef = useRef<(() => void) | null>(null);
    
    const handleBulkCategoryImport = async () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        stopProcessRef.current = false;
        setProgress(0);
        setLoadingMessage(`Producten zoeken in categorie ${CATEGORIES[bulkCategorySelected].name}...`);
        addLog(`📦 Start Bulk Category Import: ${CATEGORIES[bulkCategorySelected].name} (max ${bulkCategoryLimit} producten)`);
        showToast(`Bulk category import gestart: ${CATEGORIES[bulkCategorySelected].name}`, 'info');
        
        // Initialize progress tracking
        setBulkProgress({ current: 0, total: 0, statuses: [] });

        try {
            // Use the new streaming endpoint
            const { promise, abort } = aiService.bulkSearchWithProgress(
                CATEGORIES[bulkCategorySelected].name,
                bulkCategoryLimit,
                (progress) => {
                    // Update progress in real-time
                    setProgress(progress.percentage);
                    setLoadingMessage(progress.message);
                    
                    if (progress.phase === 'searching') {
                        addLog(`🔍 ${progress.message}`);
                    } else if (progress.phase === 'processing') {
                        setBulkProgress(prev => {
                            const newStatuses = [...prev.statuses];
                            // Ensure we have enough slots
                            while (newStatuses.length < progress.total) {
                                newStatuses.push('pending');
                            }
                            // Mark current as processing
                            if (progress.current > 0) {
                                newStatuses[progress.current - 1] = 'processing';
                            }
                            // Mark previous as success if we have a candidate
                            if (progress.candidate && progress.current > 1) {
                                newStatuses[progress.current - 2] = 'success';
                            }
                            return {
                                current: progress.current,
                                total: progress.total,
                                statuses: newStatuses
                            };
                        });
                    } else if (progress.error) {
                        addLog(`❌ ${progress.message}`);
                    }
                }
            );
            
            // Store abort function
            abortControllerRef.current = abort;
            
            // Wait for all products to be processed by server (SSE phase completes at 100%)
            const candidates = await promise;
            
            addLog(`✅ ${candidates.length} producten ontvangen van server`);
            
            // Reset progress for save phase - separate phase from SSE
            setProgress(0);
            setLoadingMessage('Producten voorbereiden voor bulk opslag...');
            
            // Collect all products first, then bulk insert
            const productsToAdd: Product[] = [];
            const skippedCount = { value: 0 };
            
            for (const [index, candidate] of candidates.entries()) {
                if (stopProcessRef.current) {
                    addLog(`⏹️ Import gestopt door gebruiker`);
                    showToast('Import gestopt', 'warning');
                    break;
                }

                // Update progress
                setProgress(Math.round((index / candidates.length) * 50));
                setBulkProgress(prev => ({
                    ...prev,
                    current: index + 1,
                    total: candidates.length,
                    statuses: prev.statuses.map((s, i) => i === index ? 'processing' : s)
                }));

                const exists = customProducts.find(p => p.ean === candidate.bolData.ean || p.model === candidate.aiData.model);
                if (exists) {
                    addLog(`- Bestaat al, overgeslagen: ${candidate.bolData.title.substring(0, 30)}...`);
                    skippedCount.value++;
                    setBulkProgress(prev => ({
                        ...prev,
                        statuses: prev.statuses.map((s, i) => i === index ? 'success' : s)
                    }));
                    continue;
                }

                const newProduct: Product = {
                    id: `bulk-cat-${Date.now()}-${index}-${Math.random()}`,
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
                    affiliateUrl: candidate.bolData.url,
                    ean: candidate.bolData.ean,
                    scoreBreakdown: candidate.aiData.scoreBreakdown,
                    suitability: candidate.aiData.suitability,
                    faq: candidate.aiData.faq,
                    predicate: candidate.aiData.predicate,
                    bolReviewsRaw: candidate.aiData.bolReviewsRaw
                };

                productsToAdd.push(newProduct);
                addLog(`✓ Voorbereid: ${newProduct.brand} ${newProduct.model}`);
                
                setBulkProgress(prev => ({
                    ...prev,
                    statuses: prev.statuses.map((s, i) => i === index ? 'success' : s)
                }));
            }

            // Bulk insert all products at once
            if (productsToAdd.length > 0 && !stopProcessRef.current) {
                setProgress(75);
                setLoadingMessage(`${productsToAdd.length} producten opslaan in database...`);
                addLog(`💾 ${productsToAdd.length} producten bulk opslaan...`);
                
                try {
                    await db.addBulk(productsToAdd);
                    setProgress(100);
                    addLog(`✅ ${productsToAdd.length} producten succesvol toegevoegd!`);
                } catch (bulkError) {
                    const errorMsg = bulkError instanceof Error ? bulkError.message : String(bulkError);
                    addLog(`❌ Bulk opslag mislukt: ${errorMsg}`);
                    addLog(`ℹ️ Probeer producten één voor één op te slaan...`);
                    
                    // Fallback: try to save one by one
                    let savedCount = 0;
                    for (const product of productsToAdd) {
                        try {
                            await onAddProduct(product);
                            savedCount++;
                        } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            addLog(`❌ Fout bij ${product.brand} ${product.model}: ${msg}`);
                        }
                    }
                    addLog(`✅ ${savedCount}/${productsToAdd.length} producten individueel opgeslagen`);
                }
            }

            setProgress(100);
            addLog(`🎉 Bulk Category Import Voltooid: ${productsToAdd.length} producten toegevoegd, ${skippedCount.value} overgeslagen`);
            showToast('Bulk category import voltooid!', 'success');
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            addLog(`❌ Fout: ${errorMsg}`);
            showToast(`Fout: ${errorMsg}`, 'error');
        } finally {
            setIsProcessing(false);
            setLoadingMessage('');
            abortControllerRef.current = null;
        }
    };
    
    const handleStopBulkImport = () => {
        stopProcessRef.current = true;
        if (abortControllerRef.current) {
            abortControllerRef.current();
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
        if (!importUrl.trim()) {
            showError('❌ Vul een Bol.com product URL in');
            return;
        }
        
        // Validate that it's a proper Bol.com URL with strict hostname check
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(importUrl);
        } catch {
            showError('❌ Gebruik een geldige URL');
            return;
        }
        
        const urlHost = parsedUrl.hostname.toLowerCase();
        // Check for exact match or subdomain of bol.com (e.g., www.bol.com)
        const isBolComDomain = urlHost === 'bol.com' || urlHost.match(/^[a-z0-9-]+\.bol\.com$/);
        if (!isBolComDomain) {
            showError('❌ Gebruik een geldige Bol.com product URL');
            return;
        }
        
        setIsProcessing(true);
        setEditingProduct(null);
        setImportStep(1);
        setLoadingMessage('Product ophalen...');
        addLog(`📥 Start import: ${importUrl}`);
        
        try {
            setImportStep(2);
            setLoadingMessage('AI analyse bezig...');
            addLog('🔄 Calling API...');
            
            const { bolData, aiData } = await aiService.importFromUrl(importUrl);
            
            addLog(`✅ Received data - Brand: ${aiData.brand}, Model: ${aiData.model}`);
            
            if (!bolData) {
                throw new Error('Bol.com data ontbreekt in server response');
            }
            if (!aiData) {
                throw new Error('AI analyse data ontbreekt in server response');
            }

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
            addLog('✅ Import succesvol!');
            showToast('✅ Product succesvol geïmporteerd!', 'success');
            
        } catch (e: any) {
            const errorMsg = e?.message || String(e);
            addLog(`❌ Import fout: ${errorMsg}`);
            console.error('❌ Full import error:', e);
            
            if (errorMsg.includes('credentials') || errorMsg.includes('geconfigureerd')) {
                showError('❌ Bol.com API niet geconfigureerd - controleer environment variabelen');
                addLog('💡 Tip: Check BOL_CLIENT_ID, BOL_CLIENT_SECRET en BOL_SITE_ID in Render');
            } else if (errorMsg.includes('404') || errorMsg.includes('niet gevonden')) {
                showError('❌ Product niet gevonden - controleer de URL');
            } else if (errorMsg.includes('timeout')) {
                showError('❌ Timeout - Bol.com reageert niet, probeer opnieuw');
            } else if (errorMsg.includes('401') || errorMsg.includes('403')) {
                showError('❌ Authenticatie fout - API credentials zijn mogelijk ongeldig');
                addLog('💡 Tip: Controleer of je API keys correct zijn in Render environment');
            } else {
                showError(`❌ Import mislukt: ${errorMsg}`);
            }
            
            setImportStep(1);
        } finally {
            setIsProcessing(false);
            setLoadingMessage('');
        }
    };

    const saveEditedProduct = async () => {
        if (!editingProduct) {
            showError('Geen product om op te slaan');
            return;
        }
        
        // Validate before saving
        const validation = validateProduct(editingProduct);
        setValidationResult(validation);
        
        if (!validation.isValid) {
            showError(`Validatie fouten:\n${validation.errors.join('\n')}`);
            return;
        }
        
        // Show warnings but allow saving
        if (validation.warnings.length > 0) {
            console.warn('Product warnings:', validation.warnings);
        }
        
        try {
            await onAddProduct(editingProduct as Product);
            setEditingProduct(null);
            setImportUrl('');
            setImportStep(1);
            setImportError(null);
            setValidationResult(null);
            showToast('Product succesvol toegevoegd!', 'success');
        } catch (e) {
            console.error('Save error:', e);
            const errorMsg = e instanceof Error ? e.message : (typeof e === 'object' ? JSON.stringify(e) : String(e));
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

            // Collect products first for bulk insert
            const productsToAdd: Product[] = [];

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
                            id: `auto-${Date.now()}-${index}-${Math.random()}`,
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
                        productsToAdd.push(newProduct);
                        addLog(`✓ Voorbereid: ${newProduct.brand} ${newProduct.model}`);
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : String(err);
                        addLog(`! Fout bij product: ${errorMsg}`);
                    }
                } else {
                    addLog(`- Product bestaat al, overgeslagen`);
                }
            }

            // Bulk insert all products at once
            if (productsToAdd.length > 0 && !stopProcessRef.current) {
                setLoadingMessage(`${productsToAdd.length} producten opslaan...`);
                addLog(`💾 ${productsToAdd.length} producten bulk opslaan...`);
                try {
                    await db.addBulk(productsToAdd);
                    addLog(`✅ ${productsToAdd.length} producten toegevoegd!`);
                } catch (bulkError) {
                    const errorMsg = bulkError instanceof Error ? bulkError.message : String(bulkError);
                    addLog(`❌ Bulk opslag mislukt: ${errorMsg}, probeer individueel...`);
                    // Fallback: save one by one
                    for (const product of productsToAdd) {
                        try {
                            await onAddProduct(product);
                            addLog(`✅ Product toegevoegd: ${product.brand} ${product.model}`);
                        } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            addLog(`! Fout bij ${product.brand} ${product.model}: ${msg}`);
                        }
                    }
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
                    const art = { ...guide, id: `art-${Date.now()}-G`, category: pilotCategory, type: 'guide', author: 'Redactie', date: new Date().toLocaleDateString(), created_at: new Date().toISOString() } as Article;
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
                    const art = { ...list, id: `art-${Date.now()}-L`, category: pilotCategory, type: 'list', author: 'Redactie', date: new Date().toLocaleDateString(), created_at: new Date().toISOString() } as Article;
                    const updated = await db.addArticle(art);
                    setArticles(updated);
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
        if (!generatedArticle?.title) {
            showError('Geen artikel om op te slaan');
            return;
        }
        
        try {
            const slug = generateArticleSlug({ title: generatedArticle.title, type: studioType } as Article);
            const art: Article = { 
                ...generatedArticle, 
                id: `art-${Date.now()}`, 
                slug,
                category: studioCategory, 
                type: studioType, 
                author: 'Redactie', 
                date: new Date().toLocaleDateString('nl-NL'), 
                created_at: new Date().toISOString(),
                // Ensure required fields have defaults
                summary: generatedArticle.summary || '',
                htmlContent: generatedArticle.htmlContent || ''
            } as Article;
            
            // Validate article before saving
            const validation = validateArticle(art);
            if (!validation.isValid) {
                showError(`Validatie fouten: ${validation.errors.join(', ')}`);
                return;
            }
            
            const updated = await db.addArticle(art);
            setArticles(updated);
            setGeneratedArticle(null);
            showToast('Artikel opgeslagen!', 'success');
        } catch (e) {
            console.error('Article save error:', e);
            // Handle different error types properly
            let errorMsg: string;
            if (e instanceof Error) {
                errorMsg = e.message;
            } else if (typeof e === 'object' && e !== null) {
                errorMsg = JSON.stringify(e);
            } else {
                errorMsg = String(e);
            }
            showError(`Fout bij opslaan: ${errorMsg}`);
        }
    };

    const handleDeleteArticle = async (id: string) => { 
        if(confirm('Artikel verwijderen?')) {
            const updated = await db.deleteArticle(id);
            setArticles(updated);
            showToast('Artikel verwijderd', 'info');
        }
    };
    
    const handleEditArticle = (article: Article) => {
        setEditingArticle({ ...article });
        setArticleSubTab('list');
    };
    
    const handleSaveEditedArticle = async () => {
        if (!editingArticle) return;
        try {
            // Generate slug if not present
            if (!editingArticle.slug) {
                editingArticle.slug = generateArticleSlug(editingArticle);
            }
            
            // Validate before saving
            const validation = validateArticle(editingArticle);
            if (!validation.isValid) {
                showError(`Validatie fouten: ${validation.errors.join(', ')}`);
                return;
            }
            
            const updated = await db.updateArticle(editingArticle);
            setArticles(updated);
            setEditingArticle(null);
            showToast('Artikel bijgewerkt!', 'success');
        } catch (e) {
            console.error('Article update error:', e);
            let errorMsg: string;
            if (e instanceof Error) {
                errorMsg = e.message;
            } else if (typeof e === 'object' && e !== null) {
                errorMsg = JSON.stringify(e);
            } else {
                errorMsg = String(e);
            }
            showError(`Fout bij bijwerken: ${errorMsg}`);
        }
    };
    
    const handleRewriteArticle = async (article: Article) => {
        if (!confirm('Weet je zeker dat je dit artikel wilt herschrijven met AI? De bestaande content wordt vervangen.')) return;
        
        setIsProcessing(true);
        setLoadingMessage('Artikel herschrijven met AI...');
        
        try {
            const result = await aiService.generateArticle(article.type, article.title, article.category);
            const updatedArticle: Article = {
                ...article,
                htmlContent: result.htmlContent || article.htmlContent,
                summary: result.summary || article.summary,
                lastUpdated: new Date().toISOString()
            };
            const updated = await db.updateArticle(updatedArticle);
            setArticles(updated);
            showToast('Artikel succesvol herschreven!', 'success');
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            showError(`Fout bij herschrijven: ${errorMsg}`);
        } finally {
            setIsProcessing(false);
            setLoadingMessage('');
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

    const filteredArticles = articles.filter(a => {
        if (!articleSearchTerm) return true;
        return a.title.toLowerCase().includes(articleSearchTerm.toLowerCase());
    });
    
    // Helper function for article type labels
    const getArticleTypeLabel = (type: ArticleType): string => {
        return ARTICLE_TYPE_LABELS[type] || type;
    };
    
    // Helper function to get article type color classes
    const getArticleTypeColorClasses = (type: ArticleType) => {
        return ARTICLE_TYPE_COLORS[type] || ARTICLE_TYPE_COLORS['informational'];
    };

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
                            { id: 'articles', icon: 'fa-newspaper', label: 'Artikelen', color: 'green' },
                            { id: 'affiliate', icon: 'fa-link', label: 'Affiliate', color: 'yellow' },
                            { id: 'automation', icon: 'fa-robot', label: 'Automation', color: 'cyan' },
                            { id: 'cms', icon: 'fa-sliders-h', label: 'CMS', color: 'orange' }
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
                                    <span className="ml-auto bg-slate-700 text-xs px-2 py-0.5 rounded-full">{articles.length}</span>
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
                                        <div className="text-3xl font-black text-white mb-1">{articles.length}</div>
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
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <button 
                                            onClick={() => { setActiveTab('products'); setProductSubTab('import'); }}
                                            className="p-4 bg-slate-800 hover:bg-blue-600/20 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all group"
                                        >
                                            <i className="fas fa-plus-circle text-2xl text-blue-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Bol.com Import</div>
                                        </button>
                                        <button 
                                            onClick={() => { setActiveTab('products'); setProductSubTab('url-import'); }}
                                            className="p-4 bg-slate-800 hover:bg-emerald-600/20 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-all group"
                                        >
                                            <i className="fas fa-link text-2xl text-emerald-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Via URL</div>
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
                                        <button 
                                            onClick={async () => {
                                                addLog('🔍 Testing Bol.com API connection...');
                                                try {
                                                    showToast('🔍 Testing API...', 'info');
                                                    const response = await fetch('/api/bol/search-list', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ term: 'wasmachine', limit: 1 })
                                                    });
                                                    
                                                    if (!response.ok) {
                                                        const errorData = await response.json();
                                                        throw new Error(errorData.error || `HTTP ${response.status}`);
                                                    }
                                                    
                                                    const data = await response.json();
                                                    addLog(`✅ API Response: ${JSON.stringify(data).substring(0, 200)}...`);
                                                    
                                                    if (data.products && data.products.length > 0) {
                                                        showToast('✅ Bol.com API werkt!', 'success');
                                                        addLog(`✅ Found ${data.products.length} products - API is working correctly`);
                                                    } else {
                                                        showError('⚠️ API werkt maar geen producten gevonden');
                                                        addLog('⚠️ API returned empty products array');
                                                    }
                                                } catch (e: any) {
                                                    const errorMsg = e?.message || String(e);
                                                    addLog(`❌ API Test failed: ${errorMsg}`);
                                                    showError(`❌ API test mislukt: ${errorMsg}`);
                                                    console.error('API test error:', e);
                                                }
                                            }}
                                            className="p-4 bg-slate-800 hover:bg-green-600/20 rounded-xl border border-slate-700 hover:border-green-500/50 transition-all group"
                                        >
                                            <i className="fas fa-plug text-2xl text-green-400 mb-2 group-hover:scale-110 transition-transform"></i>
                                            <div className="font-medium text-white text-sm">Test API</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Analytics Widget */}
                                <AnalyticsWidget products={customProducts} articles={articles} />

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
                                        { id: 'url-import', icon: 'fa-link', label: 'Via URL', color: 'emerald' },
                                        { id: 'import', icon: 'fa-magic', label: 'Bol.com Import', color: 'blue' },
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
                                
                                {/* 0. URL-BASED IMPORT (New Universal Method) */}
                                {productSubTab === 'url-import' && (
                                    <ProductGenerator 
                                        onSave={async (product) => {
                                            await onAddProduct(product);
                                            showToast('✅ Product succesvol toegevoegd!', 'success');
                                            addLog(`✅ Product toegevoegd via URL: ${product.brand} ${product.model}`);
                                            setProductSubTab('list');
                                        }}
                                        onCancel={() => setProductSubTab('list')}
                                    />
                                )}

                                {/* 1. SINGLE IMPORT with Search */}
                                {productSubTab === 'import' && (
                                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                        {/* Import Steps Header */}
                                        <div className="bg-slate-950 p-4 border-b border-slate-800">
                                            <div className="flex items-center justify-between mb-4">
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-search text-blue-400"></i> Product Toevoegen
                                                </h2>
                                            </div>
                                            {/* Step Indicator */}
                                            <div className="flex items-center gap-2">
                                                {[
                                                    { step: 1, label: 'Zoeken & Selecteren' },
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
                                                    {/* Import Mode Toggle */}
                                                    <div className="flex gap-2 mb-4">
                                                        <button
                                                            onClick={() => setImportMode('search')}
                                                            disabled={isProcessing}
                                                            className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                                                importMode === 'search'
                                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                            }`}
                                                        >
                                                            <i className="fas fa-search"></i>
                                                            <span>Zoeken op Bol.com</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setImportMode('url')}
                                                            disabled={isProcessing}
                                                            className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                                                                importMode === 'url'
                                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                                            }`}
                                                        >
                                                            <i className="fas fa-link"></i>
                                                            <span>Import via URL</span>
                                                        </button>
                                                    </div>

                                                    {/* SEARCH MODE */}
                                                    {importMode === 'search' && (
                                                        <div className="space-y-4">
                                                            {/* Search Input */}
                                                            <div>
                                                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                                                    <i className="fas fa-search mr-2"></i>Zoek producten op Bol.com
                                                                </label>
                                                                <div className="flex gap-3">
                                                                    <input 
                                                                        type="text" 
                                                                        value={searchQuery} 
                                                                        onChange={e => setSearchQuery(e.target.value)} 
                                                                        onKeyPress={e => e.key === 'Enter' && handleProductSearch()}
                                                                        placeholder="Bijv: Samsung wasmachine, LG OLED TV, Philips airfryer..." 
                                                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                                    />
                                                                    <button 
                                                                        onClick={handleProductSearch} 
                                                                        disabled={isSearching || !searchQuery.trim()}
                                                                        className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white px-6 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
                                                                    >
                                                                        {isSearching ? (
                                                                            <><i className="fas fa-spinner fa-spin"></i> Zoeken...</>
                                                                        ) : (
                                                                            <><i className="fas fa-search"></i> Zoeken</>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <p className="text-xs text-slate-500 mt-2">
                                                                    Tip: Zoek op productnaam, merk, of type product
                                                                </p>
                                                            </div>

                                                            {/* Search Error */}
                                                            {searchError && !isSearching && (
                                                                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                                                                    <i className="fas fa-exclamation-circle text-red-400"></i>
                                                                    <span className="text-red-300">{searchError}</span>
                                                                </div>
                                                            )}

                                                            {/* Search Results */}
                                                            {searchResults.length > 0 && (
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <h3 className="text-lg font-bold text-white">
                                                                            <i className="fas fa-list mr-2 text-blue-400"></i>
                                                                            {searchResults.length} producten gevonden
                                                                        </h3>
                                                                        <button 
                                                                            onClick={() => { setSearchResults([]); setSelectedSearchProduct(null); }}
                                                                            className="text-sm text-slate-400 hover:text-white transition"
                                                                        >
                                                                            <i className="fas fa-times mr-1"></i> Wissen
                                                                        </button>
                                                                    </div>

                                                                    {/* Product Grid */}
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto custom-scroll pr-2">
                                                                        {searchResults.map(product => (
                                                                            <div 
                                                                                key={product.ean}
                                                                                onClick={() => handleSelectSearchProduct(product)}
                                                                                className={`
                                                                                    relative p-4 rounded-xl border-2 cursor-pointer transition-all
                                                                                    ${selectedSearchProduct?.ean === product.ean 
                                                                                        ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20' 
                                                                                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                                                                                    }
                                                                                `}
                                                                            >
                                                                                {/* Selected indicator */}
                                                                                {selectedSearchProduct?.ean === product.ean && (
                                                                                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                                                                        <i className="fas fa-check text-white text-xs"></i>
                                                                                    </div>
                                                                                )}
                                                                                
                                                                                {/* Product Image */}
                                                                                <div className="bg-white rounded-lg p-2 mb-3 h-32 flex items-center justify-center">
                                                                                    <img 
                                                                                        src={product.image} 
                                                                                        alt={product.title}
                                                                                        className="max-w-full max-h-full object-contain"
                                                                                        referrerPolicy="no-referrer"
                                                                                    />
                                                                                </div>
                                                                                
                                                                                {/* Product Info */}
                                                                                <div className="space-y-2">
                                                                                    <div className="text-xs text-slate-500">{product.brand}</div>
                                                                                    <h4 className="text-sm font-medium text-white line-clamp-2 min-h-[2.5rem]">
                                                                                        {product.title}
                                                                                    </h4>
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-lg font-bold text-blue-400">
                                                                                            €{product.price != null ? product.price.toLocaleString('nl-NL', { minimumFractionDigits: 2 }) : '-.--'}
                                                                                        </span>
                                                                                        {product.available ? (
                                                                                            <span className="text-xs text-green-400 flex items-center gap-1">
                                                                                                <i className="fas fa-check-circle"></i> Beschikbaar
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-xs text-slate-500">Prijs onbekend</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Import Selected Button */}
                                                                    {selectedSearchProduct && (
                                                                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-4">
                                                                                    <img 
                                                                                        src={selectedSearchProduct.image}
                                                                                        alt={selectedSearchProduct.title}
                                                                                        className="w-16 h-16 object-contain bg-white rounded-lg"
                                                                                        referrerPolicy="no-referrer"
                                                                                    />
                                                                                    <div>
                                                                                        <div className="font-medium text-white">{selectedSearchProduct.title.substring(0, 50)}...</div>
                                                                                        <div className="text-sm text-blue-400">€{selectedSearchProduct.price?.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <button 
                                                                                    onClick={handleImportSelectedProduct}
                                                                                    disabled={isProcessing}
                                                                                    className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center gap-2 transition-all"
                                                                                >
                                                                                    {isProcessing ? (
                                                                                        <><i className="fas fa-spinner fa-spin"></i> Importeren...</>
                                                                                    ) : (
                                                                                        <><i className="fas fa-plus-circle"></i> Importeer dit product</>
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* No results message */}
                                                            {searchResults.length === 0 && !isSearching && !searchError && searchQuery && (
                                                                <div className="text-center py-8 text-slate-500">
                                                                    <i className="fas fa-search text-4xl mb-3"></i>
                                                                    <div>Klik op "Zoeken" om producten te vinden</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* URL MODE */}
                                                    {importMode === 'url' && (
                                                        <div className="space-y-4">
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
                                                        </div>
                                                    )}
                                                    
                                                    {/* Processing indicator */}
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
                                                    
                                                    {/* Import Error Display with Retry */}
                                                    {importError && !isProcessing && (
                                                        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 space-y-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-red-600/30 flex items-center justify-center flex-shrink-0">
                                                                    <i className="fas fa-exclamation-triangle text-red-400"></i>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-red-300">{importError.message}</div>
                                                                    {importError.troubleshooting && importError.troubleshooting.length > 0 && (
                                                                        <div className="mt-2 text-sm text-red-200/70">
                                                                            <div className="font-medium mb-1">Tips:</div>
                                                                            <ul className="list-disc list-inside space-y-0.5">
                                                                                {importError.troubleshooting.map((tip, idx) => (
                                                                                    <li key={idx}>{tip}</li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {importError.canRetry && (
                                                                <div className="flex gap-2 pt-2 border-t border-red-500/20">
                                                                    <button 
                                                                        onClick={handleSingleImport}
                                                                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                                                                    >
                                                                        <i className="fas fa-redo"></i> Opnieuw proberen
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setImportError(null)}
                                                                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                                    >
                                                                        Sluiten
                                                                    </button>
                                                                </div>
                                                            )}
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
                                                                onClick={handleStopBulkImport}
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
                                {/* Article Sub-Navigation */}
                                <div className="flex flex-wrap gap-2 mb-6 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                    {[
                                        { id: 'generate', icon: 'fa-magic', label: 'Genereren', color: 'green' },
                                        { id: 'list', icon: 'fa-list', label: `Artikelen (${articles.length})`, color: 'slate' }
                                    ].map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => { setArticleSubTab(sub.id as any); setEditingArticle(null); }}
                                            className={`
                                                flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all
                                                ${articleSubTab === sub.id 
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

                                {/* Article Generator */}
                                {articleSubTab === 'generate' && (
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
                                                        <div className="grid grid-cols-4 gap-3">
                                                            {[
                                                                { type: 'guide', icon: 'fa-book', label: 'Koopgids', desc: 'Complete gids' },
                                                                { type: 'list', icon: 'fa-list-ol', label: 'Toplijst', desc: 'Top 5/10 lijst' },
                                                                { type: 'comparison', icon: 'fa-balance-scale', label: 'Vergelijking', desc: 'A vs B' },
                                                                { type: 'informational', icon: 'fa-lightbulb', label: 'Informatief', desc: 'Algemeen artikel' }
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
                                                                className="article-preview"
                                                                dangerouslySetInnerHTML={{ __html: removeFirstH1FromHtml(generatedArticle.htmlContent) }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Stats - Right Panel */}
                                        <div className="xl:col-span-1">
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden sticky top-24 p-6">
                                                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                                    <i className="fas fa-chart-bar text-blue-400"></i> Statistieken
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400 text-sm">Totaal artikelen</span>
                                                        <span className="text-white font-bold">{articles.length}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400 text-sm">Koopgidsen</span>
                                                        <span className="text-blue-400 font-bold">{articles.filter(a => a.type === 'guide').length}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400 text-sm">Toplijsten</span>
                                                        <span className="text-purple-400 font-bold">{articles.filter(a => a.type === 'list').length}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400 text-sm">Vergelijkingen</span>
                                                        <span className="text-green-400 font-bold">{articles.filter(a => a.type === 'comparison').length}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400 text-sm">Informatief</span>
                                                        <span className="text-yellow-400 font-bold">{articles.filter(a => a.type === 'informational').length}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Article List with Editor */}
                                {articleSubTab === 'list' && (
                                    <div className="space-y-6">
                                        {/* Article Editor Modal */}
                                        {editingArticle && (
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-fade-in">
                                                <div className="bg-gradient-to-r from-blue-900/30 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
                                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                        <i className="fas fa-edit text-blue-400"></i> Artikel Bewerken
                                                    </h2>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={handleSaveEditedArticle}
                                                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                                                        >
                                                            <i className="fas fa-save"></i> Opslaan
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingArticle(null)}
                                                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                                        >
                                                            Annuleren
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-6 space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Titel</label>
                                                            <input 
                                                                type="text" 
                                                                value={editingArticle.title || ''} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, title: e.target.value})}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Type</label>
                                                            <select 
                                                                value={editingArticle.type} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, type: e.target.value as ArticleType})}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                                            >
                                                                <option value="comparison">Vergelijking</option>
                                                                <option value="list">Toplijst</option>
                                                                <option value="guide">Koopgids</option>
                                                                <option value="informational">Informatief</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Categorie</label>
                                                            <select 
                                                                value={editingArticle.category} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, category: e.target.value})}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition cursor-pointer"
                                                            >
                                                                {Object.entries(CATEGORIES).map(([k, v]) => (
                                                                    <option key={k} value={k}>{v.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Auteur</label>
                                                            <input 
                                                                type="text" 
                                                                value={editingArticle.author || ''} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, author: e.target.value})}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Samenvatting (30-40 woorden)</label>
                                                        <textarea 
                                                            value={editingArticle.summary || ''} 
                                                            onChange={(e) => setEditingArticle({...editingArticle, summary: e.target.value})}
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition h-24 resize-none"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Meta Description (max 160 karakters)</label>
                                                            <input 
                                                                type="text" 
                                                                value={editingArticle.metaDescription || ''} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, metaDescription: e.target.value.substring(0, 160)})}
                                                                maxLength={160}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                            <div className="text-xs text-slate-500 mt-1">{(editingArticle.metaDescription || '').length}/160</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Tags (komma-gescheiden)</label>
                                                            <input 
                                                                type="text" 
                                                                value={(editingArticle.tags || []).join(', ')} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)})}
                                                                placeholder="tag1, tag2, tag3"
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Afbeelding URL</label>
                                                            <input 
                                                                type="text" 
                                                                value={editingArticle.imageUrl || ''} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, imageUrl: e.target.value})}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Slug (auto-gegenereerd)</label>
                                                            <input 
                                                                type="text" 
                                                                value={editingArticle.slug || generateArticleSlug(editingArticle)} 
                                                                onChange={(e) => setEditingArticle({...editingArticle, slug: e.target.value})}
                                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">HTML Content</label>
                                                        <textarea 
                                                            value={editingArticle.htmlContent || ''} 
                                                            onChange={(e) => setEditingArticle({...editingArticle, htmlContent: e.target.value})}
                                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition h-64 resize-y font-mono text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Article List Table */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                            <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                        <i className="fas fa-newspaper text-green-400"></i> Alle Artikelen
                                                    </h2>
                                                    {/* Search */}
                                                    <div className="relative">
                                                        <input 
                                                            type="text"
                                                            value={articleSearchTerm}
                                                            onChange={e => setArticleSearchTerm(e.target.value)}
                                                            placeholder="Zoeken..."
                                                            className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-blue-500 w-48"
                                                        />
                                                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Table Header */}
                                            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-900/50 text-xs font-bold text-slate-500 uppercase border-b border-slate-800">
                                                <div className="col-span-4">Titel</div>
                                                <div className="col-span-2">Type</div>
                                                <div className="col-span-2">Categorie</div>
                                                <div className="col-span-2">Datum</div>
                                                <div className="col-span-2">Acties</div>
                                            </div>
                                            
                                            {/* Article List */}
                                            <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto custom-scroll">
                                                {filteredArticles.length === 0 ? (
                                                    <div className="p-12 text-center text-slate-500">
                                                        <i className="fas fa-newspaper text-4xl mb-3"></i>
                                                        <div>Geen artikelen gevonden</div>
                                                    </div>
                                                ) : (
                                                    filteredArticles.map(article => (
                                                        <div 
                                                            key={article.id} 
                                                            className="grid grid-cols-12 gap-4 px-4 py-4 items-center hover:bg-slate-800/50 transition"
                                                        >
                                                            <div className="col-span-12 md:col-span-4">
                                                                <div className="flex items-center gap-3">
                                                                    {article.imageUrl && (
                                                                        <img 
                                                                            src={article.imageUrl} 
                                                                            className="w-12 h-12 object-cover rounded-lg flex-shrink-0" 
                                                                        />
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <div className="font-medium text-white text-sm truncate">{article.title}</div>
                                                                        <div className="text-xs text-slate-500 md:hidden">
                                                                            {getArticleTypeLabel(article.type)} • {CATEGORIES[article.category]?.name}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="hidden md:block col-span-2">
                                                                <span className={`
                                                                    text-xs px-2 py-1 rounded
                                                                    ${getArticleTypeColorClasses(article.type).bg} ${getArticleTypeColorClasses(article.type).text}
                                                                `}>
                                                                    {getArticleTypeLabel(article.type)}
                                                                </span>
                                                            </div>
                                                            <div className="hidden md:block col-span-2 text-sm text-slate-400">
                                                                {CATEGORIES[article.category]?.name || article.category}
                                                            </div>
                                                            <div className="hidden md:block col-span-2 text-sm text-slate-400">
                                                                {article.date}
                                                                {article.lastUpdated && (
                                                                    <div className="text-xs text-green-400">
                                                                        <i className="fas fa-sync-alt mr-1"></i>
                                                                        {new Date(article.lastUpdated).toLocaleDateString('nl-NL')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="col-span-12 md:col-span-2 flex gap-2">
                                                                <button 
                                                                    onClick={() => handleEditArticle(article)}
                                                                    className="text-blue-400 hover:text-blue-300 transition p-2 bg-blue-600/10 rounded-lg"
                                                                    title="Bewerken"
                                                                >
                                                                    <i className="fas fa-edit"></i>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleRewriteArticle(article)}
                                                                    disabled={isProcessing}
                                                                    className="text-purple-400 hover:text-purple-300 transition p-2 bg-purple-600/10 rounded-lg disabled:opacity-50"
                                                                    title="Herschrijven met AI"
                                                                >
                                                                    <i className="fas fa-sync-alt"></i>
                                                                </button>
                                                                <button 
                                                                    onClick={() => window.open(`/artikelen/${article.slug || generateArticleSlug(article)}`, '_blank')}
                                                                    className="text-green-400 hover:text-green-300 transition p-2 bg-green-600/10 rounded-lg"
                                                                    title="Preview"
                                                                >
                                                                    <i className="fas fa-eye"></i>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteArticle(article.id)}
                                                                    className="text-red-400 hover:text-red-300 transition p-2 bg-red-600/10 rounded-lg"
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
                                    </div>
                                )}
                            </div>
                        )}

                        {/* === CMS TAB === */}
                        {activeTab === 'cms' && (
                            <div className="animate-fade-in">
                                <CMSDashboard />
                            </div>
                        )}

                        {/* === AFFILIATE TAB === */}
                        {activeTab === 'affiliate' && (
                            <div className="animate-fade-in">
                                {/* Affiliate Sub-Navigation */}
                                <div className="flex flex-wrap gap-2 mb-6 bg-slate-900 p-2 rounded-xl border border-slate-800">
                                    {[
                                        { id: 'networks', icon: 'fa-network-wired', label: 'Netwerken', color: 'yellow' },
                                        { id: 'stats', icon: 'fa-chart-bar', label: 'Statistieken', color: 'blue' },
                                        { id: 'analytics', icon: 'fa-chart-line', label: 'Analytics', color: 'green' }
                                    ].map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => setAffiliateSubTab(sub.id as any)}
                                            className={`
                                                flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all
                                                ${affiliateSubTab === sub.id 
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

                                {/* Networks Configuration */}
                                {affiliateSubTab === 'networks' && (
                                    <div className="space-y-6">
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                            <div className="bg-gradient-to-r from-yellow-900/30 to-slate-900 p-4 border-b border-slate-800">
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-network-wired text-yellow-400"></i> Affiliate Netwerk Configuratie
                                                </h2>
                                                <p className="text-sm text-slate-400 mt-1">Configureer hier je affiliate ID's voor elk netwerk</p>
                                            </div>
                                            
                                            <div className="p-6 space-y-4">
                                                {affiliateConfig.networks.map((network) => (
                                                    <div 
                                                        key={network.networkId}
                                                        className={`bg-slate-950 border rounded-xl p-4 ${network.enabled ? 'border-green-500/30' : 'border-slate-700'}`}
                                                    >
                                                        <div className="flex items-start gap-4">
                                                            {/* Network Icon */}
                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                                network.enabled ? 'bg-green-600/20' : 'bg-slate-800'
                                                            }`}>
                                                                <i className={`fas ${
                                                                    network.networkId === 'bol' ? 'fa-shopping-bag' :
                                                                    network.networkId === 'tradetracker' ? 'fa-exchange-alt' :
                                                                    network.networkId === 'daisycon' ? 'fa-flower' :
                                                                    network.networkId === 'awin' ? 'fa-globe' :
                                                                    network.networkId === 'paypro' ? 'fa-credit-card' :
                                                                    'fa-plug'
                                                                } text-xl ${network.enabled ? 'text-green-400' : 'text-slate-500'}`}></i>
                                                            </div>
                                                            
                                                            {/* Network Info */}
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h3 className="font-bold text-white">{network.name}</h3>
                                                                    {network.enabled && network.affiliateId && (
                                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-600/20 text-green-400">
                                                                            Actief
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500 mb-3">{network.notes}</p>
                                                                
                                                                {/* Affiliate ID Input */}
                                                                <div className="flex gap-3">
                                                                    <div className="flex-1">
                                                                        <label className="block text-xs font-medium text-slate-400 mb-1">
                                                                            Affiliate / Partner ID
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={network.affiliateId}
                                                                            onChange={(e) => {
                                                                                const updated = updateNetworkConfig(network.networkId, { 
                                                                                    affiliateId: e.target.value 
                                                                                });
                                                                                setAffiliateConfig(updated);
                                                                            }}
                                                                            placeholder={`Vul je ${network.name} ID in...`}
                                                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-yellow-500 transition"
                                                                        />
                                                                    </div>
                                                                    
                                                                    {/* Enable Toggle */}
                                                                    <div className="flex flex-col items-center">
                                                                        <label className="block text-xs font-medium text-slate-400 mb-1">
                                                                            Actief
                                                                        </label>
                                                                        <button
                                                                            onClick={() => {
                                                                                const updated = updateNetworkConfig(network.networkId, { 
                                                                                    enabled: !network.enabled 
                                                                                });
                                                                                setAffiliateConfig(updated);
                                                                            }}
                                                                            disabled={!network.affiliateId}
                                                                            className={`w-12 h-8 rounded-full transition-all ${
                                                                                network.enabled && network.affiliateId
                                                                                    ? 'bg-green-600' 
                                                                                    : 'bg-slate-700'
                                                                            } ${!network.affiliateId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                        >
                                                                            <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                                                                                network.enabled && network.affiliateId ? 'translate-x-5' : 'translate-x-1'
                                                                            }`}></div>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Info Box */}
                                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <i className="fas fa-info-circle text-blue-400 mt-0.5"></i>
                                                <div>
                                                    <h4 className="font-medium text-blue-300 mb-1">Hoe werkt dit?</h4>
                                                    <p className="text-sm text-blue-200/70">
                                                        Vul je affiliate ID's in voor elk netwerk. Wanneer een netwerk actief is, worden product links 
                                                        automatisch voorzien van je affiliate tracking code. Klik op de toggle om een netwerk te activeren of deactiveren.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Statistics */}
                                {affiliateSubTab === 'stats' && (
                                    <div className="space-y-6">
                                        {/* Overview Stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 p-6 rounded-2xl border border-blue-500/30">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-blue-600/30 flex items-center justify-center">
                                                        <i className="fas fa-mouse-pointer text-blue-400 text-xl"></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-white">{getTotalStats().clicks}</div>
                                                        <div className="text-sm text-blue-400">Totaal Clicks</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-br from-green-600/20 to-green-900/20 p-6 rounded-2xl border border-green-500/30">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-green-600/30 flex items-center justify-center">
                                                        <i className="fas fa-check-circle text-green-400 text-xl"></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-white">{getTotalStats().conversions}</div>
                                                        <div className="text-sm text-green-400">Conversies</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-900/20 p-6 rounded-2xl border border-yellow-500/30">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-yellow-600/30 flex items-center justify-center">
                                                        <i className="fas fa-euro-sign text-yellow-400 text-xl"></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-white">€{getTotalStats().earnings.toFixed(2)}</div>
                                                        <div className="text-sm text-yellow-400">Verdiensten</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Per Network Stats */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                            <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-chart-pie text-blue-400"></i> Statistieken per Netwerk
                                                </h2>
                                            </div>
                                            <div className="p-4">
                                                <div className="space-y-3">
                                                    {(() => {
                                                        const networkStats = getNetworkStats();
                                                        return affiliateConfig.networks
                                                            .filter(n => n.enabled)
                                                            .map(network => {
                                                                const stats = networkStats[network.networkId] || { clicks: 0, conversions: 0, earnings: 0 };
                                                                return (
                                                                    <div key={network.networkId} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                                                                                    <i className={`fas ${
                                                                                        network.networkId === 'bol' ? 'fa-shopping-bag' :
                                                                                        network.networkId === 'tradetracker' ? 'fa-exchange-alt' :
                                                                                        network.networkId === 'daisycon' ? 'fa-flower' :
                                                                                        network.networkId === 'awin' ? 'fa-globe' :
                                                                                        network.networkId === 'paypro' ? 'fa-credit-card' :
                                                                                        'fa-plug'
                                                                                    } text-slate-400`}></i>
                                                                                </div>
                                                                                <div>
                                                                                    <div className="font-medium text-white">{network.name}</div>
                                                                                    <div className="text-xs text-slate-500">ID: {network.affiliateId}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-6 text-sm">
                                                                                <div className="text-center">
                                                                                    <div className="font-bold text-blue-400">{stats.clicks}</div>
                                                                                    <div className="text-xs text-slate-500">Clicks</div>
                                                                                </div>
                                                                                <div className="text-center">
                                                                                    <div className="font-bold text-green-400">{stats.conversions}</div>
                                                                                    <div className="text-xs text-slate-500">Conversies</div>
                                                                                </div>
                                                                                <div className="text-center">
                                                                                    <div className="font-bold text-yellow-400">€{stats.earnings.toFixed(2)}</div>
                                                                                    <div className="text-xs text-slate-500">Verdiensten</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            });
                                                    })()}
                                                    
                                                    {affiliateConfig.networks.filter(n => n.enabled).length === 0 && (
                                                        <div className="text-center py-8 text-slate-500">
                                                            <i className="fas fa-info-circle text-2xl mb-2"></i>
                                                            <p>Geen actieve netwerken. Configureer eerst je affiliate ID's.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top Products */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                            <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-fire text-orange-400"></i> Top Producten
                                                </h2>
                                            </div>
                                            <div className="p-4">
                                                {(() => {
                                                    const topProducts = getAffiliateTopProducts(5);
                                                    if (topProducts.length === 0) {
                                                        return (
                                                            <div className="text-center py-8 text-slate-500">
                                                                <i className="fas fa-chart-bar text-2xl mb-2"></i>
                                                                <p>Nog geen click data beschikbaar.</p>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div className="space-y-2">
                                                            {topProducts.map((product, index) => (
                                                                <div key={product.productId} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                                                        index === 0 ? 'bg-yellow-600/30 text-yellow-400' :
                                                                        index === 1 ? 'bg-slate-600/30 text-slate-300' :
                                                                        index === 2 ? 'bg-orange-600/30 text-orange-400' :
                                                                        'bg-slate-800 text-slate-500'
                                                                    }`}>
                                                                        {index + 1}
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="font-medium text-white text-sm truncate">
                                                                            {product.productName || product.productId}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-sm font-bold text-blue-400">{product.clicks} clicks</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Analytics */}
                                {affiliateSubTab === 'analytics' && (
                                    <div className="space-y-6">
                                        {/* Daily Chart */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                            <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                    <i className="fas fa-chart-line text-green-400"></i> Clicks & Conversies (30 dagen)
                                                </h2>
                                            </div>
                                            <div className="p-4">
                                                {(() => {
                                                    const dailyStats = getDailyStats(30);
                                                    const maxClicks = Math.max(...dailyStats.map(d => d.clicks), 1);
                                                    
                                                    return (
                                                        <div className="h-48 flex items-end gap-1">
                                                            {dailyStats.map((day, index) => (
                                                                <div 
                                                                    key={day.date} 
                                                                    className="flex-1 flex flex-col items-center gap-1"
                                                                    title={`${day.date}: ${day.clicks} clicks, ${day.conversions} conversies`}
                                                                >
                                                                    <div 
                                                                        className="w-full bg-blue-600/50 rounded-t transition-all hover:bg-blue-500"
                                                                        style={{ height: `${(day.clicks / maxClicks) * 100}%`, minHeight: day.clicks > 0 ? '4px' : '0' }}
                                                                    ></div>
                                                                    {day.conversions > 0 && (
                                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                                <div className="flex justify-between mt-2 text-xs text-slate-500">
                                                    <span>30 dagen geleden</span>
                                                    <span>Vandaag</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recent Activity */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Recent Clicks */}
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                                <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                        <i className="fas fa-mouse-pointer text-blue-400"></i> Recente Clicks
                                                    </h2>
                                                </div>
                                                <div className="p-4 max-h-64 overflow-y-auto custom-scroll">
                                                    {(() => {
                                                        const recentClicks = getRecentClicks(10);
                                                        if (recentClicks.length === 0) {
                                                            return (
                                                                <div className="text-center py-8 text-slate-500">
                                                                    <p>Nog geen clicks geregistreerd.</p>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div className="space-y-2">
                                                                {recentClicks.map(click => (
                                                                    <div key={click.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm">
                                                                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                                                            <i className="fas fa-mouse-pointer text-blue-400 text-xs"></i>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="font-medium text-white truncate">
                                                                                {click.productName || click.productId}
                                                                            </div>
                                                                            <div className="text-xs text-slate-500">{click.networkId}</div>
                                                                        </div>
                                                                        <div className="text-xs text-slate-400">
                                                                            {new Date(click.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Recent Conversions */}
                                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                                                <div className="bg-slate-950 p-4 border-b border-slate-800">
                                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                        <i className="fas fa-check-circle text-green-400"></i> Recente Conversies
                                                    </h2>
                                                </div>
                                                <div className="p-4 max-h-64 overflow-y-auto custom-scroll">
                                                    {(() => {
                                                        const recentConversions = getRecentConversions(10);
                                                        if (recentConversions.length === 0) {
                                                            return (
                                                                <div className="text-center py-8 text-slate-500">
                                                                    <p>Nog geen conversies geregistreerd.</p>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div className="space-y-2">
                                                                {recentConversions.map(conversion => (
                                                                    <div key={conversion.id} className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm">
                                                                        <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center">
                                                                            <i className="fas fa-check text-green-400 text-xs"></i>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="font-medium text-white truncate">
                                                                                {conversion.productName || conversion.productId}
                                                                            </div>
                                                                            <div className="text-xs text-slate-500">{conversion.networkId}</div>
                                                                        </div>
                                                                        <div className="text-sm font-bold text-green-400">
                                                                            €{conversion.amount.toFixed(2)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Export & Clear Data */}
                                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                            <div className="flex flex-wrap gap-3">
                                                <button
                                                    onClick={() => {
                                                        const data = exportAllData();
                                                        const blob = new Blob([data], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `affiliate-data-${new Date().toISOString().split('T')[0]}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                        showToast('Data geëxporteerd!', 'success');
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition"
                                                >
                                                    <i className="fas fa-download"></i> Exporteer Data
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Weet je zeker dat je alle tracking data wilt wissen? Dit kan niet ongedaan worden gemaakt.')) {
                                                            clearTrackingData();
                                                            setAffiliateConfig(loadAffiliateConfig());
                                                            showToast('Tracking data gewist', 'info');
                                                        }
                                                    }}
                                                    className="bg-red-600/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-red-600/30 transition"
                                                >
                                                    <i className="fas fa-trash"></i> Wis Tracking Data
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* === AUTOMATION TAB === */}
                        {activeTab === 'automation' && (
                            <AutomationTab showToast={showToast} />
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
                .animate-fade-in { animation: fadeIn 0.3s ease-in; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                /* Article Preview Styling */
                .article-preview h1 {
                    /* Fallback styling in case H1 is not removed programmatically */
                    font-size: 2rem;
                    font-weight: 800;
                    color: white;
                    margin-bottom: 1.5rem;
                    line-height: 1.2;
                }
                
                .article-preview h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: white;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                    border-bottom: 2px solid #1e40af;
                    padding-bottom: 0.5rem;
                }
                
                .article-preview h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: #e2e8f0;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                }
                
                .article-preview p {
                    color: #cbd5e1;
                    line-height: 1.7;
                    margin-bottom: 1rem;
                }
                
                .article-preview strong {
                    color: white;
                    font-weight: 600;
                }
                
                .article-preview ul, .article-preview ol {
                    color: #cbd5e1;
                    margin-left: 1.5rem;
                    margin-bottom: 1rem;
                }
                
                .article-preview ul {
                    list-style-type: disc;
                }
                
                .article-preview ol {
                    list-style-type: decimal;
                }
                
                .article-preview li {
                    margin-bottom: 0.5rem;
                    line-height: 1.6;
                }
                
                .article-preview blockquote {
                    border-left: 4px solid #3b82f6;
                    font-style: italic;
                    color: #94a3b8;
                    margin: 1.5rem 0;
                    background: rgba(59, 130, 246, 0.1);
                    padding: 1rem 1rem 1rem 1.5rem;
                    border-radius: 0.5rem;
                }
                
                .article-preview table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1.5rem 0;
                    border: 1px solid #334155;
                }
                
                .article-preview thead {
                    background: #1e293b;
                }
                
                .article-preview th {
                    border: 1px solid #334155;
                    padding: 0.75rem 1rem;
                    text-align: left;
                    font-weight: 600;
                    color: white;
                }
                
                .article-preview td {
                    border: 1px solid #334155;
                    padding: 0.75rem 1rem;
                    color: #cbd5e1;
                }
                
                .article-preview tbody tr:hover {
                    background: rgba(59, 130, 246, 0.1);
                }
                
                .article-preview figure {
                    margin: 1.5rem 0;
                }
                
                .article-preview figure img {
                    width: 100%;
                    border-radius: 0.5rem;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
                }
                
                .article-preview figcaption {
                    font-size: 0.875rem;
                    color: #94a3b8;
                    text-align: center;
                    margin-top: 0.5rem;
                }
            `}</style>
        </div>
    );
};

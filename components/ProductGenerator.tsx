/**
 * ProductGenerator Component
 * UI for adding products via URL - scrapes product pages and generates AI reviews
 * Supports both single URL and bulk import modes
 * Based on Writgo.nl-nieuw ToolGenerator, adapted for ProductPraat
 */

import React, { useState, useRef } from 'react';
import { Product, CATEGORIES, BulkImportResult, BulkImportProgress } from '../types';
import { scrapeURL, detectShop } from '../services/scraper';
import { generateProductReview } from '../services/claudeService';

interface ProductGeneratorProps {
  onSave: (product: Product) => Promise<void>;
  onCancel: () => void;
}

type ProcessingStep = 'idle' | 'scraping' | 'analyzing' | 'complete';
type ImportMode = 'single' | 'bulk';

/**
 * Helper function to safely check if a hostname matches a domain.
 * Matches exact domain or subdomains (e.g., 'www.bol.com' matches 'bol.com').
 * Does not match if the domain is embedded (e.g., 'evilbol.com' does not match 'bol.com').
 */
const isHostnameMatch = (hostname: string, domain: string): boolean => {
  return hostname === domain || hostname.endsWith('.' + domain);
};

/**
 * Helper function to get store name from URL for display.
 * Uses secure hostname matching to prevent subdomain confusion attacks.
 */
export const getStoreName = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (isHostnameMatch(hostname, 'bol.com')) return 'Bol.com';
    if (isHostnameMatch(hostname, 'amazon.nl') || isHostnameMatch(hostname, 'amazon.de') || 
        isHostnameMatch(hostname, 'amazon.com') || isHostnameMatch(hostname, 'amazon.co.uk')) return 'Amazon';
    if (isHostnameMatch(hostname, 'coolblue.nl') || isHostnameMatch(hostname, 'coolblue.be')) return 'Coolblue';
    if (isHostnameMatch(hostname, 'mediamarkt.nl') || isHostnameMatch(hostname, 'mediamarkt.de')) return 'MediaMarkt';
    if (isHostnameMatch(hostname, 'wehkamp.nl')) return 'Wehkamp';
    if (isHostnameMatch(hostname, 'zalando.nl') || isHostnameMatch(hostname, 'zalando.de')) return 'Zalando';
    if (isHostnameMatch(hostname, 'fonq.nl')) return 'Fonq';
    if (isHostnameMatch(hostname, 'blokker.nl')) return 'Blokker';
    if (isHostnameMatch(hostname, 'aliexpress.com')) return 'AliExpress';
    // Return formatted domain name if not recognized
    return hostname.replace('www.', '').split('.')[0].charAt(0).toUpperCase() + 
           hostname.replace('www.', '').split('.')[0].slice(1);
  } catch {
    return 'de webshop';
  }
};

/**
 * Rate limiting delay between bulk imports (in ms).
 * This helps respect API limits and prevents overwhelming servers.
 */
const BULK_IMPORT_DELAY_MS = 2000;

/**
 * Validates and extracts URLs from a multi-line text input.
 * Returns only valid HTTP/HTTPS URLs.
 */
const parseUrlsFromText = (text: string): string[] => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      try {
        const url = new URL(line);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    });
};

export const ProductGenerator: React.FC<ProductGeneratorProps> = ({ onSave, onCancel }) => {
  // Single URL mode state
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedProduct, setGeneratedProduct] = useState<Product | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [detectedShop, setDetectedShop] = useState<string>('');
  
  // Import mode toggle
  const [importMode, setImportMode] = useState<ImportMode>('single');
  
  // Bulk import state
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkProgress, setBulkProgress] = useState<BulkImportProgress>({ current: 0, total: 0, status: 'idle' });
  const [bulkResults, setBulkResults] = useState<BulkImportResult | null>(null);
  const stopBulkRef = useRef(false);
  
  // Affiliate link editing
  const [editingAffiliateLink, setEditingAffiliateLink] = useState(false);

  const handleAutomaticGenerate = async () => {
    if (!url.trim()) {
      setError('Vul eerst een URL in');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      setError('Vul een geldige URL in (beginnend met https://)');
      return;
    }

    setIsGenerating(true);
    setGeneratedProduct(null);
    setError(null);
    setProcessingStep('scraping');
    setDetectedShop(detectShop(url));

    try {
      // Step 1: Scrape the URL
      const scrapedContent = await scrapeURL(url);
      
      // Step 2: Analyze with AI
      setProcessingStep('analyzing');
      const contentToAnalyze = scrapedContent.text.trim() ? scrapedContent.text : scrapedContent.html;
      
      const product = await generateProductReview({
        url,
        scrapedContent: contentToAnalyze,
        title: scrapedContent.title,
        description: scrapedContent.description,
        images: scrapedContent.images,
        price: scrapedContent.price
      });
      
      if (!product) {
        throw new Error('AI kon geen review genereren. Controleer of de VITE_ANTHROPIC_API_KEY is geconfigureerd.');
      }
      
      // Step 3: Complete
      setProcessingStep('complete');
      setGeneratedProduct(product);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Er ging iets mis bij het ophalen van de pagina.';
      setError(errorMessage);
      setShowManualInput(true);
    } finally {
      setIsGenerating(false);
      setProcessingStep('idle');
    }
  };

  const handleManualGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setIsGenerating(true);
    setGeneratedProduct(null);
    setError(null);
    setProcessingStep('analyzing');

    try {
      const product = await generateProductReview({
        url: url || 'https://example.com',
        scrapedContent: rawText
      });
      
      if (!product) {
        throw new Error('AI kon geen review genereren. Controleer of de VITE_ANTHROPIC_API_KEY is geconfigureerd.');
      }
      
      setProcessingStep('complete');
      setGeneratedProduct(product);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Kon de gegevens niet analyseren.';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
      setProcessingStep('idle');
    }
  };

  const handleSaveProduct = async () => {
    if (!generatedProduct) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await onSave(generatedProduct);
      
      // Success! Reset UI and show success state
      setGeneratedProduct(null);
      setUrl('');
      setRawText('');
      setShowManualInput(false);
      setError(null);
      
      // The parent component (AdminPanel) will show a toast notification
      // via the onSave callback, so we just need to reset our local state
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Opslaan mislukt';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle bulk import of multiple URLs
   * Processes URLs one by one with rate limiting
   */
  const handleBulkImport = async () => {
    const urls = parseUrlsFromText(bulkUrls);
    
    if (urls.length === 0) {
      setError('Voer minimaal één geldige URL in (beginnend met http:// of https://)');
      return;
    }
    
    setIsGenerating(true);
    stopBulkRef.current = false;
    setBulkProgress({ current: 0, total: urls.length, status: 'idle' });
    setBulkResults({ successful: [], failed: [] });
    setError(null);
    
    const results: BulkImportResult = {
      successful: [],
      failed: []
    };
    
    for (let i = 0; i < urls.length; i++) {
      // Check if stopped
      if (stopBulkRef.current) {
        break;
      }
      
      const currentUrl = urls[i];
      setBulkProgress({ 
        current: i + 1, 
        total: urls.length, 
        status: 'scraping',
        currentUrl,
        message: `URL aan het ophalen...`
      });
      
      try {
        // Step 1: Scrape
        const scrapedContent = await scrapeURL(currentUrl);
        
        setBulkProgress(prev => ({
          ...prev,
          status: 'analyzing',
          message: `Product analyseren met AI...`
        }));
        
        // Step 2: Generate review
        const contentToAnalyze = scrapedContent.text.trim() ? scrapedContent.text : scrapedContent.html;
        const product = await generateProductReview({
          url: currentUrl,
          scrapedContent: contentToAnalyze,
          title: scrapedContent.title,
          description: scrapedContent.description,
          images: scrapedContent.images,
          price: scrapedContent.price
        });
        
        if (!product) {
          throw new Error('AI kon geen review genereren');
        }
        
        // Step 3: Save immediately
        setBulkProgress(prev => ({
          ...prev,
          status: 'saving',
          message: `Product opslaan...`
        }));
        
        await onSave(product);
        results.successful.push(product);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Onbekende fout';
        results.failed.push({ url: currentUrl, error: errorMessage });
      }
      
      // Rate limiting: wait between requests (but not after the last one)
      if (i < urls.length - 1 && !stopBulkRef.current) {
        setBulkProgress(prev => ({
          ...prev,
          status: 'idle',
          message: `Even wachten... (rate limiting)`
        }));
        await new Promise(resolve => setTimeout(resolve, BULK_IMPORT_DELAY_MS));
      }
    }
    
    setBulkProgress({ current: urls.length, total: urls.length, status: 'complete' });
    setBulkResults(results);
    setIsGenerating(false);
  };
  
  const handleStopBulkImport = () => {
    stopBulkRef.current = true;
    setBulkProgress(prev => ({ ...prev, status: 'idle', message: 'Gestopt door gebruiker' }));
  };
  
  const handleRetryFailed = () => {
    if (!bulkResults?.failed.length) return;
    const failedUrls = bulkResults.failed.map(f => f.url).join('\n');
    setBulkUrls(failedUrls);
    setBulkResults(null);
    setBulkProgress({ current: 0, total: 0, status: 'idle' });
  };

  const handleEditField = (field: keyof Product, value: string | number) => {
    if (!generatedProduct) return;
    setGeneratedProduct({
      ...generatedProduct,
      [field]: value
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900/30 to-slate-900 p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-link"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nieuw Product via Link</h2>
              <p className="text-sm text-slate-400">Plak een product URL en genereer automatisch een review</p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-2 transition"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      <div className="p-6">
        {!generatedProduct && !bulkResults ? (
          <div className="space-y-6">
            {/* Import Mode Toggle */}
            <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl">
              <button
                onClick={() => setImportMode('single')}
                disabled={isGenerating}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  importMode === 'single'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-link"></i>
                <span>Enkele URL</span>
              </button>
              <button
                onClick={() => setImportMode('bulk')}
                disabled={isGenerating}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  importMode === 'bulk'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-white'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className="fas fa-layer-group"></i>
                <span>Bulk Import</span>
                <span className="text-xs bg-purple-500/30 px-1.5 py-0.5 rounded">Nieuw</span>
              </button>
            </div>
            
            {/* Supported shops info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <i className="fas fa-store text-green-400"></i>
                <span className="text-sm font-medium text-slate-300">Ondersteunde Webshops</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Bol.com', 'Amazon', 'Coolblue', 'MediaMarkt', 'Wehkamp', 'AliExpress', 'Andere webshops'].map(shop => (
                  <span key={shop} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                    ✅ {shop}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                <i className="fas fa-info-circle mr-1"></i>
                De ingevoerde URL wordt als affiliate link gebruikt voor alle "Bekijk product" knoppen.
              </p>
            </div>

            {/* === SINGLE URL MODE === */}
            {importMode === 'single' && (
              <>
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Product URL <span className="text-green-400">*</span>
                  </label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                    if (e.target.value) {
                      setDetectedShop(detectShop(e.target.value));
                    }
                  }}
                  placeholder="https://www.bol.com/nl/p/product-naam/..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 pr-24 text-white focus:border-green-500 focus:outline-none transition placeholder-slate-600"
                />
                {detectedShop && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">
                    {detectedShop}
                  </span>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                <div className="flex items-start gap-2">
                  <i className="fas fa-exclamation-circle mt-0.5"></i>
                  <div>
                    <strong>Fout:</strong> {error}
                  </div>
                </div>
              </div>
            )}

            {/* Processing Steps Indicator */}
            {isGenerating && (
              <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-6">
                <div className="space-y-4">
                  <div className={`flex items-center ${processingStep === 'scraping' ? 'text-green-400' : processingStep === 'idle' ? 'text-slate-600' : 'text-green-400'}`}>
                    {processingStep === 'scraping' ? (
                      <i className="fas fa-circle-notch fa-spin mr-3 text-xl"></i>
                    ) : processingStep === 'idle' ? (
                      <i className="fas fa-circle mr-3"></i>
                    ) : (
                      <i className="fas fa-check-circle mr-3 text-xl"></i>
                    )}
                    <span className="font-medium">🔍 URL aan het ophalen...</span>
                  </div>
                  <div className={`flex items-center ${processingStep === 'analyzing' ? 'text-green-400' : processingStep === 'complete' ? 'text-green-400' : 'text-slate-600'}`}>
                    {processingStep === 'analyzing' ? (
                      <i className="fas fa-circle-notch fa-spin mr-3 text-xl"></i>
                    ) : processingStep === 'complete' ? (
                      <i className="fas fa-check-circle mr-3 text-xl"></i>
                    ) : (
                      <i className="fas fa-circle mr-3"></i>
                    )}
                    <span className="font-medium">🤖 Product aan het analyseren...</span>
                  </div>
                  <div className={`flex items-center ${processingStep === 'complete' ? 'text-green-400' : 'text-slate-600'}`}>
                    {processingStep === 'complete' ? (
                      <i className="fas fa-check-circle mr-3 text-xl"></i>
                    ) : (
                      <i className="fas fa-circle mr-3"></i>
                    )}
                    <span className="font-medium">✅ Review gegenereerd!</span>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Input Section */}
            {showManualInput && (
              <form onSubmit={handleManualGenerate} className="space-y-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <i className="fas fa-keyboard mr-1"></i> Plak de inhoud van de pagina handmatig
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    <strong>Tip:</strong> Kopieer de productpagina tekst of HTML source (Ctrl+A, Ctrl+C op de site).
                  </p>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Plak hier de tekst of HTML source van de productpagina..."
                    className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:border-green-500 focus:outline-none transition placeholder-slate-600 font-mono text-sm"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isGenerating || !rawText.trim()}
                  className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center"
                >
                  {isGenerating ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin mr-2"></i>
                      Analyseren...
                    </>
                  ) : (
                    <>
                      Verwerk Handmatig met AI <i className="fas fa-robot ml-2"></i>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Main action buttons */}
            {!showManualInput && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAutomaticGenerate}
                  disabled={isGenerating || !url.trim()}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-600/20 flex items-center justify-center"
                >
                  {isGenerating ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin mr-2"></i>
                      Bezig met analyseren...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-magic mr-2"></i>
                      Analyseer Product
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  disabled={isGenerating}
                  className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium py-3 rounded-xl transition-all flex items-center justify-center text-sm"
                >
                  <i className="fas fa-keyboard mr-2"></i>
                  Of plak content handmatig
                </button>
              </div>
            )}
              </>
            )}

            {/* === BULK IMPORT MODE === */}
            {importMode === 'bulk' && (
              <>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-info-circle text-purple-400"></i>
                    <span className="text-sm font-medium text-purple-300">Bulk Import</span>
                  </div>
                  <p className="text-xs text-purple-200/70">
                    Importeer meerdere producten tegelijk. Plak één URL per regel. Elk product wordt automatisch geanalyseerd en opgeslagen.
                    Er wordt 2 seconden gewacht tussen elk product om API-limits te respecteren.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Product URLs (één per regel) <span className="text-purple-400">*</span>
                  </label>
                  <textarea
                    value={bulkUrls}
                    onChange={(e) => {
                      setBulkUrls(e.target.value);
                      setError(null);
                    }}
                    disabled={isGenerating}
                    placeholder="https://www.bol.com/nl/p/product-1/...&#10;https://www.amazon.nl/dp/...&#10;https://www.coolblue.nl/product/..."
                    className="w-full h-48 bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:border-purple-500 focus:outline-none transition placeholder-slate-600 font-mono text-sm disabled:opacity-50"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    {parseUrlsFromText(bulkUrls).length} geldige URLs gevonden
                  </div>
                </div>
                
                {/* Error message */}
                {error && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                    <div className="flex items-start gap-2">
                      <i className="fas fa-exclamation-circle mt-0.5"></i>
                      <div><strong>Fout:</strong> {error}</div>
                    </div>
                  </div>
                )}
                
                {/* Bulk Progress */}
                {isGenerating && bulkProgress.total > 0 && (
                  <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium">
                        Product {bulkProgress.current} van {bulkProgress.total}
                      </span>
                      <span className="text-purple-400 font-bold">
                        {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                      </span>
                    </div>
                    
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-500"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      ></div>
                    </div>
                    
                    {bulkProgress.currentUrl && (
                      <div className="text-xs text-slate-500 truncate">
                        <i className="fas fa-link mr-1"></i> {bulkProgress.currentUrl}
                      </div>
                    )}
                    
                    {bulkProgress.message && (
                      <div className="flex items-center gap-2 text-sm text-purple-300">
                        {bulkProgress.status !== 'complete' && bulkProgress.status !== 'idle' && (
                          <i className="fas fa-circle-notch fa-spin"></i>
                        )}
                        {bulkProgress.message}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  {!isGenerating ? (
                    <button
                      onClick={handleBulkImport}
                      disabled={!bulkUrls.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center"
                    >
                      <i className="fas fa-layer-group mr-2"></i>
                      Importeer Alle Producten
                    </button>
                  ) : (
                    <button
                      onClick={handleStopBulkImport}
                      className="w-full bg-red-900/30 border border-red-500/50 text-red-400 font-bold py-4 rounded-xl hover:bg-red-900/50 transition flex items-center justify-center"
                    >
                      <i className="fas fa-stop mr-2"></i>
                      Stop Import
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : bulkResults ? (
          /* Bulk Import Results */
          <div className="animate-fade-in space-y-6">
            <div className={`rounded-xl p-4 flex items-center text-sm ${
              bulkResults.failed.length === 0 
                ? 'bg-green-900/20 border border-green-500/30 text-green-400' 
                : bulkResults.successful.length === 0 
                  ? 'bg-red-900/20 border border-red-500/30 text-red-400'
                  : 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-400'
            }`}>
              <i className={`fas ${bulkResults.failed.length === 0 ? 'fa-check-circle' : bulkResults.successful.length === 0 ? 'fa-times-circle' : 'fa-exclamation-triangle'} mr-2`}></i>
              Bulk import voltooid: {bulkResults.successful.length} succesvol, {bulkResults.failed.length} mislukt
            </div>
            
            {/* Successful imports */}
            {bulkResults.successful.length > 0 && (
              <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-4">
                <h4 className="font-bold text-green-400 mb-3 flex items-center gap-2">
                  <i className="fas fa-check-circle"></i> Succesvol geïmporteerd ({bulkResults.successful.length})
                </h4>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {bulkResults.successful.map((product, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-green-300">
                      <i className="fas fa-check text-xs"></i>
                      <span>{product.brand} {product.model}</span>
                      <span className="text-xs text-green-500/60">({getStoreName(product.affiliateLink || '')})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Failed imports */}
            {bulkResults.failed.length > 0 && (
              <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4">
                <h4 className="font-bold text-red-400 mb-3 flex items-center gap-2">
                  <i className="fas fa-times-circle"></i> Mislukt ({bulkResults.failed.length})
                </h4>
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {bulkResults.failed.map((fail, idx) => (
                    <li key={idx} className="text-sm">
                      <div className="text-red-300 truncate">{fail.url}</div>
                      <div className="text-xs text-red-500/70">{fail.error}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-800">
              {bulkResults.failed.length > 0 && (
                <button 
                  onClick={handleRetryFailed}
                  className="flex-1 bg-yellow-600/20 border border-yellow-500/50 text-yellow-400 py-3 rounded-xl font-bold hover:bg-yellow-600/30 transition flex items-center justify-center gap-2"
                >
                  <i className="fas fa-redo"></i> Mislukte Opnieuw Proberen
                </button>
              )}
              <button 
                onClick={() => {
                  setBulkResults(null);
                  setBulkUrls('');
                  setBulkProgress({ current: 0, total: 0, status: 'idle' });
                }}
                className={`${bulkResults.failed.length > 0 ? '' : 'flex-1'} px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition py-3`}
              >
                Nieuwe Import
              </button>
              <button 
                onClick={onCancel}
                className="px-6 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition py-3"
              >
                Sluiten
              </button>
            </div>
          </div>
        ) : generatedProduct ? (
          /* Product Preview and Edit */
          <div className="animate-fade-in space-y-6">
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 flex items-center text-green-400 text-sm">
              <i className="fas fa-check-circle mr-2"></i>
              Product review succesvol gegenereerd! Bekijk en bewerk hieronder.
            </div>

            {/* Product Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Image & Score */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 aspect-square flex items-center justify-center">
                  <img 
                    src={generatedProduct.imageUrl || generatedProduct.image} 
                    alt={generatedProduct.title || `${generatedProduct.brand} ${generatedProduct.model}`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(generatedProduct.brand || 'Product')}&background=0f172a&color=3b82f6&size=400`;
                    }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-green-400">{generatedProduct.score || generatedProduct.rating}</div>
                  <div className="text-xs text-slate-500">Score</div>
                </div>
                
                {/* Scores Breakdown */}
                {generatedProduct.scores && (
                  <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-bold text-slate-400 uppercase">Scores</h4>
                    {Object.entries(generatedProduct.scores).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400 capitalize">{key === 'priceValue' ? 'Prijs-kwaliteit' : key}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full" 
                              style={{ width: `${(value as number) * 10}%` }}
                            ></div>
                          </div>
                          <span className="text-white font-medium w-6">{value as number}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Editable Fields */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Merk</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition" 
                      value={generatedProduct.brand || ''} 
                      onChange={e => handleEditField('brand', e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Model</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition" 
                      value={generatedProduct.model || ''} 
                      onChange={e => handleEditField('model', e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Prijs</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition" 
                      value={String(generatedProduct.price || generatedProduct.priceLabel || '')} 
                      onChange={e => handleEditField('price', e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Score (0-10)</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition" 
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={generatedProduct.score || generatedProduct.rating || 0} 
                      onChange={e => handleEditField('score', Number(e.target.value))} 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Categorie</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition cursor-pointer"
                    value={generatedProduct.category || ''}
                    onChange={e => handleEditField('category', e.target.value)}
                  >
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Beschrijving</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition h-24 resize-none" 
                    value={generatedProduct.description || ''} 
                    onChange={e => handleEditField('description', e.target.value)} 
                  />
                </div>

                {/* Affiliate Link - Editable */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase">
                      Affiliate Link <span className="text-green-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditingAffiliateLink(!editingAffiliateLink)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      <i className={`fas ${editingAffiliateLink ? 'fa-check' : 'fa-edit'} mr-1`}></i>
                      {editingAffiliateLink ? 'Klaar' : 'Bewerken'}
                    </button>
                  </div>
                  {editingAffiliateLink ? (
                    <input 
                      type="url"
                      className="w-full bg-slate-950 border border-blue-500 rounded-xl px-4 py-3 text-white outline-none focus:border-green-500 transition font-mono text-sm" 
                      value={generatedProduct.affiliateLink || generatedProduct.affiliateUrl || ''} 
                      onChange={e => {
                        handleEditField('affiliateLink', e.target.value);
                        handleEditField('affiliateUrl', e.target.value);
                      }}
                      placeholder="https://..."
                    />
                  ) : (
                    <div className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 text-sm font-mono truncate">
                      {generatedProduct.affiliateLink || generatedProduct.affiliateUrl || 'Geen link'}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    <i className="fas fa-info-circle mr-1"></i>
                    Deze link wordt gebruikt voor alle "Bekijk product" en "Koop nu" knoppen.
                    {getStoreName(generatedProduct.affiliateLink || generatedProduct.affiliateUrl || '') !== 'de webshop' && (
                      <span className="ml-2 text-green-400">
                        Gedetecteerd: {getStoreName(generatedProduct.affiliateLink || generatedProduct.affiliateUrl || '')}
                      </span>
                    )}
                  </p>
                </div>

                {/* Pros & Cons Preview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                    <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2 text-sm">
                      <i className="fas fa-plus-circle"></i> Voordelen ({generatedProduct.pros?.length || 0})
                    </h4>
                    <ul className="space-y-1 text-xs text-green-300">
                      {generatedProduct.pros?.slice(0, 3).map((pro, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <i className="fas fa-check text-[10px] mt-1"></i>
                          <span className="line-clamp-1">{pro}</span>
                        </li>
                      ))}
                      {(generatedProduct.pros?.length || 0) > 3 && (
                        <li className="text-slate-500">+{generatedProduct.pros!.length - 3} meer...</li>
                      )}
                    </ul>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                    <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2 text-sm">
                      <i className="fas fa-minus-circle"></i> Nadelen ({generatedProduct.cons?.length || 0})
                    </h4>
                    <ul className="space-y-1 text-xs text-red-300">
                      {generatedProduct.cons?.slice(0, 3).map((con, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <i className="fas fa-times text-[10px] mt-1"></i>
                          <span className="line-clamp-1">{con}</span>
                        </li>
                      ))}
                      {(generatedProduct.cons?.length || 0) > 3 && (
                        <li className="text-slate-500">+{generatedProduct.cons!.length - 3} meer...</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button 
                onClick={handleSaveProduct}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin"></i> Opslaan...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i> Opslaan & Publiceren
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  setGeneratedProduct(null);
                  setError(null);
                }}
                disabled={isSaving}
                className="px-6 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition"
              >
                Annuleren
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

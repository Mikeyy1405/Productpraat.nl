/**
 * NewsletterForm Component
 * 
 * Newsletter signup form with email validation.
 * Only renders when the 'newsletter' feature is enabled.
 */

import React, { useState } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

interface NewsletterSubscriber {
    id: string;
    email: string;
    subscribedAt: string;
    confirmed: boolean;
    unsubscribed: boolean;
}

const STORAGE_KEY = 'writgo_newsletter_subscribers';

// Load subscribers from localStorage
export const loadNewsletterSubscribers = (): NewsletterSubscriber[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save subscriber to localStorage
const saveSubscriber = (subscriber: NewsletterSubscriber): boolean => {
    const subscribers = loadNewsletterSubscribers();
    
    // Check if already subscribed
    const existing = subscribers.find(s => s.email.toLowerCase() === subscriber.email.toLowerCase());
    if (existing && !existing.unsubscribed) {
        return false; // Already subscribed
    }
    
    if (existing) {
        // Resubscribe
        existing.unsubscribed = false;
        existing.subscribedAt = subscriber.subscribedAt;
    } else {
        subscribers.push(subscriber);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
    return true;
};

// Unsubscribe
export const unsubscribeNewsletter = (email: string): boolean => {
    const subscribers = loadNewsletterSubscribers();
    const subscriber = subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
    
    if (subscriber) {
        subscriber.unsubscribed = true;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
        return true;
    }
    
    return false;
};

interface NewsletterFormProps {
    title?: string;
    subtitle?: string;
    buttonText?: string;
    variant?: 'inline' | 'stacked' | 'card';
    className?: string;
    onSubscribe?: (email: string) => void;
}

export const NewsletterForm: React.FC<NewsletterFormProps> = ({
    title = 'Blijf op de hoogte',
    subtitle = 'Ontvang de beste deals en tips direct in je inbox.',
    buttonText = 'Aanmelden',
    variant = 'stacked',
    className = '',
    onSubscribe
}) => {
    const enabled = useFeature('newsletter');
    const { settings } = useFeatureToggle('newsletter');
    const { type: templateType } = useTemplate();
    
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'already-subscribed'>('idle');

    const validateEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!email.trim()) {
            setError('Vul je e-mailadres in');
            return;
        }
        
        if (!validateEmail(email)) {
            setError('Vul een geldig e-mailadres in');
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            const subscriber: NewsletterSubscriber = {
                id: `newsletter-${Date.now()}`,
                email: email.trim().toLowerCase(),
                subscribedAt: new Date().toISOString(),
                confirmed: false, // Would be true after double opt-in
                unsubscribed: false
            };
            
            const success = saveSubscriber(subscriber);
            
            if (success) {
                setStatus('success');
                onSubscribe?.(email);
                setEmail('');
            } else {
                setStatus('already-subscribed');
            }
        } catch (error) {
            console.error('Failed to subscribe:', error);
            setError('Er is iets misgegaan. Probeer het later opnieuw.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!enabled) return null;

    // Success state
    if (status === 'success') {
        return (
            <div className={`bg-green-600/20 border border-green-500/50 rounded-xl p-6 text-center ${className}`}>
                <i className="fas fa-check-circle text-3xl text-green-400 mb-3"></i>
                <h3 className="text-lg font-bold text-white mb-1">Bedankt voor je aanmelding!</h3>
                <p className="text-slate-400 text-sm mb-4">Je ontvangt binnenkort een bevestigingsmail.</p>
                <button
                    onClick={() => setStatus('idle')}
                    className="text-green-400 hover:text-green-300 text-sm transition"
                >
                    Nog iemand aanmelden?
                </button>
            </div>
        );
    }

    // Already subscribed state
    if (status === 'already-subscribed') {
        return (
            <div className={`bg-blue-600/20 border border-blue-500/50 rounded-xl p-6 text-center ${className}`}>
                <i className="fas fa-envelope text-3xl text-blue-400 mb-3"></i>
                <h3 className="text-lg font-bold text-white mb-1">Je bent al aangemeld!</h3>
                <p className="text-slate-400 text-sm mb-4">Dit e-mailadres staat al in onze lijst.</p>
                <button
                    onClick={() => setStatus('idle')}
                    className="text-blue-400 hover:text-blue-300 text-sm transition"
                >
                    Ander e-mailadres gebruiken
                </button>
            </div>
        );
    }

    // Card variant
    if (variant === 'card') {
        return (
            <div className={`bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6 ${className}`}>
                <div className="text-center mb-4">
                    <i className="fas fa-envelope text-3xl text-blue-400 mb-3"></i>
                    {title && <h3 className="text-xl font-bold text-white mb-1">{title}</h3>}
                    {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="je@email.nl"
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                            error ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                    />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane"></i>
                                {buttonText}
                            </>
                        )}
                    </button>
                </form>
                
                <p className="text-xs text-slate-500 text-center mt-3">
                    We respecteren je privacy. Geen spam!
                </p>
            </div>
        );
    }

    // Inline variant
    if (variant === 'inline') {
        return (
            <div className={className}>
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setError('');
                        }}
                        placeholder="je@email.nl"
                        className={`flex-1 bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                            error ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold px-6 rounded-xl transition flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                            buttonText
                        )}
                    </button>
                </form>
                {error && <p className="text-sm text-red-400 mt-1">{error}</p>}
            </div>
        );
    }

    // Stacked variant (default)
    return (
        <div className={className}>
            {(title || subtitle) && (
                <div className="mb-4">
                    {title && <h3 className="text-lg font-bold text-white mb-1">{title}</h3>}
                    {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-3">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                    }}
                    placeholder="je@email.nl"
                    className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                        error ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                    }`}
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                        <>
                            <i className="fas fa-paper-plane"></i>
                            {buttonText}
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default NewsletterForm;

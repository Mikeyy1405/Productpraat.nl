/**
 * ContactForm Component
 * 
 * Contact form with validation and submission handling.
 * Only renders when the 'contact_form' feature is enabled.
 */

import React, { useState } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

interface ContactSubmission {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    file?: string;
    submittedAt: string;
    read: boolean;
}

const STORAGE_KEY = 'writgo_contact_submissions';

// Load submissions from localStorage
export const loadContactSubmissions = (): ContactSubmission[] => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save submission to localStorage
const saveSubmission = (submission: ContactSubmission): void => {
    const submissions = loadContactSubmissions();
    submissions.unshift(submission);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
};

interface ContactFormProps {
    title?: string;
    subtitle?: string;
    showFileUpload?: boolean;
    className?: string;
    onSubmit?: (data: ContactSubmission) => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({
    title = 'Neem contact op',
    subtitle = 'Heb je een vraag of opmerking? Vul onderstaand formulier in en we nemen zo snel mogelijk contact met je op.',
    showFileUpload = true,
    className = '',
    onSubmit
}) => {
    const enabled = useFeature('contact_form');
    const { settings } = useFeatureToggle('contact_form');
    const { type: templateType } = useTemplate();
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
        file: null as File | null
    });
    
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const successMessage = (settings?.successMessage as string) || 'Bedankt voor je bericht! We nemen zo snel mogelijk contact met je op.';

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name.trim()) {
            newErrors.name = 'Naam is verplicht';
        }
        
        if (!formData.email.trim()) {
            newErrors.email = 'E-mailadres is verplicht';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Ongeldig e-mailadres';
        }
        
        if (!formData.subject.trim()) {
            newErrors.subject = 'Onderwerp is verplicht';
        }
        
        if (!formData.message.trim()) {
            newErrors.message = 'Bericht is verplicht';
        } else if (formData.message.trim().length < 10) {
            newErrors.message = 'Bericht moet minimaal 10 tekens zijn';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) return;
        
        setIsSubmitting(true);
        setSubmitStatus('idle');
        
        try {
            // Create submission
            const submission: ContactSubmission = {
                id: `contact-${Date.now()}`,
                name: formData.name.trim(),
                email: formData.email.trim(),
                subject: formData.subject.trim(),
                message: formData.message.trim(),
                file: formData.file?.name,
                submittedAt: new Date().toISOString(),
                read: false
            };
            
            // Save to localStorage
            saveSubmission(submission);
            
            // Call custom handler if provided
            onSubmit?.(submission);
            
            // Reset form
            setFormData({
                name: '',
                email: '',
                subject: '',
                message: '',
                file: null
            });
            
            setSubmitStatus('success');
        } catch (error) {
            console.error('Failed to submit contact form:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setFormData(prev => ({ ...prev, file }));
    };

    if (!enabled) return null;

    // Success state
    if (submitStatus === 'success') {
        return (
            <div className={`bg-slate-900 border border-green-500/50 rounded-xl p-8 text-center ${className}`}>
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-check text-3xl text-green-400"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Bericht verzonden!</h3>
                <p className="text-slate-400 mb-6">{successMessage}</p>
                <button
                    onClick={() => setSubmitStatus('idle')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                    Nieuw bericht sturen
                </button>
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {/* Header */}
            {(title || subtitle) && (
                <div className="mb-6">
                    {title && <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>}
                    {subtitle && <p className="text-slate-400">{subtitle}</p>}
                </div>
            )}

            {/* Error message */}
            {submitStatus === 'error' && (
                <div className="bg-red-600/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <i className="fas fa-exclamation-circle text-red-400"></i>
                    <p className="text-red-300">Er is iets misgegaan. Probeer het later opnieuw.</p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name and Email row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="contact-name" className="block text-sm font-medium text-slate-400 mb-2">
                            Naam *
                        </label>
                        <input
                            type="text"
                            id="contact-name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                                errors.name ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                            }`}
                            placeholder="Je naam"
                        />
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                        )}
                    </div>
                    
                    <div>
                        <label htmlFor="contact-email" className="block text-sm font-medium text-slate-400 mb-2">
                            E-mailadres *
                        </label>
                        <input
                            type="email"
                            id="contact-email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition ${
                                errors.email ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                            }`}
                            placeholder="je@email.nl"
                        />
                        {errors.email && (
                            <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                        )}
                    </div>
                </div>

                {/* Subject */}
                <div>
                    <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-400 mb-2">
                        Onderwerp *
                    </label>
                    <select
                        id="contact-subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition cursor-pointer ${
                            errors.subject ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                    >
                        <option value="">Selecteer een onderwerp</option>
                        <option value="Algemene vraag">Algemene vraag</option>
                        <option value="Product informatie">Product informatie</option>
                        <option value="Samenwerking">Samenwerking</option>
                        <option value="Feedback">Feedback</option>
                        <option value="Anders">Anders</option>
                    </select>
                    {errors.subject && (
                        <p className="mt-1 text-sm text-red-400">{errors.subject}</p>
                    )}
                </div>

                {/* Message */}
                <div>
                    <label htmlFor="contact-message" className="block text-sm font-medium text-slate-400 mb-2">
                        Bericht *
                    </label>
                    <textarea
                        id="contact-message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={5}
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition resize-none ${
                            errors.message ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="Je bericht..."
                    />
                    {errors.message && (
                        <p className="mt-1 text-sm text-red-400">{errors.message}</p>
                    )}
                </div>

                {/* File upload */}
                {showFileUpload && (
                    <div>
                        <label htmlFor="contact-file" className="block text-sm font-medium text-slate-400 mb-2">
                            Bestand toevoegen (optioneel)
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                id="contact-file"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label
                                htmlFor="contact-file"
                                className="flex items-center gap-2 w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 hover:border-slate-600 cursor-pointer transition"
                            >
                                <i className="fas fa-paperclip"></i>
                                <span>{formData.file ? formData.file.name : 'Kies een bestand...'}</span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Submit button */}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i>
                            Verzenden...
                        </>
                    ) : (
                        <>
                            <i className="fas fa-paper-plane"></i>
                            Verstuur bericht
                        </>
                    )}
                </button>
            </form>
        </div>
    );
};

export default ContactForm;

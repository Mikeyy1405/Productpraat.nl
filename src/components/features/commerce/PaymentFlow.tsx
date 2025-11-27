/**
 * Payment Flow Components
 * 
 * Checkout flow with mock payment providers.
 * Only renders when the 'payment_systems' feature is enabled.
 */

import React, { useState, useCallback } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
}

interface OrderInfo {
    id: string;
    items: CartItem[];
    totalAmount: number;
    paymentMethod: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    customerInfo: {
        name: string;
        email: string;
        address?: string;
    };
    createdAt: string;
}

const ORDERS_STORAGE_KEY = 'writgo_orders_data';

// Load orders from localStorage
export const loadOrders = (): OrderInfo[] => {
    try {
        const data = localStorage.getItem(ORDERS_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save order
const saveOrder = (order: OrderInfo): void => {
    const orders = loadOrders();
    orders.unshift(order);
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
};

interface PaymentMethodSelectorProps {
    selectedMethod: string | null;
    onSelect: (method: string) => void;
    className?: string;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    selectedMethod,
    onSelect,
    className = ''
}) => {
    const { settings } = useFeatureToggle('payment_systems');
    
    const providers = (settings?.providers as string[]) || ['ideal', 'creditcard', 'paypal'];

    const paymentMethods: Record<string, { name: string; icon: string; description: string }> = {
        ideal: {
            name: 'iDEAL',
            icon: 'fa-university',
            description: 'Betaal via je eigen bank'
        },
        creditcard: {
            name: 'Creditcard',
            icon: 'fa-credit-card',
            description: 'Visa, Mastercard, AMEX'
        },
        paypal: {
            name: 'PayPal',
            icon: 'fa-paypal',
            description: 'Betaal met je PayPal account'
        },
        bancontact: {
            name: 'Bancontact',
            icon: 'fa-mobile-alt',
            description: 'Belgische betaalmethode'
        },
        klarna: {
            name: 'Klarna',
            icon: 'fa-clock',
            description: 'Achteraf betalen'
        }
    };

    return (
        <div className={`space-y-3 ${className}`}>
            <h3 className="text-lg font-bold text-white mb-4">Kies een betaalmethode</h3>
            
            {providers.map(method => {
                const info = paymentMethods[method];
                if (!info) return null;
                
                return (
                    <button
                        key={method}
                        type="button"
                        onClick={() => onSelect(method)}
                        className={`w-full p-4 rounded-xl border transition flex items-center gap-4 text-left ${
                            selectedMethod === method
                                ? 'bg-blue-600/20 border-blue-500/50'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            selectedMethod === method ? 'bg-blue-600' : 'bg-slate-800'
                        }`}>
                            <i className={`fab ${info.icon} text-xl ${
                                selectedMethod === method ? 'text-white' : 'text-slate-400'
                            }`}></i>
                        </div>
                        <div className="flex-1">
                            <div className={`font-bold ${selectedMethod === method ? 'text-white' : 'text-slate-300'}`}>
                                {info.name}
                            </div>
                            <div className="text-sm text-slate-500">{info.description}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedMethod === method 
                                ? 'border-blue-500 bg-blue-500' 
                                : 'border-slate-600'
                        }`}>
                            {selectedMethod === method && (
                                <i className="fas fa-check text-xs text-white"></i>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

interface PaymentFlowProps {
    items: CartItem[];
    onComplete?: (order: OrderInfo) => void;
    onCancel?: () => void;
    className?: string;
}

export const PaymentFlow: React.FC<PaymentFlowProps> = ({
    items,
    onComplete,
    onCancel,
    className = ''
}) => {
    const enabled = useFeature('payment_systems');
    const { settings } = useFeatureToggle('payment_systems');
    const { type: templateType } = useTemplate();
    
    const [step, setStep] = useState<'info' | 'payment' | 'processing' | 'complete'>('info');
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        address: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [order, setOrder] = useState<OrderInfo | null>(null);

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const isTestMode = settings?.testMode !== false;

    const validateInfo = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!customerInfo.name.trim()) newErrors.name = 'Naam is verplicht';
        if (!customerInfo.email.trim()) newErrors.email = 'E-mail is verplicht';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) newErrors.email = 'Ongeldig e-mailadres';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmitInfo = () => {
        if (validateInfo()) {
            setStep('payment');
        }
    };

    const handlePayment = useCallback(() => {
        if (!paymentMethod) return;
        
        setStep('processing');
        
        // Simulate payment processing
        setTimeout(() => {
            const newOrder: OrderInfo = {
                id: `ORD-${Date.now()}`,
                items,
                totalAmount,
                paymentMethod,
                status: 'completed',
                customerInfo: {
                    name: customerInfo.name.trim(),
                    email: customerInfo.email.trim(),
                    address: customerInfo.address.trim()
                },
                createdAt: new Date().toISOString()
            };
            
            saveOrder(newOrder);
            setOrder(newOrder);
            setStep('complete');
            onComplete?.(newOrder);
        }, 2000);
    }, [paymentMethod, items, totalAmount, customerInfo, onComplete]);

    if (!enabled) return null;

    // Processing step
    if (step === 'processing') {
        return (
            <div className={`bg-slate-900 border border-slate-800 rounded-xl p-8 text-center ${className}`}>
                <i className="fas fa-spinner fa-spin text-5xl text-blue-500 mb-6"></i>
                <h2 className="text-2xl font-bold text-white mb-2">Betaling verwerken...</h2>
                <p className="text-slate-400">Een moment geduld alstublieft.</p>
                {isTestMode && (
                    <p className="text-xs text-orange-400 mt-4">
                        <i className="fas fa-flask mr-1"></i> Test modus - Geen echte betaling
                    </p>
                )}
            </div>
        );
    }

    // Complete step
    if (step === 'complete' && order) {
        return (
            <div className={`bg-slate-900 border border-green-500/50 rounded-xl p-8 ${className}`}>
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-check text-4xl text-green-400"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Betaling geslaagd!</h2>
                    <p className="text-slate-400">Je bestelling is bevestigd.</p>
                </div>
                
                <div className="bg-slate-800 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-slate-400">Ordernummer</span>
                        <span className="font-mono font-bold text-white">{order.id}</span>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-slate-400">Totaalbedrag</span>
                        <span className="font-bold text-white">€{order.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Betaalmethode</span>
                        <span className="text-white">{order.paymentMethod}</span>
                    </div>
                </div>
                
                <p className="text-sm text-slate-400 text-center mb-6">
                    Een bevestigingsmail is verzonden naar <strong className="text-white">{order.customerInfo.email}</strong>
                </p>
                
                {isTestMode && (
                    <div className="bg-orange-600/20 border border-orange-500/30 rounded-lg p-3 text-center">
                        <p className="text-sm text-orange-400">
                            <i className="fas fa-flask mr-1"></i> Dit was een testbetaling - Geen geld afgeschreven
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {/* Test mode banner */}
            {isTestMode && (
                <div className="bg-orange-600/20 border border-orange-500/30 rounded-xl p-3 mb-6 flex items-center gap-2">
                    <i className="fas fa-flask text-orange-400"></i>
                    <span className="text-sm text-orange-300">Test modus - Geen echte betalingen worden verwerkt</span>
                </div>
            )}

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-8">
                {['info', 'payment'].map((s, i) => (
                    <React.Fragment key={s}>
                        <div className={`flex items-center gap-2 ${
                            step === s ? 'text-blue-400' : 
                            (s === 'info' && step === 'payment') ? 'text-green-400' : 'text-slate-600'
                        }`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                step === s ? 'bg-blue-600 text-white' :
                                (s === 'info' && step === 'payment') ? 'bg-green-600 text-white' : 'bg-slate-800'
                            }`}>
                                {(s === 'info' && step === 'payment') ? (
                                    <i className="fas fa-check text-sm"></i>
                                ) : (
                                    i + 1
                                )}
                            </div>
                            <span className="font-medium">
                                {s === 'info' ? 'Gegevens' : 'Betalen'}
                            </span>
                        </div>
                        {i < 1 && (
                            <div className={`flex-1 h-0.5 ${
                                step === 'payment' ? 'bg-green-600' : 'bg-slate-800'
                            }`}></div>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Order summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
                <h3 className="font-bold text-white mb-3">Bestelling</h3>
                <div className="space-y-2 mb-4">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">
                                {item.quantity}x {item.name}
                            </span>
                            <span className="text-white">€{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <span className="font-bold text-white">Totaal</span>
                    <span className="text-xl font-bold text-blue-400">€{totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Step content */}
            {step === 'info' && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">Je gegevens</h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Naam *</label>
                        <input
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                            className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition ${
                                errors.name ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                            }`}
                            placeholder="Je volledige naam"
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">E-mail *</label>
                        <input
                            type="email"
                            value={customerInfo.email}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                            className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white outline-none transition ${
                                errors.email ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                            }`}
                            placeholder="je@email.nl"
                        />
                        {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Adres (optioneel)</label>
                        <textarea
                            value={customerInfo.address}
                            onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition resize-none"
                            placeholder="Straat, huisnummer, postcode, plaats"
                            rows={2}
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 rounded-xl transition"
                            >
                                Annuleren
                            </button>
                        )}
                        <button
                            onClick={handleSubmitInfo}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
                        >
                            Doorgaan naar betalen
                        </button>
                    </div>
                </div>
            )}

            {step === 'payment' && (
                <div className="space-y-6">
                    <PaymentMethodSelector
                        selectedMethod={paymentMethod}
                        onSelect={setPaymentMethod}
                    />
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep('info')}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 rounded-xl transition"
                        >
                            Terug
                        </button>
                        <button
                            onClick={handlePayment}
                            disabled={!paymentMethod}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-lock"></i>
                            Betaal €{totalAmount.toFixed(2)}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentFlow;

/**
 * Toast Notification System
 * 
 * Provides a global toast notification context for displaying
 * success, error, warning, and info messages throughout the application.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
    clearAllToasts: () => void;
    // Convenience methods
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// TOAST PROVIDER
// ============================================================================

interface ToastProviderProps {
    children: ReactNode;
    maxToasts?: number;
    defaultDuration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
    children,
    maxToasts = 5,
    defaultDuration = 4000,
}) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((
        message: string,
        type: ToastType = 'info',
        duration: number = defaultDuration
    ) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        setToasts(prev => {
            // Keep only the last (maxToasts - 1) toasts to make room for the new one
            const trimmed = prev.slice(-(maxToasts - 1));
            return [...trimmed, { id, message, type, duration }];
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        // Log to console for debugging
        console.log(`[Toast ${type.toUpperCase()}] ${message}`);

        return id;
    }, [defaultDuration, maxToasts, removeToast]);

    const clearAllToasts = useCallback(() => {
        setToasts([]);
    }, []);

    // Convenience methods
    const success = useCallback((message: string, duration?: number) => {
        showToast(message, 'success', duration);
    }, [showToast]);

    const error = useCallback((message: string, duration?: number) => {
        showToast(message, 'error', duration);
    }, [showToast]);

    const warning = useCallback((message: string, duration?: number) => {
        showToast(message, 'warning', duration);
    }, [showToast]);

    const info = useCallback((message: string, duration?: number) => {
        showToast(message, 'info', duration);
    }, [showToast]);

    const value: ToastContextValue = {
        toasts,
        showToast,
        removeToast,
        clearAllToasts,
        success,
        error,
        warning,
        info,
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
};

// ============================================================================
// HOOK
// ============================================================================

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

interface ToastContainerProps {
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
    position = 'top-right',
}) => {
    const { toasts, removeToast } = useToast();

    const positionClasses = {
        'top-right': 'top-4 right-4',
        'top-left': 'top-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'top-center': 'top-4 left-1/2 -translate-x-1/2',
        'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    };

    const getToastStyles = (type: ToastType) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-900/95',
                    border: 'border-green-500/50',
                    text: 'text-green-100',
                    icon: 'fa-check-circle',
                    iconColor: 'text-green-400',
                };
            case 'error':
                return {
                    bg: 'bg-red-900/95',
                    border: 'border-red-500/50',
                    text: 'text-red-100',
                    icon: 'fa-exclamation-circle',
                    iconColor: 'text-red-400',
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-900/95',
                    border: 'border-yellow-500/50',
                    text: 'text-yellow-100',
                    icon: 'fa-exclamation-triangle',
                    iconColor: 'text-yellow-400',
                };
            case 'info':
            default:
                return {
                    bg: 'bg-blue-900/95',
                    border: 'border-blue-500/50',
                    text: 'text-blue-100',
                    icon: 'fa-info-circle',
                    iconColor: 'text-blue-400',
                };
        }
    };

    if (toasts.length === 0) return null;

    return (
        <div className={`fixed ${positionClasses[position]} z-[100] space-y-2 pointer-events-none`}>
            {toasts.map(toast => {
                const styles = getToastStyles(toast.type);
                
                return (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto
                            animate-slide-in
                            flex items-center gap-3 
                            px-5 py-3 
                            rounded-xl 
                            shadow-2xl 
                            border 
                            backdrop-blur-md
                            max-w-sm
                            ${styles.bg} ${styles.border} ${styles.text}
                        `}
                        role="alert"
                    >
                        <i className={`fas ${styles.icon} ${styles.iconColor} text-lg flex-shrink-0`}></i>
                        <span className="text-sm font-medium flex-1">{toast.message}</span>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="opacity-60 hover:opacity-100 transition p-1 -mr-1"
                            aria-label="Sluiten"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                );
            })}
            
            <style>{`
                @keyframes slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default ToastProvider;

/**
 * User Authentication Components
 * 
 * Login, Register, and Profile components.
 * Only renders when the 'user_authentication' feature is enabled.
 */

import React, { useState, useCallback } from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    avatar?: string;
    createdAt: string;
}

const USERS_STORAGE_KEY = 'writgo_users_data';
const SESSION_STORAGE_KEY = 'writgo_user_session';

// Load users from localStorage
export const loadUsers = (): User[] => {
    try {
        const data = localStorage.getItem(USERS_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

// Save users to localStorage
const saveUsers = (users: User[]): void => {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

// Get current user session
export const getCurrentUser = (): User | null => {
    try {
        const data = localStorage.getItem(SESSION_STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

// Save user session
const saveSession = (user: User | null): void => {
    if (user) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
    }
};

/**
 * Hash password for demo purposes only.
 * 
 * WARNING: This is NOT cryptographically secure!
 * For production use, replace with:
 * - bcrypt/bcryptjs for server-side hashing
 * - WebCrypto API with PBKDF2 for client-side
 * - Or use a secure authentication service (Auth0, Firebase Auth, etc.)
 */
const hashPassword = (password: string): string => {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(36);
};

interface LoginFormProps {
    onSuccess?: (user: User) => void;
    onRegisterClick?: () => void;
    className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
    onSuccess,
    onRegisterClick,
    className = ''
}) => {
    const enabled = useFeature('user_authentication');
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false
    });
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!formData.email || !formData.password) {
            setError('Vul alle velden in');
            return;
        }
        
        setIsSubmitting(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const users = loadUsers();
        const passwordHash = hashPassword(formData.password);
        
        // Find user (check password stored in a separate object for demo)
        const passwordStore = JSON.parse(localStorage.getItem('writgo_passwords') || '{}');
        const user = users.find(u => 
            u.email.toLowerCase() === formData.email.toLowerCase() && 
            passwordStore[u.id] === passwordHash
        );
        
        if (user) {
            saveSession(user);
            onSuccess?.(user);
        } else {
            setError('Ongeldige e-mail of wachtwoord');
        }
        
        setIsSubmitting(false);
    };

    if (!enabled) return null;

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-user text-2xl text-blue-400"></i>
                </div>
                <h2 className="text-xl font-bold text-white">Inloggen</h2>
                <p className="text-slate-400 text-sm mt-1">Welkom terug!</p>
            </div>

            {error && (
                <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-3 mb-4 text-sm text-red-300 flex items-center gap-2">
                    <i className="fas fa-exclamation-circle"></i>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        E-mailadres
                    </label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                        placeholder="je@email.nl"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Wachtwoord
                    </label>
                    <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
                        placeholder="••••••••"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.rememberMe}
                            onChange={(e) => setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600"
                        />
                        <span className="text-sm text-slate-400">Onthoud mij</span>
                    </label>
                    
                    <button type="button" className="text-sm text-blue-400 hover:text-blue-300 transition">
                        Wachtwoord vergeten?
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                        <>
                            <i className="fas fa-sign-in-alt"></i>
                            Inloggen
                        </>
                    )}
                </button>
            </form>

            {onRegisterClick && (
                <div className="mt-6 text-center border-t border-slate-800 pt-6">
                    <p className="text-slate-400 text-sm">
                        Nog geen account?{' '}
                        <button 
                            onClick={onRegisterClick}
                            className="text-blue-400 hover:text-blue-300 font-medium transition"
                        >
                            Registreer nu
                        </button>
                    </p>
                </div>
            )}
        </div>
    );
};

interface RegisterFormProps {
    onSuccess?: (user: User) => void;
    onLoginClick?: () => void;
    className?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
    onSuccess,
    onLoginClick,
    className = ''
}) => {
    const enabled = useFeature('user_authentication');
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        acceptTerms: false
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name.trim()) newErrors.name = 'Naam is verplicht';
        if (!formData.email.trim()) newErrors.email = 'E-mail is verplicht';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Ongeldig e-mailadres';
        if (!formData.password) newErrors.password = 'Wachtwoord is verplicht';
        else if (formData.password.length < 6) newErrors.password = 'Wachtwoord moet minimaal 6 tekens zijn';
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Wachtwoorden komen niet overeen';
        if (!formData.acceptTerms) newErrors.acceptTerms = 'Je moet de voorwaarden accepteren';
        
        // Check if email already exists
        const users = loadUsers();
        if (users.some(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
            newErrors.email = 'Dit e-mailadres is al geregistreerd';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) return;
        
        setIsSubmitting(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const user: User = {
            id: `user-${Date.now()}`,
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            role: 'user',
            createdAt: new Date().toISOString()
        };
        
        // Save user
        const users = loadUsers();
        users.push(user);
        saveUsers(users);
        
        // Save password hash
        const passwordStore = JSON.parse(localStorage.getItem('writgo_passwords') || '{}');
        passwordStore[user.id] = hashPassword(formData.password);
        localStorage.setItem('writgo_passwords', JSON.stringify(passwordStore));
        
        // Log in the user
        saveSession(user);
        onSuccess?.(user);
        
        setIsSubmitting(false);
    };

    if (!enabled) return null;

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-user-plus text-2xl text-green-400"></i>
                </div>
                <h2 className="text-xl font-bold text-white">Account aanmaken</h2>
                <p className="text-slate-400 text-sm mt-1">Maak gratis een account aan</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Naam
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white outline-none transition ${
                            errors.name ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="Je naam"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        E-mailadres
                    </label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white outline-none transition ${
                            errors.email ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="je@email.nl"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Wachtwoord
                    </label>
                    <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white outline-none transition ${
                            errors.password ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="••••••••"
                    />
                    {errors.password && <p className="mt-1 text-sm text-red-400">{errors.password}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Bevestig wachtwoord
                    </label>
                    <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className={`w-full bg-slate-950 border rounded-xl px-4 py-3 text-white outline-none transition ${
                            errors.confirmPassword ? 'border-red-500' : 'border-slate-700 focus:border-blue-500'
                        }`}
                        placeholder="••••••••"
                    />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>}
                </div>

                <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.acceptTerms}
                            onChange={(e) => setFormData(prev => ({ ...prev, acceptTerms: e.target.checked }))}
                            className="w-4 h-4 mt-1 rounded border-slate-600 bg-slate-800 text-blue-600"
                        />
                        <span className="text-sm text-slate-400">
                            Ik ga akkoord met de <a href="#" className="text-blue-400 hover:underline">algemene voorwaarden</a> en het <a href="#" className="text-blue-400 hover:underline">privacybeleid</a>
                        </span>
                    </label>
                    {errors.acceptTerms && <p className="mt-1 text-sm text-red-400">{errors.acceptTerms}</p>}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <i className="fas fa-spinner fa-spin"></i>
                    ) : (
                        <>
                            <i className="fas fa-user-plus"></i>
                            Account aanmaken
                        </>
                    )}
                </button>
            </form>

            {onLoginClick && (
                <div className="mt-6 text-center border-t border-slate-800 pt-6">
                    <p className="text-slate-400 text-sm">
                        Al een account?{' '}
                        <button 
                            onClick={onLoginClick}
                            className="text-blue-400 hover:text-blue-300 font-medium transition"
                        >
                            Log in
                        </button>
                    </p>
                </div>
            )}
        </div>
    );
};

interface UserProfileProps {
    user: User;
    onLogout?: () => void;
    onUpdate?: (user: User) => void;
    className?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({
    user,
    onLogout,
    onUpdate,
    className = ''
}) => {
    const enabled = useFeature('user_authentication');
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: user.name });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!editData.name.trim()) return;
        
        setIsSaving(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const updatedUser = { ...user, name: editData.name.trim() };
        
        // Update in storage
        const users = loadUsers();
        const index = users.findIndex(u => u.id === user.id);
        if (index >= 0) {
            users[index] = updatedUser;
            saveUsers(users);
        }
        
        saveSession(updatedUser);
        onUpdate?.(updatedUser);
        setIsEditing(false);
        setIsSaving(false);
    };

    const handleLogout = () => {
        saveSession(null);
        onLogout?.();
    };

    if (!enabled) return null;

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                {user.avatar ? (
                    <img 
                        src={user.avatar} 
                        alt={user.name}
                        className="w-16 h-16 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-2xl">
                            {user.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
                <div className="flex-1">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500 transition"
                        />
                    ) : (
                        <h2 className="text-xl font-bold text-white">{user.name}</h2>
                    )}
                    <p className="text-slate-400">{user.email}</p>
                </div>
                <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                            ? 'bg-purple-600/20 text-purple-400' 
                            : 'bg-slate-700 text-slate-400'
                    }`}>
                        {user.role === 'admin' ? 'Admin' : 'Gebruiker'}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mb-6">
                {isEditing ? (
                    <>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                            Opslaan
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setEditData({ name: user.name });
                            }}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium py-2 rounded-lg transition"
                        >
                            Annuleren
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-pen"></i>
                            Profiel bewerken
                        </button>
                        <button
                            onClick={handleLogout}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                        >
                            <i className="fas fa-sign-out-alt"></i>
                            Uitloggen
                        </button>
                    </>
                )}
            </div>

            {/* Info */}
            <div className="border-t border-slate-800 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <div className="text-slate-500 mb-1">Lid sinds</div>
                        <div className="text-white">
                            {new Date(user.createdAt).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 mb-1">Account ID</div>
                        <div className="text-white font-mono text-xs">{user.id}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginForm;

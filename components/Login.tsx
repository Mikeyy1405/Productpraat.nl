
import React, { useState } from 'react';
import { authService } from '../services/authService';

interface LoginProps {
    onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        try {
            const result = await authService.login(email, password);
            if (result.success) {
                onLoginSuccess();
            } else {
                setError(result.error || 'Ongeldige inloggegevens. Probeer het opnieuw.');
            }
        } catch (err) {
            setError('Er is een fout opgetreden. Probeer het later opnieuw.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800 shadow-inner">
                        <i className="fas fa-lock text-2xl text-[#1877F2]"></i>
                    </div>
                    <h1 className="text-2xl font-extrabold text-white">Admin Login</h1>
                    <p className="text-slate-400 text-sm mt-2">Toegang tot ProductPraat Backend</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">E-mailadres</label>
                        <div className="relative">
                            <i className="fas fa-envelope absolute left-4 top-3.5 text-slate-500 text-sm"></i>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#1877F2] focus:ring-1 focus:ring-blue-900 outline-none transition"
                                placeholder="naam@bedrijf.nl"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Wachtwoord</label>
                        <div className="relative">
                            <i className="fas fa-key absolute left-4 top-3.5 text-slate-500 text-sm"></i>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#1877F2] focus:ring-1 focus:ring-blue-900 outline-none transition"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle"></i> {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-[#1877F2] hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/20 transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                        {isLoading ? 'Bezig met inloggen...' : 'Inloggen'}
                    </button>
                </form>
                
                <div className="mt-6 text-center">
                    <p className="text-xs text-slate-500">
                        Alleen voor geautoriseerd personeel. <br/>
                        IP adres wordt gelogd.
                    </p>
                </div>
            </div>
        </div>
    );
};


import React, { useState } from 'react';

interface HeaderProps {
    onNavigate: (view: 'home' | 'admin' | 'about' | 'contact' | 'artikelen' | 'bolshop') => void;
    onSelectCategory: (categoryId: string) => void;
    activeView: string;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, onSelectCategory, activeView }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <header className="bg-slate-900 shadow-sm sticky top-0 z-50 border-b border-slate-800 font-sans">
            {/* Top Bar */}
            <div className="bg-slate-950 border-b border-slate-800 text-[11px] font-medium py-1.5 hidden sm:block">
                <div className="container mx-auto px-4 flex justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <i className="fas fa-shield-alt text-[#1877F2]"></i> 100% Onafhankelijk en reclamevrij
                    </span>
                    <div className="flex gap-4">
                        <span className="text-slate-500">Klantenservice bereikbaar tot 22:00</span>
                    </div>
                </div>
            </div>

            {/* Main Header */}
            <div className="container mx-auto px-4 py-4 md:py-6 relative">
                {/* Mobile Menu Trigger (Left) */}
                <div className="absolute left-4 top-5 md:hidden z-50">
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-white hover:bg-slate-800 transition"
                    >
                        <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
                    </button>
                </div>

                {/* Search Icon - Absolute Right */}
                <div className="absolute right-4 top-5 md:top-7">
                     <button className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition">
                        <i className="fas fa-search text-lg"></i>
                    </button>
                </div>

                <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
                    {/* Logo */}
                    <div onClick={() => onNavigate('home')} className="flex items-center gap-3 cursor-pointer group">
                        <div className="w-12 h-12 bg-[#1877F2] rounded-xl flex items-center justify-center relative shadow-lg shadow-blue-900/20 logo-icon overflow-hidden">
                            <svg width="100%" height="100%" viewBox="0 0 50 50" className="absolute inset-0">
                                <circle cx="18" cy="20" r="3.5" fill="#ffffff" />
                                <circle cx="32" cy="18" r="3.5" fill="#ffffff" />
                                <path className="logo-smile" d="M 12 30 Q 25 42 38 30" stroke="#ffffff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="font-extrabold text-2xl tracking-tight leading-none">
                                <span className="text-white">Product</span><span className="text-[#1877F2]">Praat</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase mt-0.5">Eerlijk advies</span>
                        </div>
                    </div>
                    
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-2 font-semibold text-sm text-slate-300">
                        <button onClick={() => onNavigate('artikelen')} className={`py-2 px-4 rounded-lg transition flex items-center gap-2 ${activeView === 'artikelen' ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'}`}>
                            <i className="fas fa-newspaper text-xs"></i> Artikelen
                        </button>
                        <button onClick={() => onNavigate('bolshop')} className={`py-2 px-4 rounded-lg transition flex items-center gap-2 ${activeView === 'bolshop' || activeView === 'bolproduct' ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'}`}>
                            <i className="fas fa-shopping-bag text-xs"></i> Shop
                        </button>
                        <button onClick={() => onNavigate('about')} className={`py-2 px-4 rounded-lg transition ${activeView === 'about' ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'}`}>Over ons</button>
                        <button onClick={() => onNavigate('contact')} className={`py-2 px-4 rounded-lg transition ${activeView === 'contact' ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'}`}>Contact</button>
                    </div>
                </div>
            </div>

            {/* MOBILE MENU OVERLAY */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 bg-slate-950 pt-20 px-6 animate-fade-in md:hidden overflow-y-auto">
                    <div className="flex flex-col gap-6">
                        <div className="pb-4 border-b border-slate-800">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Navigatie</h4>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => { onNavigate('home'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left">Home</button>
                                <button onClick={() => { onNavigate('artikelen'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left flex items-center gap-2">
                                    <i className="fas fa-newspaper text-[#1877F2]"></i> Artikelen
                                </button>
                                <button onClick={() => { onNavigate('bolshop'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left flex items-center gap-2">
                                    <i className="fas fa-shopping-bag text-[#1877F2]"></i> Shop
                                </button>
                                <button onClick={() => { onNavigate('about'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left">Over ons</button>
                                <button onClick={() => { onNavigate('contact'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left">Contact</button>
                                <button onClick={() => { onNavigate('admin'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#1877F2] py-2 text-left">Admin Login</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

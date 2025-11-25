
import React, { useState, useRef } from 'react';
import { CATEGORIES } from '../types';

interface HeaderProps {
    onNavigate: (view: 'home' | 'admin' | 'about' | 'contact') => void;
    onSelectCategory: (categoryId: string) => void;
    activeView: string;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate, onSelectCategory, activeView }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsMenuOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = window.setTimeout(() => {
            setIsMenuOpen(false);
        }, 150);
    };

    const categoryGroups = [
        {
            title: "Beeld, Geluid & Smart",
            items: ['televisies', 'audio', 'laptops', 'smartphones']
        },
        {
            title: "Huishouden & Wonen",
            items: ['wasmachines', 'stofzuigers', 'smarthome', 'matrassen']
        },
        {
            title: "Keuken & Verzorging",
            items: ['airfryers', 'koffie', 'keuken', 'verzorging']
        }
    ];

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
                        <div 
                            className="relative group py-2"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <button 
                                className={`flex items-center gap-2 py-2 px-4 rounded-lg transition ${isMenuOpen ? 'text-white bg-slate-800' : 'hover:text-white hover:bg-slate-800/50'}`}
                            >
                                <i className="fas fa-bars text-xs"></i> Categorieën
                            </button>

                            {/* MEGA MENU DROPDOWN */}
                            {isMenuOpen && (
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-[800px] bg-slate-900 shadow-2xl shadow-black/50 rounded-2xl border border-slate-700 overflow-hidden animate-fade-in z-[100] mt-2">
                                    <div className="grid grid-cols-3 divide-x divide-slate-800 bg-slate-900">
                                        {categoryGroups.map((group, idx) => (
                                            <div key={idx} className="p-6">
                                                <h4 className="font-bold text-slate-100 text-xs uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                                                    {group.title}
                                                </h4>
                                                <ul className="space-y-2">
                                                    {group.items.map(catId => {
                                                        const cat = CATEGORIES[catId];
                                                        if (!cat) return null;
                                                        return (
                                                            <li key={catId}>
                                                                <button 
                                                                    onClick={() => {
                                                                        onSelectCategory(catId);
                                                                        setIsMenuOpen(false);
                                                                    }}
                                                                    className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800 group/item transition text-left"
                                                                >
                                                                    <div className="w-8 h-8 rounded-full bg-slate-800 text-[#1877F2] flex items-center justify-center text-sm group-hover/item:bg-[#1877F2] group-hover/item:text-white transition border border-slate-700 group-hover/item:border-[#1877F2]">
                                                                        <i className={`fas ${cat.icon}`}></i>
                                                                    </div>
                                                                    <span className="text-slate-400 font-medium group-hover/item:text-white text-sm">
                                                                        {cat.name}
                                                                    </span>
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                                        <span><i className="fas fa-check-circle text-green-500 mr-1"></i> Onafhankelijk getest</span>
                                        <span><i className="fas fa-bolt text-orange-500 mr-1"></i> Dagelijks nieuwe deals</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={() => onNavigate('home')} className="py-2 px-4 rounded-lg hover:text-white hover:bg-slate-800/50 transition">Expert Gidsen</button>
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
                                <button onClick={() => { onNavigate('home'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left">Home & Gidsen</button>
                                <button onClick={() => { onNavigate('about'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left">Over ons</button>
                                <button onClick={() => { onNavigate('contact'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-white py-2 text-left">Contact</button>
                                <button onClick={() => { onNavigate('admin'); setIsMobileMenuOpen(false); }} className="text-lg font-bold text-[#1877F2] py-2 text-left">Admin Login</button>
                            </div>
                        </div>

                        {categoryGroups.map((group, idx) => (
                            <div key={idx}>
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider">{group.title}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {group.items.map(catId => {
                                        const cat = CATEGORIES[catId];
                                        if (!cat) return null;
                                        return (
                                            <button 
                                                key={catId}
                                                onClick={() => { onSelectCategory(catId); setIsMobileMenuOpen(false); }}
                                                className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-3 rounded-xl active:scale-95 transition"
                                            >
                                                <i className={`fas ${cat.icon} text-[#1877F2]`}></i>
                                                <span className="text-sm text-slate-300 font-medium">{cat.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </header>
    );
};

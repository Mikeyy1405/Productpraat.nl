/**
 * Social Media Components
 * 
 * Social share buttons and social media links.
 * Only renders when the 'social_media' feature is enabled.
 */

import React from 'react';
import { useFeature, useFeatureToggle, useTemplate } from '../../../cms';

interface ShareData {
    url?: string;
    title?: string;
    description?: string;
    image?: string;
}

interface SocialShareProps {
    url?: string;
    title?: string;
    description?: string;
    platforms?: ('facebook' | 'twitter' | 'linkedin' | 'whatsapp' | 'email' | 'copy')[];
    variant?: 'buttons' | 'icons' | 'minimal';
    className?: string;
    onShare?: (platform: string) => void;
}

export const SocialShare: React.FC<SocialShareProps> = ({
    url = typeof window !== 'undefined' ? window.location.href : '',
    title = '',
    description = '',
    platforms = ['facebook', 'twitter', 'linkedin', 'whatsapp', 'email', 'copy'],
    variant = 'buttons',
    className = '',
    onShare
}) => {
    const enabled = useFeature('social_media');
    const { settings } = useFeatureToggle('social_media');
    const { type: templateType } = useTemplate();
    
    const [copied, setCopied] = React.useState(false);

    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);

    const shareLinks: Record<string, { url: string; icon: string; label: string; color: string }> = {
        facebook: {
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            icon: 'fa-facebook-f',
            label: 'Facebook',
            color: 'bg-[#1877F2] hover:bg-[#166FE5]'
        },
        twitter: {
            url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
            icon: 'fa-twitter',
            label: 'Twitter',
            color: 'bg-[#1DA1F2] hover:bg-[#1A91DA]'
        },
        linkedin: {
            url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
            icon: 'fa-linkedin-in',
            label: 'LinkedIn',
            color: 'bg-[#0A66C2] hover:bg-[#095196]'
        },
        whatsapp: {
            url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
            icon: 'fa-whatsapp',
            label: 'WhatsApp',
            color: 'bg-[#25D366] hover:bg-[#20BD5A]'
        },
        email: {
            url: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
            icon: 'fa-envelope',
            label: 'Email',
            color: 'bg-slate-600 hover:bg-slate-500'
        },
        copy: {
            url: '',
            icon: copied ? 'fa-check' : 'fa-link',
            label: copied ? 'Gekopieerd!' : 'Kopieer link',
            color: copied ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'
        }
    };

    const handleShare = (platform: string) => {
        if (platform === 'copy') {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else {
            window.open(shareLinks[platform].url, '_blank', 'width=600,height=400');
        }
        onShare?.(platform);
    };

    if (!enabled) return null;

    // Minimal variant (just icons)
    if (variant === 'minimal') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                {platforms.map(platform => (
                    <button
                        key={platform}
                        onClick={() => handleShare(platform)}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                        title={shareLinks[platform].label}
                    >
                        <i className={`fab ${shareLinks[platform].icon}`}></i>
                    </button>
                ))}
            </div>
        );
    }

    // Icons variant
    if (variant === 'icons') {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <span className="text-sm text-slate-400">Delen:</span>
                {platforms.map(platform => (
                    <button
                        key={platform}
                        onClick={() => handleShare(platform)}
                        className={`w-10 h-10 rounded-lg ${shareLinks[platform].color} text-white flex items-center justify-center transition`}
                        title={shareLinks[platform].label}
                    >
                        <i className={`${platform === 'email' ? 'fas' : 'fab'} ${shareLinks[platform].icon}`}></i>
                    </button>
                ))}
            </div>
        );
    }

    // Buttons variant (default)
    return (
        <div className={`${className}`}>
            <div className="text-sm text-slate-400 mb-3">Deel dit artikel:</div>
            <div className="flex flex-wrap gap-2">
                {platforms.map(platform => (
                    <button
                        key={platform}
                        onClick={() => handleShare(platform)}
                        className={`${shareLinks[platform].color} text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition`}
                    >
                        <i className={`${platform === 'email' || platform === 'copy' ? 'fas' : 'fab'} ${shareLinks[platform].icon}`}></i>
                        <span>{shareLinks[platform].label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

interface SocialLinksProps {
    links?: {
        facebook?: string;
        twitter?: string;
        instagram?: string;
        linkedin?: string;
        youtube?: string;
        tiktok?: string;
    };
    variant?: 'icons' | 'buttons' | 'minimal';
    className?: string;
}

export const SocialLinks: React.FC<SocialLinksProps> = ({
    links = {},
    variant = 'icons',
    className = ''
}) => {
    const enabled = useFeature('social_media');
    const { type: templateType } = useTemplate();

    const socialPlatforms: Record<string, { icon: string; label: string; color: string }> = {
        facebook: { icon: 'fa-facebook-f', label: 'Facebook', color: 'hover:text-[#1877F2]' },
        twitter: { icon: 'fa-twitter', label: 'Twitter', color: 'hover:text-[#1DA1F2]' },
        instagram: { icon: 'fa-instagram', label: 'Instagram', color: 'hover:text-[#E4405F]' },
        linkedin: { icon: 'fa-linkedin-in', label: 'LinkedIn', color: 'hover:text-[#0A66C2]' },
        youtube: { icon: 'fa-youtube', label: 'YouTube', color: 'hover:text-[#FF0000]' },
        tiktok: { icon: 'fa-tiktok', label: 'TikTok', color: 'hover:text-white' }
    };

    const activeLinks = Object.entries(links).filter(([_, url]) => url);

    if (!enabled || activeLinks.length === 0) return null;

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {variant !== 'minimal' && (
                <span className="text-sm text-slate-400">Volg ons:</span>
            )}
            {activeLinks.map(([platform, url]) => (
                <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center transition ${socialPlatforms[platform]?.color}`}
                    title={socialPlatforms[platform]?.label}
                >
                    <i className={`fab ${socialPlatforms[platform]?.icon}`}></i>
                </a>
            ))}
        </div>
    );
};

export default SocialShare;

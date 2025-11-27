/**
 * WritgoCMS Features - Main Export
 * 
 * Central export file for all feature components.
 */

// Search
export { SearchBar, SearchResults } from './search';

// FAQ
export { FAQSection } from './faq';
export type { FAQItem } from './faq';

// Testimonials
export { TestimonialCarousel, TestimonialCard, TestimonialGrid, saveTestimonials } from './testimonials';
export type { Testimonial } from './testimonials';

// Contact
export { ContactForm, loadContactSubmissions } from './contact';

// Newsletter
export { NewsletterForm, loadNewsletterSubscribers, unsubscribeNewsletter } from './newsletter';

// Comments
export { CommentSection, loadComments, saveComments } from './comments';
export type { Comment } from './comments';

// Social
export { SocialShare, SocialLinks } from './social';

// Commerce
export { 
    ProductReviews, 
    ReviewForm, 
    StarRating, 
    loadProductReviews, 
    saveProductReviews 
} from './commerce';
export type { ProductReview } from './commerce';

export { 
    WishlistButton, 
    WishlistCounter, 
    WishlistPage, 
    loadWishlist, 
    saveWishlist, 
    addToWishlist, 
    removeFromWishlist, 
    isInWishlist 
} from './commerce';
export type { WishlistItem } from './commerce';

export { 
    InventoryBadge, 
    StockIndicator, 
    loadInventory, 
    saveInventory, 
    updateStockLevel, 
    setStockLevel, 
    getStockInfo 
} from './commerce';
export type { InventoryInfo } from './commerce';

export { PaymentFlow, PaymentMethodSelector, loadOrders } from './commerce';

// SEO
export { SEOHead, StructuredData, Breadcrumbs, SEOSettingsEditor } from './seo';

// Analytics
export { AnalyticsTracker, AnalyticsDashboard, trackPageView, trackEvent, loadAnalyticsData } from './analytics';

// Language
export { LanguageSelector, LanguageProvider, useLanguage } from './language';

// Auth
export { LoginForm, RegisterForm, UserProfile, getCurrentUser, loadUsers } from './auth';
export type { User } from './auth';

// Blog
export { BlogGrid, BlogPostView, BlogCategories, loadBlogPosts, saveBlogPosts } from './blog';
export type { BlogPost } from './blog';

/**
 * Automation Types
 * 
 * Type definitions for the Automation Control Dashboard.
 * Contains all interfaces for automation configuration and settings.
 * 
 * @module types/automationTypes
 */

import { AffiliateNetworkId } from '../types';

// ============================================================================
// PRODUCT GENERATION SETTINGS
// ============================================================================

export interface ProductGenerationSettings {
    /** Enable/disable automatic product generation */
    enabled: boolean;
    /** Number of products to generate per day (0-10) */
    productsPerDay: number;
    /** Categories to include in product generation */
    categories: string[];
    /** Preferred time for product generation (HH:MM format) */
    preferredTime: string;
}

// ============================================================================
// CONTENT GENERATION SETTINGS
// ============================================================================

export type ContentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type ContentType = 'guides' | 'comparisons' | 'toplists' | 'blogs';

export interface ContentGenerationSettings {
    /** Enable/disable automatic content generation */
    enabled: boolean;
    /** Frequency of content generation */
    frequency: ContentFrequency;
    /** Types of content to generate */
    contentTypes: ContentType[];
    /** Number of posts per week (1-7) */
    postsPerWeek: number;
    /** Preferred days for content generation (0=Sunday, 1=Monday, etc.) */
    preferredDays: number[];
}

// ============================================================================
// LINK MONITORING SETTINGS
// ============================================================================

export type CheckFrequency = 'hourly' | 'daily' | 'weekly';

export interface LinkMonitoringSettings {
    /** Enable/disable link monitoring */
    enabled: boolean;
    /** Frequency of link health checks */
    checkFrequency: CheckFrequency;
    /** Automatically fix broken links when alternatives are available */
    autoFix: boolean;
    /** Send notifications when broken links are detected */
    notifications: boolean;
}

// ============================================================================
// COMMISSION TRACKING SETTINGS
// ============================================================================

export type SyncFrequency = 'hourly' | 'daily' | 'weekly';

export interface CommissionTrackingSettings {
    /** Enable/disable commission tracking */
    enabled: boolean;
    /** Frequency of commission data sync */
    syncFrequency: SyncFrequency;
    /** Networks to track commissions from */
    networks: AffiliateNetworkId[];
}

// ============================================================================
// NOTIFICATION SETTINGS
// ============================================================================

export type AlertType = 
    | 'broken_links'
    | 'low_conversion'
    | 'high_earnings'
    | 'content_published'
    | 'product_generated'
    | 'error_occurred';

export interface NotificationSettings {
    /** Email address for notifications */
    email: string;
    /** Types of alerts to receive */
    alertTypes: AlertType[];
    /** Enable/disable email notifications */
    emailEnabled: boolean;
}

// ============================================================================
// PERFORMANCE OPTIMIZATION SETTINGS
// ============================================================================

export interface PerformanceSettings {
    /** Enable caching for better performance */
    enableCaching: boolean;
    /** Enable lazy loading of images */
    enableLazyLoading: boolean;
    /** Enable image optimization */
    enableImageOptimization: boolean;
    /** Minimum conversion rate threshold (%) */
    minConversionRate: number;
    /** Auto-remove products with low performance */
    autoRemoveLowPerformers: boolean;
}

// ============================================================================
// MAIN AUTOMATION CONFIG
// ============================================================================

export interface AutomationConfig {
    /** Unique identifier for the config */
    id?: string;
    /** Master switch to enable/disable all automation */
    masterEnabled: boolean;
    /** Product generation settings */
    productGeneration: ProductGenerationSettings;
    /** Content generation settings */
    contentGeneration: ContentGenerationSettings;
    /** Link monitoring settings */
    linkMonitoring: LinkMonitoringSettings;
    /** Commission tracking settings */
    commissionTracking: CommissionTrackingSettings;
    /** Notification preferences */
    notifications: NotificationSettings;
    /** Performance optimization settings */
    performance: PerformanceSettings;
    /** Timestamp of last update */
    updatedAt?: string;
}

// ============================================================================
// AUTOMATION STATUS
// ============================================================================

export interface AutomationJobStatus {
    /** Last run timestamp */
    lastRun: string | null;
    /** Current status */
    status: 'idle' | 'running' | 'completed' | 'failed';
    /** Next scheduled run */
    nextRun: string | null;
    /** Last error message if failed */
    lastError?: string;
}

export interface AutomationStatus {
    /** Whether automation is currently enabled */
    enabled: boolean;
    /** Status of each job */
    jobs: {
        productGeneration: AutomationJobStatus;
        contentGeneration: AutomationJobStatus;
        linkHealthCheck: AutomationJobStatus;
        commissionSync: AutomationJobStatus;
    };
    /** Current configuration */
    config: AutomationConfig;
}

// ============================================================================
// AUTOMATION RESULTS
// ============================================================================

export interface AutomationResult {
    /** Number of successful operations */
    success: number;
    /** Number of failed operations */
    failed: number;
    /** Details of what was processed */
    details?: string[];
    /** Timestamp of the run */
    timestamp: string;
    /** Duration in milliseconds */
    durationMs: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationError {
    /** Field that has an error */
    field: string;
    /** Error message */
    message: string;
}

export interface ValidationResult {
    /** Whether the config is valid */
    isValid: boolean;
    /** List of validation errors */
    errors: ValidationError[];
}

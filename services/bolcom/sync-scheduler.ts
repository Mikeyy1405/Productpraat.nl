/**
 * Bol.com Sync Scheduler
 * 
 * Manages scheduled sync jobs for Bol.com product data.
 * Uses node-cron compatible syntax for scheduling.
 * 
 * @module services/bolcom/sync-scheduler
 */

import { bolSyncService } from './sync';
import { SyncJob, SyncConfig } from '../../types/bolcom';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Scheduled task configuration
 */
interface ScheduledTask {
    id: string;
    name: string;
    cronExpression: string;
    handler: () => Promise<SyncJob | SyncJob[]>;
    lastRun?: string;
    nextRun?: string;
    isRunning: boolean;
    enabled: boolean;
}

/**
 * Scheduler state
 */
interface SchedulerState {
    isRunning: boolean;
    tasks: ScheduledTask[];
    lastUpdate: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get environment variable value
 */
const getEnvVar = (key: string, defaultValue: string): string => {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] || defaultValue;
    }
    return defaultValue;
};

/**
 * Parse cron expression to get next run time (simplified)
 * This is a basic implementation - in production, use a proper cron parser
 */
function getNextRunTime(cronExpression: string): Date {
    // For now, return a rough estimate based on common patterns
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    // Daily at specific hour: "0 2 * * *" = 2:00 AM
    if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        const hour = parseInt(parts[1], 10);
        const next = new Date(now);
        next.setHours(hour, parseInt(parts[0], 10), 0, 0);
        if (next <= now) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }
    
    // Hourly: "0 * * * *"
    if (parts[1] === '*') {
        const next = new Date(now);
        next.setMinutes(parseInt(parts[0], 10), 0, 0);
        if (next <= now) {
            next.setHours(next.getHours() + 1);
        }
        return next;
    }
    
    // Every N minutes: "*/15 * * * *"
    if (parts[0].startsWith('*/')) {
        const interval = parseInt(parts[0].substring(2), 10);
        const next = new Date(now);
        const currentMinutes = next.getMinutes();
        const nextMinutes = Math.ceil(currentMinutes / interval) * interval;
        next.setMinutes(nextMinutes, 0, 0);
        if (next <= now) {
            next.setMinutes(next.getMinutes() + interval);
        }
        return next;
    }
    
    // Default: next hour
    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
}

// ============================================================================
// SCHEDULER
// ============================================================================

/**
 * Scheduler state
 */
let schedulerState: SchedulerState = {
    isRunning: false,
    tasks: [],
    lastUpdate: new Date().toISOString(),
};

/**
 * Timer references for cleanup
 */
let schedulerTimers: NodeJS.Timeout[] = [];

/**
 * Default category IDs to sync
 */
const DEFAULT_CATEGORY_IDS = [
    '11652', // Elektronica
    '13512', // Computer & Gaming
    '21328', // Telefonie & Navigatie
    '15452', // TV & Audio
    '15457', // Huishouden
    '13640', // Wonen & Slapen
    '13492', // Tuin
    '14656', // Klussen & Gereedschap
];

/**
 * Bol.com Sync Scheduler
 */
export const bolSyncScheduler = {
    /**
     * Get current scheduler state
     */
    getState(): SchedulerState {
        return { ...schedulerState };
    },

    /**
     * Initialize scheduler with default tasks
     */
    initialize(): void {
        console.log('[BolScheduler] Initializing scheduler');
        
        const config = bolSyncService.getConfig();
        
        // Clear existing state
        schedulerState.tasks = [];
        
        // Add scheduled tasks
        schedulerState.tasks = [
            {
                id: 'popular-products',
                name: 'Populaire producten synchroniseren',
                cronExpression: getEnvVar('CRON_POPULAR_SYNC_TIME', '0 2 * * *'), // Daily at 2 AM
                handler: async () => {
                    const categoryIds = getEnvVar('SYNC_CATEGORY_IDS', DEFAULT_CATEGORY_IDS.join(','))
                        .split(',')
                        .map(s => s.trim());
                    return bolSyncService.runFullSync(categoryIds);
                },
                isRunning: false,
                enabled: config.enabled,
            },
            {
                id: 'price-update',
                name: 'Prijzen & voorraad updaten',
                cronExpression: getEnvVar('CRON_PRICE_UPDATE_TIME', '0 * * * *'), // Every hour
                handler: async () => bolSyncService.updatePricesAndStock(),
                isRunning: false,
                enabled: config.enabled,
            },
            {
                id: 'deal-detection',
                name: 'Deals detecteren',
                cronExpression: getEnvVar('CRON_DEAL_DETECTION_TIME', '*/15 * * * *'), // Every 15 minutes
                handler: async () => bolSyncService.detectDeals(),
                isRunning: false,
                enabled: config.enabled,
            },
            {
                id: 'rating-update',
                name: 'Ratings updaten',
                cronExpression: getEnvVar('CRON_RATING_UPDATE_TIME', '0 3 * * *'), // Daily at 3 AM
                handler: async () => bolSyncService.updateRatings(),
                isRunning: false,
                enabled: config.enabled,
            },
        ];
        
        // Calculate next run times
        for (const task of schedulerState.tasks) {
            task.nextRun = getNextRunTime(task.cronExpression).toISOString();
        }
        
        schedulerState.lastUpdate = new Date().toISOString();
        
        console.log(`[BolScheduler] Initialized with ${schedulerState.tasks.length} tasks`);
    },

    /**
     * Start the scheduler
     */
    start(): void {
        if (schedulerState.isRunning) {
            console.warn('[BolScheduler] Scheduler is already running');
            return;
        }
        
        console.log('[BolScheduler] Starting scheduler');
        
        // Initialize if not already done
        if (schedulerState.tasks.length === 0) {
            this.initialize();
        }
        
        schedulerState.isRunning = true;
        
        // Set up a check interval (every minute)
        const checkInterval = setInterval(() => {
            this.checkAndRunTasks();
        }, 60 * 1000); // Check every minute
        
        schedulerTimers.push(checkInterval);
        
        // Initial check
        this.checkAndRunTasks();
        
        console.log('[BolScheduler] Scheduler started');
    },

    /**
     * Stop the scheduler
     */
    stop(): void {
        console.log('[BolScheduler] Stopping scheduler');
        
        schedulerState.isRunning = false;
        
        // Clear all timers
        for (const timer of schedulerTimers) {
            clearInterval(timer);
        }
        schedulerTimers = [];
        
        console.log('[BolScheduler] Scheduler stopped');
    },

    /**
     * Check and run due tasks
     */
    async checkAndRunTasks(): Promise<void> {
        if (!schedulerState.isRunning) {
            return;
        }
        
        const now = new Date();
        
        for (const task of schedulerState.tasks) {
            if (!task.enabled || task.isRunning) {
                continue;
            }
            
            const nextRun = task.nextRun ? new Date(task.nextRun) : null;
            
            if (nextRun && nextRun <= now) {
                console.log(`[BolScheduler] Running task: ${task.name}`);
                
                task.isRunning = true;
                
                try {
                    await task.handler();
                    task.lastRun = now.toISOString();
                } catch (error) {
                    console.error(`[BolScheduler] Task failed: ${task.name}`, error);
                } finally {
                    task.isRunning = false;
                    task.nextRun = getNextRunTime(task.cronExpression).toISOString();
                }
            }
        }
        
        schedulerState.lastUpdate = now.toISOString();
    },

    /**
     * Run a specific task immediately
     * 
     * @param taskId - Task ID to run
     * @returns Task result or null if not found
     */
    async runTask(taskId: string): Promise<SyncJob | SyncJob[] | null> {
        const task = schedulerState.tasks.find(t => t.id === taskId);
        
        if (!task) {
            console.warn(`[BolScheduler] Task not found: ${taskId}`);
            return null;
        }
        
        if (task.isRunning) {
            console.warn(`[BolScheduler] Task is already running: ${taskId}`);
            return null;
        }
        
        console.log(`[BolScheduler] Manually running task: ${task.name}`);
        
        task.isRunning = true;
        
        try {
            const result = await task.handler();
            task.lastRun = new Date().toISOString();
            return result;
        } catch (error) {
            console.error(`[BolScheduler] Manual task failed: ${task.name}`, error);
            throw error;
        } finally {
            task.isRunning = false;
            task.nextRun = getNextRunTime(task.cronExpression).toISOString();
        }
    },

    /**
     * Enable or disable a task
     * 
     * @param taskId - Task ID
     * @param enabled - Whether to enable or disable
     */
    setTaskEnabled(taskId: string, enabled: boolean): void {
        const task = schedulerState.tasks.find(t => t.id === taskId);
        
        if (task) {
            task.enabled = enabled;
            console.log(`[BolScheduler] Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
        }
    },

    /**
     * Get task by ID
     * 
     * @param taskId - Task ID
     * @returns Task or undefined
     */
    getTask(taskId: string): ScheduledTask | undefined {
        return schedulerState.tasks.find(t => t.id === taskId);
    },

    /**
     * Get all tasks
     */
    getTasks(): ScheduledTask[] {
        return [...schedulerState.tasks];
    },

    /**
     * Update task cron expression
     * 
     * @param taskId - Task ID
     * @param cronExpression - New cron expression
     */
    updateTaskSchedule(taskId: string, cronExpression: string): void {
        const task = schedulerState.tasks.find(t => t.id === taskId);
        
        if (task) {
            task.cronExpression = cronExpression;
            task.nextRun = getNextRunTime(cronExpression).toISOString();
            console.log(`[BolScheduler] Task ${taskId} schedule updated to: ${cronExpression}`);
        }
    },
};

export default bolSyncScheduler;

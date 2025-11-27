/**
 * Alert System Service
 * 
 * Handles error notifications, critical issue alerts, and automatic retry logic
 * for failed automated tasks.
 * 
 * @module services/alertSystem
 */

import { getSupabase } from './supabaseClient';
import type { JobName } from './automationLogger';

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
    id?: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    job_name?: JobName;
    created_at: string;
    acknowledged: boolean;
    acknowledged_at?: string;
    metadata?: Record<string, unknown>;
}

export interface RetryTask {
    id: string;
    job_name: JobName;
    original_error: string;
    retry_count: number;
    max_retries: number;
    next_retry_at: string;
    status: 'pending' | 'retrying' | 'succeeded' | 'exhausted';
    created_at: string;
}

export interface AlertConfig {
    emailEnabled: boolean;
    emailRecipients: string[];
    slackEnabled: boolean;
    slackWebhookUrl?: string;
    minSeverityForEmail: AlertSeverity;
    maxRetriesPerTask: number;
    retryDelayMinutes: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: AlertConfig = {
    emailEnabled: false,
    emailRecipients: [],
    slackEnabled: false,
    slackWebhookUrl: undefined,
    minSeverityForEmail: 'error',
    maxRetriesPerTask: 3,
    retryDelayMinutes: 5
};

const SEVERITY_LEVELS: Record<AlertSeverity, number> = {
    info: 0,
    warning: 1,
    error: 2,
    critical: 3
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for records
 */
const generateId = (): string => {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Get environment variable value
 */
const getEnvVar = (key: string): string => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || '';
    }
    return '';
};

/**
 * Load alert configuration from environment/database
 */
export const loadAlertConfig = async (): Promise<AlertConfig> => {
    const config = { ...DEFAULT_CONFIG };
    
    // Load from environment variables
    const slackWebhook = getEnvVar('SLACK_WEBHOOK_URL');
    if (slackWebhook) {
        config.slackEnabled = true;
        config.slackWebhookUrl = slackWebhook;
    }

    const emailRecipients = getEnvVar('ALERT_EMAIL_RECIPIENTS');
    if (emailRecipients) {
        config.emailEnabled = true;
        config.emailRecipients = emailRecipients.split(',').map(e => e.trim());
    }

    const maxRetries = getEnvVar('AUTOMATION_MAX_RETRIES');
    if (maxRetries) {
        config.maxRetriesPerTask = parseInt(maxRetries, 10) || 3;
    }

    return config;
};

// ============================================================================
// ALERT FUNCTIONS
// ============================================================================

/**
 * Create and store an alert
 */
export const createAlert = async (
    severity: AlertSeverity,
    title: string,
    message: string,
    jobName?: JobName,
    metadata?: Record<string, unknown>
): Promise<Alert> => {
    const alert: Alert = {
        id: generateId(),
        severity,
        title,
        message,
        job_name: jobName,
        created_at: new Date().toISOString(),
        acknowledged: false,
        metadata
    };

    // Log to console
    const logFn = severity === 'critical' || severity === 'error' ? console.error : console.warn;
    logFn(`[AlertSystem] [${severity.toUpperCase()}] ${title}: ${message}`);

    const supabase = getSupabase();
    if (supabase) {
        try {
            await supabase
                .from('automation_alerts')
                .insert(alert);
        } catch (error) {
            console.error('[AlertSystem] Error storing alert:', error);
        }
    }

    // Send notifications based on severity
    const config = await loadAlertConfig();
    if (SEVERITY_LEVELS[severity] >= SEVERITY_LEVELS[config.minSeverityForEmail]) {
        if (config.emailEnabled) {
            await sendEmailAlert(title, message, config.emailRecipients);
        }
        if (config.slackEnabled && config.slackWebhookUrl) {
            await sendSlackNotification(message, severity);
        }
    }

    return alert;
};

/**
 * Send an email alert
 * 
 * Note: This is a stub implementation. In production, integrate with
 * a transactional email service like SendGrid, Mailgun, or AWS SES.
 */
export const sendEmailAlert = async (
    subject: string,
    message: string,
    recipients?: string[]
): Promise<boolean> => {
    const config = await loadAlertConfig();
    const emailList = recipients || config.emailRecipients;

    if (emailList.length === 0) {
        console.log('[AlertSystem] No email recipients configured');
        return false;
    }

    // TODO: Implement actual email sending
    // Example with SendGrid:
    // await sgMail.send({
    //     to: emailList,
    //     from: 'noreply@productpraat.nl',
    //     subject: `[ProductPraat Alert] ${subject}`,
    //     text: message,
    //     html: `<h2>${subject}</h2><p>${message}</p>`
    // });

    console.log(`[AlertSystem] Email alert would be sent to: ${emailList.join(', ')}`);
    console.log(`[AlertSystem] Subject: ${subject}`);
    console.log(`[AlertSystem] Message: ${message}`);

    return true;
};

/**
 * Send a Slack notification
 * 
 * Uses Slack Incoming Webhooks for simple notifications.
 */
export const sendSlackNotification = async (
    message: string,
    severity: AlertSeverity = 'info'
): Promise<boolean> => {
    const config = await loadAlertConfig();

    if (!config.slackEnabled || !config.slackWebhookUrl) {
        console.log('[AlertSystem] Slack not configured');
        return false;
    }

    const emoji = {
        info: ':information_source:',
        warning: ':warning:',
        error: ':x:',
        critical: ':rotating_light:'
    }[severity];

    const color = {
        info: '#0066cc',
        warning: '#ffcc00',
        error: '#ff0000',
        critical: '#990000'
    }[severity];

    try {
        const payload = {
            attachments: [{
                color,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${emoji} *ProductPraat Automation Alert*\n${message}`
                        }
                    },
                    {
                        type: 'context',
                        elements: [{
                            type: 'mrkdwn',
                            text: `Severity: ${severity.toUpperCase()} | Time: ${new Date().toISOString()}`
                        }]
                    }
                ]
            }]
        };

        const response = await fetch(config.slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Slack API returned ${response.status}`);
        }

        console.log('[AlertSystem] Slack notification sent successfully');
        return true;

    } catch (error) {
        console.error('[AlertSystem] Failed to send Slack notification:', error);
        return false;
    }
};

// ============================================================================
// ERROR HANDLING & RETRY LOGIC
// ============================================================================

/**
 * Handle a cron job failure
 */
export const handleCronJobFailure = async (
    jobName: JobName,
    error: Error | string
): Promise<RetryTask | null> => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const config = await loadAlertConfig();

    // Create an alert
    await createAlert(
        'error',
        `Cron Job Failed: ${jobName}`,
        errorMessage,
        jobName,
        { errorStack: error instanceof Error ? error.stack : undefined }
    );

    // Create retry task
    const supabase = getSupabase();
    if (!supabase) {
        return null;
    }

    try {
        const nextRetryAt = new Date();
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + config.retryDelayMinutes);

        const retryTask: RetryTask = {
            id: generateId(),
            job_name: jobName,
            original_error: errorMessage,
            retry_count: 0,
            max_retries: config.maxRetriesPerTask,
            next_retry_at: nextRetryAt.toISOString(),
            status: 'pending',
            created_at: new Date().toISOString()
        };

        await supabase
            .from('retry_tasks')
            .insert(retryTask);

        console.log(`[AlertSystem] Retry task created for ${jobName}, next retry at ${nextRetryAt.toISOString()}`);
        return retryTask;

    } catch (err) {
        console.error('[AlertSystem] Error creating retry task:', err);
        return null;
    }
};

/**
 * Retry a failed task
 */
export const retryFailedTask = async (
    taskId: string,
    taskExecutor: () => Promise<void>
): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        return false;
    }

    try {
        // Get the retry task
        const { data: task, error: fetchError } = await supabase
            .from('retry_tasks')
            .select('*')
            .eq('id', taskId)
            .single();

        if (fetchError || !task) {
            console.error('[AlertSystem] Retry task not found:', taskId);
            return false;
        }

        if (task.status === 'succeeded' || task.status === 'exhausted') {
            console.log(`[AlertSystem] Task ${taskId} already ${task.status}`);
            return false;
        }

        if (task.retry_count >= task.max_retries) {
            await supabase
                .from('retry_tasks')
                .update({ status: 'exhausted' })
                .eq('id', taskId);

            await createAlert(
                'critical',
                `Task Retry Exhausted: ${task.job_name}`,
                `Task failed after ${task.max_retries} retries. Original error: ${task.original_error}`,
                task.job_name
            );

            return false;
        }

        // Update status to retrying
        await supabase
            .from('retry_tasks')
            .update({ status: 'retrying' })
            .eq('id', taskId);

        console.log(`[AlertSystem] Retrying task ${taskId} (attempt ${task.retry_count + 1}/${task.max_retries})`);

        try {
            await taskExecutor();

            // Success - update task
            await supabase
                .from('retry_tasks')
                .update({ status: 'succeeded' })
                .eq('id', taskId);

            console.log(`[AlertSystem] Task ${taskId} succeeded on retry`);
            return true;

        } catch (retryError) {
            // Failed again - schedule next retry
            const config = await loadAlertConfig();
            const nextRetryAt = new Date();
            nextRetryAt.setMinutes(nextRetryAt.getMinutes() + config.retryDelayMinutes * (task.retry_count + 2));

            await supabase
                .from('retry_tasks')
                .update({
                    status: 'pending',
                    retry_count: task.retry_count + 1,
                    next_retry_at: nextRetryAt.toISOString(),
                    original_error: retryError instanceof Error ? retryError.message : String(retryError)
                })
                .eq('id', taskId);

            console.log(`[AlertSystem] Task ${taskId} failed again, next retry at ${nextRetryAt.toISOString()}`);
            return false;
        }

    } catch (error) {
        console.error('[AlertSystem] Error in retryFailedTask:', error);
        return false;
    }
};

/**
 * Process all pending retry tasks
 */
export const processPendingRetries = async (
    taskExecutors: Record<JobName, () => Promise<void>>
): Promise<{ processed: number; succeeded: number; failed: number }> => {
    const supabase = getSupabase();
    const results = { processed: 0, succeeded: 0, failed: 0 };

    if (!supabase) {
        return results;
    }

    try {
        const now = new Date().toISOString();

        const { data: pendingTasks } = await supabase
            .from('retry_tasks')
            .select('*')
            .eq('status', 'pending')
            .lte('next_retry_at', now);

        if (!pendingTasks || pendingTasks.length === 0) {
            return results;
        }

        console.log(`[AlertSystem] Processing ${pendingTasks.length} pending retry tasks`);

        for (const task of pendingTasks) {
            const executor = taskExecutors[task.job_name as JobName];
            if (!executor) {
                console.warn(`[AlertSystem] No executor for job: ${task.job_name}`);
                continue;
            }

            results.processed++;
            const success = await retryFailedTask(task.id, executor);
            
            if (success) {
                results.succeeded++;
            } else {
                results.failed++;
            }
        }

        console.log(`[AlertSystem] Retry processing complete: ${results.succeeded}/${results.processed} succeeded`);
        return results;

    } catch (error) {
        console.error('[AlertSystem] Error processing pending retries:', error);
        return results;
    }
};

// ============================================================================
// ALERT MANAGEMENT
// ============================================================================

/**
 * Get unacknowledged alerts
 */
export const getUnacknowledgedAlerts = async (): Promise<Alert[]> => {
    const supabase = getSupabase();

    if (!supabase) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('automation_alerts')
            .select('*')
            .eq('acknowledged', false)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('[AlertSystem] Error fetching alerts:', error);
            return [];
        }

        return data || [];

    } catch (error) {
        console.error('[AlertSystem] Error in getUnacknowledgedAlerts:', error);
        return [];
    }
};

/**
 * Acknowledge an alert
 */
export const acknowledgeAlert = async (alertId: string): Promise<boolean> => {
    const supabase = getSupabase();

    if (!supabase) {
        return false;
    }

    try {
        const { error } = await supabase
            .from('automation_alerts')
            .update({
                acknowledged: true,
                acknowledged_at: new Date().toISOString()
            })
            .eq('id', alertId);

        if (error) {
            console.error('[AlertSystem] Error acknowledging alert:', error);
            return false;
        }

        return true;

    } catch (error) {
        console.error('[AlertSystem] Error in acknowledgeAlert:', error);
        return false;
    }
};

/**
 * Get alert statistics
 */
export const getAlertStats = async (days: number = 7): Promise<{
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    unacknowledged: number;
}> => {
    const supabase = getSupabase();
    const stats = {
        total: 0,
        bySeverity: { info: 0, warning: 0, error: 0, critical: 0 } as Record<AlertSeverity, number>,
        unacknowledged: 0
    };

    if (!supabase) {
        return stats;
    }

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data } = await supabase
            .from('automation_alerts')
            .select('severity, acknowledged')
            .gte('created_at', startDate.toISOString());

        if (data) {
            stats.total = data.length;
            for (const alert of data) {
                stats.bySeverity[alert.severity as AlertSeverity]++;
                if (!alert.acknowledged) {
                    stats.unacknowledged++;
                }
            }
        }

        return stats;

    } catch (error) {
        console.error('[AlertSystem] Error in getAlertStats:', error);
        return stats;
    }
};

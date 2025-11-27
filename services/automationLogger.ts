/**
 * Automation Logger Service
 * 
 * Centralized logging for all automated tasks.
 * Tracks cron job executions, results, and generates daily reports.
 * 
 * @module services/automationLogger
 */

import { getSupabase } from './supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

export type JobName = 
    | 'link_health_check'
    | 'commission_sync'
    | 'content_generation'
    | 'content_publication'
    | 'performance_analysis';

export type JobStatus = 'started' | 'completed' | 'failed' | 'skipped';

export interface CronJobLog {
    id?: string;
    job_name: JobName;
    status: JobStatus;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    details?: Record<string, unknown>;
    error_message?: string;
}

export interface LinkCheckResults {
    total: number;
    working: number;
    broken: number;
    fixed: number;
}

export interface CommissionSyncResults {
    network: string;
    amount: number;
    recordsProcessed: number;
}

export interface ContentGenerationResults {
    type: string;
    category: string;
    success: boolean;
    articleId?: string;
}

export interface DailyReport {
    date: string;
    jobsRun: number;
    jobsSuccessful: number;
    jobsFailed: number;
    linkHealth: {
        total: number;
        working: number;
        broken: number;
        fixed: number;
    };
    commissions: {
        totalAmount: number;
        recordsProcessed: number;
        networks: string[];
    };
    content: {
        generated: number;
        published: number;
        categories: string[];
    };
    errors: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for log entries
 */
const generateId = (): string => {
    return `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Format duration for human readability
 */
const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
};

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

/**
 * Log cron job execution
 */
export const logCronJobExecution = async (
    jobName: JobName,
    status: JobStatus,
    duration: number,
    details?: Record<string, unknown>
): Promise<void> => {
    const supabase = getSupabase();
    const timestamp = new Date().toISOString();

    // Always log to console
    const logMessage = `[AutomationLogger] [${jobName}] ${status.toUpperCase()} - Duration: ${formatDuration(duration)}`;
    if (status === 'failed') {
        console.error(logMessage, details);
    } else {
        console.log(logMessage, details || '');
    }

    if (!supabase) {
        return;
    }

    try {
        const logEntry: CronJobLog = {
            id: generateId(),
            job_name: jobName,
            status,
            started_at: new Date(Date.now() - duration).toISOString(),
            completed_at: timestamp,
            duration_ms: duration,
            details,
            error_message: status === 'failed' && details?.error 
                ? String(details.error) 
                : undefined
        };

        const { error } = await supabase
            .from('automation_logs')
            .insert(logEntry);

        if (error) {
            console.error('[AutomationLogger] Error storing log:', error);
        }
    } catch (error) {
        console.error('[AutomationLogger] Error in logCronJobExecution:', error);
    }
};

/**
 * Log link check results
 */
export const logLinkCheckResults = async (
    total: number,
    working: number,
    broken: number,
    fixed: number
): Promise<void> => {
    const details: LinkCheckResults = { total, working, broken, fixed };
    
    console.log(`[AutomationLogger] Link Check Results: ${working}/${total} working, ${broken} broken, ${fixed} fixed`);

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        await supabase
            .from('automation_metrics')
            .insert({
                id: generateId(),
                metric_type: 'link_check',
                data: details,
                recorded_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('[AutomationLogger] Error logging link check results:', error);
    }
};

/**
 * Log commission sync results
 */
export const logCommissionSync = async (
    network: string,
    amount: number,
    recordsProcessed: number
): Promise<void> => {
    const details: CommissionSyncResults = { network, amount, recordsProcessed };
    
    console.log(`[AutomationLogger] Commission Sync [${network}]: €${amount.toFixed(2)}, ${recordsProcessed} records`);

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        await supabase
            .from('automation_metrics')
            .insert({
                id: generateId(),
                metric_type: 'commission_sync',
                data: details,
                recorded_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('[AutomationLogger] Error logging commission sync:', error);
    }
};

/**
 * Log content generation results
 */
export const logContentGeneration = async (
    type: string,
    category: string,
    success: boolean,
    articleId?: string
): Promise<void> => {
    const details: ContentGenerationResults = { type, category, success, articleId };
    
    if (success) {
        console.log(`[AutomationLogger] Content Generated: ${type} for ${category} (ID: ${articleId})`);
    } else {
        console.error(`[AutomationLogger] Content Generation Failed: ${type} for ${category}`);
    }

    const supabase = getSupabase();
    if (!supabase) return;

    try {
        await supabase
            .from('automation_metrics')
            .insert({
                id: generateId(),
                metric_type: 'content_generation',
                data: details,
                recorded_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('[AutomationLogger] Error logging content generation:', error);
    }
};

/**
 * Generate daily report of all automated tasks
 */
export const generateDailyReport = async (): Promise<DailyReport> => {
    const supabase = getSupabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const report: DailyReport = {
        date: todayStr,
        jobsRun: 0,
        jobsSuccessful: 0,
        jobsFailed: 0,
        linkHealth: { total: 0, working: 0, broken: 0, fixed: 0 },
        commissions: { totalAmount: 0, recordsProcessed: 0, networks: [] },
        content: { generated: 0, published: 0, categories: [] },
        errors: []
    };

    if (!supabase) {
        console.log('[AutomationLogger] Supabase not configured, returning empty report');
        return report;
    }

    try {
        // Get job logs from today
        const { data: logs } = await supabase
            .from('automation_logs')
            .select('*')
            .gte('started_at', todayStr);

        if (logs) {
            report.jobsRun = logs.length;
            report.jobsSuccessful = logs.filter(l => l.status === 'completed').length;
            report.jobsFailed = logs.filter(l => l.status === 'failed').length;
            report.errors = logs
                .filter(l => l.error_message)
                .map(l => l.error_message as string);
        }

        // Get metrics from today
        const { data: metrics } = await supabase
            .from('automation_metrics')
            .select('*')
            .gte('recorded_at', todayStr);

        if (metrics) {
            for (const metric of metrics) {
                const data = metric.data as Record<string, unknown>;
                
                switch (metric.metric_type) {
                    case 'link_check':
                        report.linkHealth.total += (data.total as number) || 0;
                        report.linkHealth.working += (data.working as number) || 0;
                        report.linkHealth.broken += (data.broken as number) || 0;
                        report.linkHealth.fixed += (data.fixed as number) || 0;
                        break;
                    case 'commission_sync':
                        report.commissions.totalAmount += (data.amount as number) || 0;
                        report.commissions.recordsProcessed += (data.recordsProcessed as number) || 0;
                        if (data.network && !report.commissions.networks.includes(data.network as string)) {
                            report.commissions.networks.push(data.network as string);
                        }
                        break;
                    case 'content_generation':
                        if (data.success) {
                            report.content.generated++;
                            if (data.category && !report.content.categories.includes(data.category as string)) {
                                report.content.categories.push(data.category as string);
                            }
                        }
                        break;
                }
            }
        }

        console.log('[AutomationLogger] Daily Report Generated:', {
            jobsRun: report.jobsRun,
            jobsSuccessful: report.jobsSuccessful,
            jobsFailed: report.jobsFailed
        });

        // Store the report
        await supabase
            .from('daily_reports')
            .upsert({
                id: `report-${todayStr.split('T')[0]}`,
                report_date: todayStr,
                data: report,
                created_at: new Date().toISOString()
            });

        return report;

    } catch (error) {
        console.error('[AutomationLogger] Error generating daily report:', error);
        return report;
    }
};

/**
 * Get recent logs for dashboard display
 */
export const getRecentLogs = async (limit: number = 50): Promise<CronJobLog[]> => {
    const supabase = getSupabase();

    if (!supabase) {
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('automation_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[AutomationLogger] Error fetching logs:', error);
            return [];
        }

        return (data || []).map(log => ({
            id: log.id,
            job_name: log.job_name,
            status: log.status,
            started_at: log.started_at,
            completed_at: log.completed_at,
            duration_ms: log.duration_ms,
            details: log.details,
            error_message: log.error_message
        }));

    } catch (error) {
        console.error('[AutomationLogger] Error in getRecentLogs:', error);
        return [];
    }
};

/**
 * Get job statistics for a time period
 */
export const getJobStats = async (days: number = 7): Promise<{
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    byJob: Record<JobName, { count: number; successRate: number }>;
}> => {
    const supabase = getSupabase();
    const stats = {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        byJob: {} as Record<JobName, { count: number; successRate: number }>
    };

    if (!supabase) {
        return stats;
    }

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
            .from('automation_logs')
            .select('*')
            .gte('started_at', startDate.toISOString());

        if (error || !data) {
            return stats;
        }

        stats.total = data.length;
        stats.successful = data.filter(l => l.status === 'completed').length;
        stats.failed = data.filter(l => l.status === 'failed').length;

        const totalDuration = data.reduce((sum, l) => sum + (l.duration_ms || 0), 0);
        stats.avgDuration = stats.total > 0 ? Math.round(totalDuration / stats.total) : 0;

        // Group by job name
        const jobGroups: Record<string, { total: number; successful: number }> = {};
        for (const log of data) {
            const jobName = log.job_name as JobName;
            if (!jobGroups[jobName]) {
                jobGroups[jobName] = { total: 0, successful: 0 };
            }
            jobGroups[jobName].total++;
            if (log.status === 'completed') {
                jobGroups[jobName].successful++;
            }
        }

        for (const [jobName, group] of Object.entries(jobGroups)) {
            stats.byJob[jobName as JobName] = {
                count: group.total,
                successRate: group.total > 0 
                    ? Math.round((group.successful / group.total) * 100) 
                    : 0
            };
        }

        return stats;

    } catch (error) {
        console.error('[AutomationLogger] Error in getJobStats:', error);
        return stats;
    }
};

/**
 * Clear old logs (retention policy)
 */
export const clearOldLogs = async (retentionDays: number = 30): Promise<number> => {
    const supabase = getSupabase();

    if (!supabase) {
        return 0;
    }

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const { data, error } = await supabase
            .from('automation_logs')
            .delete()
            .lt('started_at', cutoffDate.toISOString())
            .select('id');

        if (error) {
            console.error('[AutomationLogger] Error clearing old logs:', error);
            return 0;
        }

        const deletedCount = data?.length || 0;
        console.log(`[AutomationLogger] Cleared ${deletedCount} logs older than ${retentionDays} days`);
        return deletedCount;

    } catch (error) {
        console.error('[AutomationLogger] Error in clearOldLogs:', error);
        return 0;
    }
};

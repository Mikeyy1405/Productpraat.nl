/**
 * Playwright API Client
 *
 * Universal client for connecting to the central Playwright API service.
 * Can be used by any project to access browser automation features.
 *
 * @example
 * ```typescript
 * import { PlaywrightClient } from './playwright-client';
 *
 * const client = new PlaywrightClient({
 *   baseUrl: 'https://api.productpraat.nl/playwright',
 *   apiKey: 'pp_your_api_key_here',
 * });
 *
 * // Take a screenshot
 * const result = await client.screenshot('https://example.com');
 *
 * // Generate affiliate link
 * const link = await client.affiliate('https://www.bol.com/nl/p/product/123');
 *
 * // Scrape data
 * const data = await client.scrape('https://example.com', {
 *   title: 'h1',
 *   price: '.price',
 * });
 * ```
 *
 * @module vps-services/shared/playwright-client
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PlaywrightClientConfig {
    /** Base URL of the Playwright API */
    baseUrl: string;
    /** API key for authentication */
    apiKey: string;
    /** Request timeout in ms (default: 60000) */
    timeout?: number;
    /** Enable WebSocket for real-time updates */
    enableWebSocket?: boolean;
}

export interface TaskResult<T = unknown> {
    taskId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: T;
    error?: string;
    createdAt: string;
    completedAt?: string;
}

export interface ScreenshotResult {
    url: string;
    screenshot: string; // base64
    title: string;
}

export interface ScrapeResult {
    url: string;
    title: string;
    data: Record<string, string | null>;
}

export interface AffiliateResult {
    originalUrl: string;
    affiliateUrl: string;
    method: 'partner-plaza' | 'fallback';
}

export interface MediaResult {
    url: string;
    title: string;
    media: Array<{
        type: 'image' | 'video';
        url: string;
        highRes?: string;
    }>;
    count: number;
}

export interface LoginResult {
    success: boolean;
    sessionId?: string;
    expiresAt?: string;
    error?: string;
}

export interface HealthStatus {
    status: 'ok' | 'error';
    browser: 'running' | 'stopped';
    tasks: {
        running: number;
        queued: number;
        total: number;
    };
    uptime: number;
}

// ============================================================================
// CLIENT CLASS
// ============================================================================

export class PlaywrightClient {
    private config: Required<PlaywrightClientConfig>;
    private ws: WebSocket | null = null;
    private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

    constructor(config: PlaywrightClientConfig) {
        this.config = {
            baseUrl: config.baseUrl.replace(/\/$/, ''),
            apiKey: config.apiKey,
            timeout: config.timeout ?? 60000,
            enableWebSocket: config.enableWebSocket ?? false,
        };

        if (this.config.enableWebSocket) {
            this.connectWebSocket();
        }
    }

    // ==========================================================================
    // HTTP METHODS
    // ==========================================================================

    private async request<T>(
        method: 'GET' | 'POST' | 'DELETE',
        path: string,
        body?: unknown
    ): Promise<T> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(`${this.config.baseUrl}${path}`, {
                method,
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timeout');
            }

            throw error;
        }
    }

    // ==========================================================================
    // TASK METHODS
    // ==========================================================================

    /**
     * Create a new task and wait for completion
     */
    private async createAndWaitTask<T>(
        type: string,
        input: Record<string, unknown>,
        pollInterval = 1000,
        maxWait = 300000
    ): Promise<T> {
        // Create task
        const { taskId } = await this.request<{ taskId: string }>('POST', '/tasks', {
            type,
            input,
        });

        // Poll for completion
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            const task = await this.request<TaskResult<T>>('GET', `/tasks/${taskId}`);

            if (task.status === 'completed' && task.result) {
                return task.result;
            }

            if (task.status === 'failed') {
                throw new Error(task.error || 'Task failed');
            }

            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('Task timeout');
    }

    /**
     * Create a task and return immediately (async mode)
     */
    async createTask(type: string, input: Record<string, unknown>): Promise<string> {
        const { taskId } = await this.request<{ taskId: string }>('POST', '/tasks', {
            type,
            input,
        });
        return taskId;
    }

    /**
     * Get task status
     */
    async getTask<T = unknown>(taskId: string): Promise<TaskResult<T>> {
        return this.request('GET', `/tasks/${taskId}`);
    }

    /**
     * List recent tasks
     */
    async listTasks(): Promise<{ tasks: TaskResult[] }> {
        return this.request('GET', '/tasks');
    }

    // ==========================================================================
    // CONVENIENCE METHODS
    // ==========================================================================

    /**
     * Take a screenshot of a URL
     */
    async screenshot(
        url: string,
        options?: { fullPage?: boolean; selector?: string }
    ): Promise<ScreenshotResult> {
        return this.createAndWaitTask('screenshot', { url, ...options });
    }

    /**
     * Scrape data from a URL
     */
    async scrape(
        url: string,
        selectors: Record<string, string>,
        options?: { waitFor?: string }
    ): Promise<ScrapeResult> {
        return this.createAndWaitTask('scrape', { url, selectors, ...options });
    }

    /**
     * Generate an affiliate link
     */
    async affiliate(
        url: string,
        options?: { partnerId?: string; network?: string; sessionId?: string }
    ): Promise<AffiliateResult> {
        return this.createAndWaitTask('affiliate', { url, ...options });
    }

    /**
     * Get media from a product page
     */
    async media(url: string): Promise<MediaResult> {
        return this.createAndWaitTask('media', { url });
    }

    /**
     * Login to a website and save session
     */
    async login(options: {
        loginUrl: string;
        email: string;
        password: string;
        domain: string;
        emailSelector?: string;
        passwordSelector?: string;
        submitSelector?: string;
        successIndicator?: string;
    }): Promise<LoginResult> {
        return this.createAndWaitTask('login', options);
    }

    /**
     * Execute custom browser actions
     */
    async custom(
        url: string,
        actions: Array<{
            type: 'goto' | 'click' | 'fill' | 'wait' | 'screenshot' | 'extract';
            selector?: string;
            value?: string;
            timeout?: number;
        }>
    ): Promise<{ url: string; title: string; results: unknown[] }> {
        return this.createAndWaitTask('custom', { url, actions });
    }

    // ==========================================================================
    // SESSION METHODS
    // ==========================================================================

    /**
     * List available sessions
     */
    async listSessions(): Promise<{
        sessions: Array<{
            id: string;
            project: string;
            domain: string;
            createdAt: string;
            expiresAt: string;
        }>;
    }> {
        return this.request('GET', '/sessions');
    }

    /**
     * Delete a session
     */
    async deleteSession(sessionId: string): Promise<{ success: boolean }> {
        return this.request('DELETE', `/sessions/${sessionId}`);
    }

    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================

    /**
     * Check API health status
     */
    async health(): Promise<HealthStatus> {
        return this.request('GET', '/health');
    }

    /**
     * Check if the API is reachable
     */
    async ping(): Promise<boolean> {
        try {
            await this.health();
            return true;
        } catch {
            return false;
        }
    }

    // ==========================================================================
    // WEBSOCKET METHODS
    // ==========================================================================

    private connectWebSocket(): void {
        const wsUrl = this.config.baseUrl
            .replace('https://', 'wss://')
            .replace('http://', 'ws://');

        this.ws = new WebSocket(`${wsUrl}/ws?apiKey=${this.config.apiKey}`);

        this.ws.onopen = () => {
            console.log('[PlaywrightClient] WebSocket connected');
        };

        this.ws.onclose = () => {
            console.log('[PlaywrightClient] WebSocket disconnected');
            // Reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('[PlaywrightClient] WebSocket error:', error);
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                const handlers = this.eventHandlers.get(message.event);

                if (handlers) {
                    handlers.forEach(handler => handler(message.data));
                }
            } catch {
                // Ignore invalid messages
            }
        };
    }

    /**
     * Subscribe to WebSocket events
     */
    on(event: string, handler: (data: unknown) => void): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }

        this.eventHandlers.get(event)!.add(handler);

        // Return unsubscribe function
        return () => {
            this.eventHandlers.get(event)?.delete(handler);
        };
    }

    /**
     * Close WebSocket connection
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a Playwright client instance
 */
export function createPlaywrightClient(config: PlaywrightClientConfig): PlaywrightClient {
    return new PlaywrightClient(config);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default PlaywrightClient;

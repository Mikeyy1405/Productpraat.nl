/**
 * Bol.com Marketing Catalog API Client
 * 
 * HTTP client for Bol.com API calls with authentication, rate limiting,
 * error handling, and retry logic.
 * 
 * @module services/bolcom/api-client
 * @see https://api.bol.com/
 */

import { ApiProblem } from '../../types/bolcom';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://api.bol.com';
const API_VERSION = 'v1';

/**
 * Rate limit configuration
 */
const RATE_LIMIT = {
    maxRequestsPerSecond: 10,
    maxRequestsPerMinute: 300,
    retryAfterMs: 1000,
    maxRetries: 3,
};

/**
 * HTTP status codes that warrant a retry
 */
const RETRYABLE_STATUS_CODES = [503, 429, 500, 502, 504];

// ============================================================================
// ENVIRONMENT HELPERS
// ============================================================================

/**
 * Get environment variable value
 */
const getEnvVar = (key: string): string => {
    // Check window injection (Server)
    if (typeof window !== 'undefined') {
        const windowEnv = (window as unknown as { __ENV__?: Record<string, string> }).__ENV__;
        if (windowEnv && windowEnv[key]) {
            return windowEnv[key];
        }
    }
    // Check Vite env (Local Dev)
    if ((import.meta as { env?: Record<string, string> }).env) {
        const viteEnv = (import.meta as { env: Record<string, string> }).env;
        if (viteEnv[key]) return viteEnv[key];
    }
    // Check Node.js environment
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] || '';
    }
    return '';
};

// ============================================================================
// RATE LIMITER
// ============================================================================

/**
 * Simple token bucket rate limiter
 */
class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number; // tokens per ms

    constructor(requestsPerSecond: number) {
        this.maxTokens = requestsPerSecond;
        this.tokens = requestsPerSecond;
        this.refillRate = requestsPerSecond / 1000;
        this.lastRefill = Date.now();
    }

    async acquire(): Promise<void> {
        this.refill();
        
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // Wait for next token
        const waitTime = (1 - this.tokens) / this.refillRate;
        await this.sleep(Math.ceil(waitTime));
        this.refill();
        this.tokens -= 1;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter(RATE_LIMIT.maxRequestsPerSecond);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom API error class
 */
export class BolApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly problem?: ApiProblem,
        public readonly isRetryable: boolean = false
    ) {
        super(message);
        this.name = 'BolApiError';
    }
}

/**
 * Parse API error response
 */
async function parseApiError(response: Response): Promise<BolApiError> {
    const isRetryable = RETRYABLE_STATUS_CODES.includes(response.status);
    
    try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/problem+json') || contentType?.includes('application/json')) {
            const problem = await response.json() as ApiProblem;
            return new BolApiError(
                problem.detail || problem.title || `API Error: ${response.status}`,
                response.status,
                problem,
                isRetryable
            );
        }
    } catch {
        // Failed to parse error response
    }
    
    return new BolApiError(
        `API Error: ${response.status} ${response.statusText}`,
        response.status,
        undefined,
        isRetryable
    );
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * Request options
 */
export interface RequestOptions {
    /** Query parameters */
    params?: Record<string, string | number | boolean | undefined>;
    /** Request headers */
    headers?: Record<string, string>;
    /** Request body (for POST/PUT) */
    body?: unknown;
    /** Timeout in ms */
    timeout?: number;
    /** Skip rate limiting */
    skipRateLimit?: boolean;
    /** Number of retries (default: 3) */
    retries?: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
    data: T;
    status: number;
    headers: Headers;
    cached: boolean;
}

/**
 * Response cache entry
 */
interface CacheEntry<T> {
    data: T;
    status: number;
    expiresAt: number;
}

/**
 * Simple in-memory cache for API responses
 */
class ResponseCache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private readonly maxSize = 100;

    get<T>(key: string): CacheEntry<T> | undefined {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;
        if (entry && entry.expiresAt > Date.now()) {
            return entry;
        }
        if (entry) {
            this.cache.delete(key);
        }
        return undefined;
    }

    set<T>(key: string, data: T, status: number, ttlMs: number): void {
        // Evict oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        
        this.cache.set(key, {
            data,
            status,
            expiresAt: Date.now() + ttlMs,
        });
    }

    clear(): void {
        this.cache.clear();
    }
}

// Global response cache
const responseCache = new ResponseCache();

/**
 * Build full URL with query parameters
 */
function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, API_BASE_URL);
    
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        }
    }
    
    return url.toString();
}

/**
 * Get authorization headers
 */
function getAuthHeaders(): Record<string, string> {
    const apiKey = getEnvVar('BOL_API_KEY');
    
    if (!apiKey) {
        console.warn('[BolApiClient] BOL_API_KEY not configured');
        return {};
    }
    
    return {
        'Authorization': `Bearer ${apiKey}`,
    };
}

/**
 * Parse Cache-Control header to get max-age
 */
function parseCacheMaxAge(headers: Headers): number {
    const cacheControl = headers.get('cache-control');
    if (!cacheControl) return 0;
    
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1], 10) * 1000; // Convert to ms
    }
    return 0;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an API request with retry logic
 */
async function makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: RequestOptions = {}
): Promise<ApiResponse<T>> {
    const {
        params,
        headers: customHeaders,
        body,
        timeout = 30000,
        skipRateLimit = false,
        retries = RATE_LIMIT.maxRetries,
    } = options;

    // Check if API is configured
    const apiKey = getEnvVar('BOL_API_KEY');
    if (!apiKey) {
        throw new BolApiError(
            'Bol.com API is not configured. Set BOL_API_KEY environment variable.',
            401,
            undefined,
            false
        );
    }

    // Check cache for GET requests
    const cacheKey = method === 'GET' ? `${method}:${buildUrl(path, params)}` : '';
    if (method === 'GET' && cacheKey) {
        const cached = responseCache.get<T>(cacheKey);
        if (cached) {
            return {
                data: cached.data,
                status: cached.status,
                headers: new Headers(),
                cached: true,
            };
        }
    }

    // Apply rate limiting
    if (!skipRateLimit) {
        await rateLimiter.acquire();
    }

    const url = buildUrl(path, params);
    const authHeaders = getAuthHeaders();
    
    const requestHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders,
        ...customHeaders,
    };

    let lastError: BolApiError | Error | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                lastError = await parseApiError(response);
                
                if ((lastError as BolApiError).isRetryable && attempt < retries) {
                    // Get retry-after header or use default
                    const retryAfter = response.headers.get('retry-after');
                    const waitTime = retryAfter 
                        ? parseInt(retryAfter, 10) * 1000 
                        : RATE_LIMIT.retryAfterMs * (attempt + 1);
                    
                    console.warn(`[BolApiClient] Retrying request in ${waitTime}ms (attempt ${attempt + 1}/${retries})`);
                    await sleep(waitTime);
                    continue;
                }
                
                throw lastError;
            }
            
            const data = await response.json() as T;
            
            // Cache GET responses if Cache-Control header allows
            if (method === 'GET' && cacheKey) {
                const maxAge = parseCacheMaxAge(response.headers);
                if (maxAge > 0) {
                    responseCache.set(cacheKey, data, response.status, maxAge);
                }
            }
            
            return {
                data,
                status: response.status,
                headers: response.headers,
                cached: false,
            };
        } catch (error) {
            if (error instanceof BolApiError) {
                throw error;
            }
            
            // Handle network errors
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new BolApiError('Request timeout', 408, undefined, true);
                }
                
                if (attempt < retries) {
                    console.warn(`[BolApiClient] Network error, retrying... (attempt ${attempt + 1}/${retries})`);
                    await sleep(RATE_LIMIT.retryAfterMs * (attempt + 1));
                    continue;
                }
                
                throw new BolApiError(`Network error: ${error.message}`, 0, undefined, false);
            }
            
            throw error;
        }
    }
    
    throw lastError || new BolApiError('Max retries exceeded', 0, undefined, false);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Bol.com API client
 */
export const bolApiClient = {
    /**
     * Make a GET request
     */
    async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
        return makeRequest<T>('GET', path, options);
    },

    /**
     * Make a POST request
     */
    async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
        return makeRequest<T>('POST', path, { ...options, body });
    },

    /**
     * Clear the response cache
     */
    clearCache(): void {
        responseCache.clear();
    },

    /**
     * Check if API is configured
     */
    isConfigured(): boolean {
        const apiKey = getEnvVar('BOL_API_KEY');
        return Boolean(apiKey);
    },

    /**
     * Get API base URL
     */
    getBaseUrl(): string {
        return API_BASE_URL;
    },

    /**
     * Get API version
     */
    getVersion(): string {
        return API_VERSION;
    },
};

export default bolApiClient;

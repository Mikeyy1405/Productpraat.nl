/**
 * Central Playwright API Service
 *
 * A standalone API server that provides Playwright browser automation
 * as a service for multiple projects.
 *
 * Features:
 * - REST API for browser automation tasks
 * - API key authentication
 * - Task queue for async processing
 * - WebSocket for real-time updates
 * - Rate limiting per API key
 * - Health monitoring
 *
 * @module vps-services/playwright-api
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface ApiKey {
    key: string;
    name: string;
    project: string;
    rateLimit: number; // requests per minute
    enabled: boolean;
    createdAt: string;
}

interface Task {
    id: string;
    type: 'screenshot' | 'scrape' | 'affiliate' | 'media' | 'login' | 'custom';
    status: 'pending' | 'running' | 'completed' | 'failed';
    apiKey: string;
    input: Record<string, unknown>;
    result?: unknown;
    error?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}

interface Session {
    id: string;
    project: string;
    domain: string;
    cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
    }>;
    createdAt: string;
    expiresAt: string;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    port: parseInt(process.env.PLAYWRIGHT_API_PORT || '3100'),
    host: process.env.PLAYWRIGHT_API_HOST || '0.0.0.0',
    dataDir: process.env.PLAYWRIGHT_DATA_DIR || '/var/lib/playwright-api',
    maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '5'),
    defaultRateLimit: parseInt(process.env.DEFAULT_RATE_LIMIT || '60'),
    sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || '24'),
    adminApiKey: process.env.ADMIN_API_KEY || generateAdminKey(),
};

function generateAdminKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    console.log(`\n⚠️  Generated admin API key: ${key}`);
    console.log('Save this key! Set ADMIN_API_KEY env var to persist.\n');
    return key;
}

// ============================================================================
// STATE
// ============================================================================

let browser: Browser | null = null;
const apiKeys = new Map<string, ApiKey>();
const tasks = new Map<string, Task>();
const sessions = new Map<string, Session>();
const rateLimits = new Map<string, RateLimitEntry>();
const wsClients = new Map<string, Set<WebSocket>>();

let runningTasks = 0;
const taskQueue: Task[] = [];

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
    return crypto.randomBytes(16).toString('hex');
}

function generateApiKey(): string {
    return `pp_${crypto.randomBytes(24).toString('hex')}`;
}

function loadData(): void {
    const keysFile = path.join(CONFIG.dataDir, 'api-keys.json');
    const sessionsFile = path.join(CONFIG.dataDir, 'sessions.json');

    try {
        if (fs.existsSync(keysFile)) {
            const data = JSON.parse(fs.readFileSync(keysFile, 'utf-8'));
            data.forEach((key: ApiKey) => apiKeys.set(key.key, key));
            console.log(`Loaded ${apiKeys.size} API keys`);
        }

        if (fs.existsSync(sessionsFile)) {
            const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
            data.forEach((session: Session) => sessions.set(session.id, session));
            console.log(`Loaded ${sessions.size} sessions`);
        }
    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

function saveData(): void {
    try {
        if (!fs.existsSync(CONFIG.dataDir)) {
            fs.mkdirSync(CONFIG.dataDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(CONFIG.dataDir, 'api-keys.json'),
            JSON.stringify(Array.from(apiKeys.values()), null, 2)
        );

        fs.writeFileSync(
            path.join(CONFIG.dataDir, 'sessions.json'),
            JSON.stringify(Array.from(sessions.values()), null, 2)
        );
    } catch (error) {
        console.error('Failed to save data:', error);
    }
}

function notifyClients(apiKey: string, event: string, data: unknown): void {
    const clients = wsClients.get(apiKey);
    if (clients) {
        const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
        clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

// ============================================================================
// BROWSER MANAGEMENT
// ============================================================================

async function initBrowser(): Promise<Browser> {
    if (!browser) {
        console.log('Launching browser...');
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });
        console.log('Browser launched');
    }
    return browser;
}

async function getContext(session?: Session): Promise<BrowserContext> {
    const b = await initBrowser();

    const contextOptions: Parameters<Browser['newContext']>[0] = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
    };

    if (session?.cookies) {
        const context = await b.newContext(contextOptions);
        await context.addCookies(session.cookies.map(c => ({
            ...c,
            sameSite: 'Lax' as const,
        })));
        return context;
    }

    return await b.newContext(contextOptions);
}

// ============================================================================
// TASK PROCESSING
// ============================================================================

async function processTask(task: Task): Promise<void> {
    task.status = 'running';
    task.startedAt = new Date().toISOString();
    runningTasks++;

    notifyClients(task.apiKey, 'task:started', { taskId: task.id });

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
        context = await getContext();
        page = await context.newPage();

        switch (task.type) {
            case 'screenshot':
                task.result = await handleScreenshot(page, task.input);
                break;
            case 'scrape':
                task.result = await handleScrape(page, task.input);
                break;
            case 'affiliate':
                task.result = await handleAffiliate(page, task.input);
                break;
            case 'media':
                task.result = await handleMedia(page, task.input);
                break;
            case 'login':
                task.result = await handleLogin(page, task.input, task.apiKey);
                break;
            case 'custom':
                task.result = await handleCustom(page, task.input);
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }

        task.status = 'completed';
    } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
        task.completedAt = new Date().toISOString();
        runningTasks--;

        if (page) await page.close();
        if (context) await context.close();

        notifyClients(task.apiKey, 'task:completed', {
            taskId: task.id,
            status: task.status,
            result: task.result,
            error: task.error,
        });

        // Process next task in queue
        processQueue();
    }
}

function processQueue(): void {
    while (taskQueue.length > 0 && runningTasks < CONFIG.maxConcurrentTasks) {
        const task = taskQueue.shift();
        if (task) {
            processTask(task);
        }
    }
}

function enqueueTask(task: Task): void {
    tasks.set(task.id, task);
    taskQueue.push(task);
    processQueue();
}

// ============================================================================
// TASK HANDLERS
// ============================================================================

async function handleScreenshot(page: Page, input: Record<string, unknown>): Promise<unknown> {
    const url = input.url as string;
    const fullPage = input.fullPage as boolean ?? false;
    const selector = input.selector as string | undefined;

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    let screenshot: Buffer;
    if (selector) {
        const element = await page.$(selector);
        if (!element) throw new Error(`Selector not found: ${selector}`);
        screenshot = await element.screenshot();
    } else {
        screenshot = await page.screenshot({ fullPage });
    }

    return {
        url,
        screenshot: screenshot.toString('base64'),
        title: await page.title(),
    };
}

async function handleScrape(page: Page, input: Record<string, unknown>): Promise<unknown> {
    const url = input.url as string;
    const selectors = input.selectors as Record<string, string>;
    const waitFor = input.waitFor as string | undefined;

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 10000 });
    }

    const results: Record<string, string | null> = {};

    for (const [name, selector] of Object.entries(selectors)) {
        const element = await page.$(selector);
        results[name] = element ? await element.textContent() : null;
    }

    return {
        url,
        title: await page.title(),
        data: results,
    };
}

async function handleAffiliate(page: Page, input: Record<string, unknown>): Promise<unknown> {
    const productUrl = input.url as string;
    const partnerId = input.partnerId as string;
    const network = input.network as string ?? 'bol';

    // For Bol.com Partner Plaza
    if (network === 'bol') {
        // Check if we have a valid session
        const sessionId = input.sessionId as string | undefined;
        let session: Session | undefined;

        if (sessionId) {
            session = sessions.get(sessionId);
        }

        if (!session) {
            // Generate fallback affiliate link
            const url = new URL(productUrl);
            url.searchParams.set('Referrer', `productpraat_${partnerId}`);
            return {
                originalUrl: productUrl,
                affiliateUrl: url.toString(),
                method: 'fallback',
            };
        }

        // Use Partner Plaza deeplink generator
        await page.goto('https://partner.bol.com/click/deeplink-generator', {
            waitUntil: 'networkidle',
        });

        // Fill URL and generate
        const urlInput = await page.$('input[name="url"], textarea');
        if (urlInput) {
            await urlInput.fill(productUrl);
            const generateBtn = await page.$('button[type="submit"]');
            if (generateBtn) {
                await generateBtn.click();
                await page.waitForTimeout(2000);
            }
        }

        // Get result
        const resultInput = await page.$('input[readonly], .deeplink-result input');
        const affiliateUrl = resultInput ? await resultInput.getAttribute('value') : null;

        return {
            originalUrl: productUrl,
            affiliateUrl: affiliateUrl || productUrl,
            method: affiliateUrl ? 'partner-plaza' : 'fallback',
        };
    }

    throw new Error(`Unsupported affiliate network: ${network}`);
}

async function handleMedia(page: Page, input: Record<string, unknown>): Promise<unknown> {
    const url = input.url as string;

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    const media: Array<{ type: string; url: string; highRes?: string }> = [];
    const seenUrls = new Set<string>();

    // Find images
    const images = await page.$$('img');
    for (const img of images) {
        const src = await img.getAttribute('src');
        const srcset = await img.getAttribute('srcset');
        const dataSrc = await img.getAttribute('data-src');
        const dataLarge = await img.getAttribute('data-large-src');

        const urls = [src, dataSrc, dataLarge].filter(Boolean) as string[];

        for (const imgUrl of urls) {
            if (seenUrls.has(imgUrl)) continue;
            seenUrls.add(imgUrl);

            let highRes = imgUrl;
            if (imgUrl.includes('media.s-bol.com')) {
                highRes = imgUrl
                    .replace(/_\d+x\d+\./, '_1200x1200.')
                    .replace(/_s_/, '_xl_')
                    .replace(/_m_/, '_xl_');
            }

            media.push({
                type: 'image',
                url: imgUrl,
                highRes: highRes !== imgUrl ? highRes : undefined,
            });
        }
    }

    // Find videos
    const videos = await page.$$('video source, [data-video-url]');
    for (const video of videos) {
        const src = await video.getAttribute('src') || await video.getAttribute('data-video-url');
        if (src && !seenUrls.has(src)) {
            seenUrls.add(src);
            media.push({ type: 'video', url: src });
        }
    }

    return {
        url,
        title: await page.title(),
        media,
        count: media.length,
    };
}

async function handleLogin(page: Page, input: Record<string, unknown>, apiKey: string): Promise<unknown> {
    const loginUrl = input.loginUrl as string;
    const email = input.email as string;
    const password = input.password as string;
    const domain = input.domain as string;
    const emailSelector = input.emailSelector as string ?? 'input[type="email"]';
    const passwordSelector = input.passwordSelector as string ?? 'input[type="password"]';
    const submitSelector = input.submitSelector as string ?? 'button[type="submit"]';
    const successIndicator = input.successIndicator as string | undefined;

    await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Fill credentials
    await page.fill(emailSelector, email);
    await page.fill(passwordSelector, password);
    await page.click(submitSelector);

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

    // Check success
    let success = true;
    if (successIndicator) {
        try {
            await page.waitForSelector(successIndicator, { timeout: 5000 });
        } catch {
            success = false;
        }
    } else {
        success = !page.url().includes('login') && !page.url().includes('error');
    }

    if (success) {
        // Save session
        const context = page.context();
        const cookies = await context.cookies();

        const key = apiKeys.get(apiKey);
        const session: Session = {
            id: generateId(),
            project: key?.project || 'unknown',
            domain,
            cookies: cookies.map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
            })),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + CONFIG.sessionTtlHours * 60 * 60 * 1000).toISOString(),
        };

        sessions.set(session.id, session);
        saveData();

        return {
            success: true,
            sessionId: session.id,
            expiresAt: session.expiresAt,
        };
    }

    return {
        success: false,
        error: 'Login failed',
    };
}

async function handleCustom(page: Page, input: Record<string, unknown>): Promise<unknown> {
    const url = input.url as string;
    const actions = input.actions as Array<{
        type: 'goto' | 'click' | 'fill' | 'wait' | 'screenshot' | 'extract';
        selector?: string;
        value?: string;
        timeout?: number;
    }>;

    const results: unknown[] = [];

    for (const action of actions) {
        switch (action.type) {
            case 'goto':
                await page.goto(action.value!, { waitUntil: 'networkidle' });
                results.push({ action: 'goto', url: action.value });
                break;
            case 'click':
                await page.click(action.selector!);
                results.push({ action: 'click', selector: action.selector });
                break;
            case 'fill':
                await page.fill(action.selector!, action.value!);
                results.push({ action: 'fill', selector: action.selector });
                break;
            case 'wait':
                if (action.selector) {
                    await page.waitForSelector(action.selector, { timeout: action.timeout || 10000 });
                } else {
                    await page.waitForTimeout(action.timeout || 1000);
                }
                results.push({ action: 'wait', selector: action.selector });
                break;
            case 'screenshot':
                const screenshot = await page.screenshot();
                results.push({ action: 'screenshot', data: screenshot.toString('base64') });
                break;
            case 'extract':
                const element = await page.$(action.selector!);
                const text = element ? await element.textContent() : null;
                results.push({ action: 'extract', selector: action.selector, value: text });
                break;
        }
    }

    return {
        url: page.url(),
        title: await page.title(),
        results,
    };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }

    const key = authHeader.substring(7);

    // Check admin key
    if (key === CONFIG.adminApiKey) {
        (req as any).isAdmin = true;
        (req as any).apiKey = key;
        next();
        return;
    }

    // Check regular API key
    const apiKey = apiKeys.get(key);
    if (!apiKey || !apiKey.enabled) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
    }

    // Check rate limit
    const now = Date.now();
    let rateLimit = rateLimits.get(key);

    if (!rateLimit || rateLimit.resetAt < now) {
        rateLimit = { count: 0, resetAt: now + 60000 };
    }

    rateLimit.count++;

    if (rateLimit.count > apiKey.rateLimit) {
        res.status(429).json({
            error: 'Rate limit exceeded',
            resetAt: new Date(rateLimit.resetAt).toISOString(),
        });
        return;
    }

    rateLimits.set(key, rateLimit);
    (req as any).apiKey = key;
    (req as any).apiKeyData = apiKey;
    next();
}

function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!(req as any).isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
}

// ============================================================================
// API ROUTES
// ============================================================================

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        browser: browser ? 'running' : 'stopped',
        tasks: {
            running: runningTasks,
            queued: taskQueue.length,
            total: tasks.size,
        },
        uptime: process.uptime(),
    });
});

// All other routes require auth
app.use(authMiddleware);

// ============================================================================
// TASK ENDPOINTS
// ============================================================================

// Create task
app.post('/tasks', (req, res) => {
    const { type, input } = req.body;

    if (!type || !input) {
        res.status(400).json({ error: 'Missing type or input' });
        return;
    }

    const task: Task = {
        id: generateId(),
        type,
        status: 'pending',
        apiKey: (req as any).apiKey,
        input,
        createdAt: new Date().toISOString(),
    };

    enqueueTask(task);

    res.status(201).json({
        taskId: task.id,
        status: task.status,
        position: taskQueue.length,
    });
});

// Get task status
app.get('/tasks/:id', (req, res) => {
    const task = tasks.get(req.params.id);

    if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }

    // Only allow access to own tasks (unless admin)
    if (!(req as any).isAdmin && task.apiKey !== (req as any).apiKey) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }

    res.json(task);
});

// List tasks
app.get('/tasks', (req, res) => {
    const apiKey = (req as any).apiKey;
    const isAdmin = (req as any).isAdmin;

    let taskList = Array.from(tasks.values());

    if (!isAdmin) {
        taskList = taskList.filter(t => t.apiKey === apiKey);
    }

    // Sort by creation date, newest first
    taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Limit to last 100
    taskList = taskList.slice(0, 100);

    res.json({ tasks: taskList });
});

// ============================================================================
// SESSION ENDPOINTS
// ============================================================================

// List sessions
app.get('/sessions', (req, res) => {
    const apiKey = (req as any).apiKey;
    const isAdmin = (req as any).isAdmin;
    const key = apiKeys.get(apiKey);

    let sessionList = Array.from(sessions.values());

    if (!isAdmin && key) {
        sessionList = sessionList.filter(s => s.project === key.project);
    }

    // Don't expose cookies
    const sanitized = sessionList.map(s => ({
        id: s.id,
        project: s.project,
        domain: s.domain,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
    }));

    res.json({ sessions: sanitized });
});

// Delete session
app.delete('/sessions/:id', (req, res) => {
    const session = sessions.get(req.params.id);

    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }

    sessions.delete(req.params.id);
    saveData();

    res.json({ success: true });
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// Create API key
app.post('/admin/api-keys', adminMiddleware, (req, res) => {
    const { name, project, rateLimit } = req.body;

    if (!name || !project) {
        res.status(400).json({ error: 'Missing name or project' });
        return;
    }

    const key = generateApiKey();
    const apiKey: ApiKey = {
        key,
        name,
        project,
        rateLimit: rateLimit || CONFIG.defaultRateLimit,
        enabled: true,
        createdAt: new Date().toISOString(),
    };

    apiKeys.set(key, apiKey);
    saveData();

    res.status(201).json(apiKey);
});

// List API keys
app.get('/admin/api-keys', adminMiddleware, (req, res) => {
    res.json({
        keys: Array.from(apiKeys.values()).map(k => ({
            ...k,
            key: k.key.substring(0, 10) + '...',
        })),
    });
});

// Delete API key
app.delete('/admin/api-keys/:key', adminMiddleware, (req, res) => {
    if (!apiKeys.has(req.params.key)) {
        res.status(404).json({ error: 'API key not found' });
        return;
    }

    apiKeys.delete(req.params.key);
    saveData();

    res.json({ success: true });
});

// System stats
app.get('/admin/stats', adminMiddleware, (req, res) => {
    res.json({
        browser: browser ? 'running' : 'stopped',
        tasks: {
            running: runningTasks,
            queued: taskQueue.length,
            total: tasks.size,
            completed: Array.from(tasks.values()).filter(t => t.status === 'completed').length,
            failed: Array.from(tasks.values()).filter(t => t.status === 'failed').length,
        },
        sessions: sessions.size,
        apiKeys: apiKeys.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});

// ============================================================================
// WEBSOCKET
// ============================================================================

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const apiKey = url.searchParams.get('apiKey');

    if (!apiKey || (!apiKeys.has(apiKey) && apiKey !== CONFIG.adminApiKey)) {
        ws.close(4001, 'Invalid API key');
        return;
    }

    // Add to clients
    if (!wsClients.has(apiKey)) {
        wsClients.set(apiKey, new Set());
    }
    wsClients.get(apiKey)!.add(ws);

    console.log(`WebSocket client connected: ${apiKey.substring(0, 10)}...`);

    ws.on('close', () => {
        wsClients.get(apiKey)?.delete(ws);
        console.log(`WebSocket client disconnected`);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
        } catch {
            // Ignore invalid messages
        }
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
    }));
});

// ============================================================================
// STARTUP
// ============================================================================

async function start(): Promise<void> {
    // Ensure data directory exists
    if (!fs.existsSync(CONFIG.dataDir)) {
        fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    }

    // Load saved data
    loadData();

    // Pre-initialize browser
    await initBrowser();

    // Start server
    server.listen(CONFIG.port, CONFIG.host, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║           Playwright API Service                             ║
╠══════════════════════════════════════════════════════════════╣
║  HTTP:  http://${CONFIG.host}:${CONFIG.port}                              ║
║  WS:    ws://${CONFIG.host}:${CONFIG.port}/ws                             ║
╠══════════════════════════════════════════════════════════════╣
║  Admin key: ${CONFIG.adminApiKey.substring(0, 20)}...              ║
╚══════════════════════════════════════════════════════════════╝
        `);
    });
}

// Graceful shutdown
async function shutdown(): Promise<void> {
    console.log('\nShutting down...');

    if (browser) {
        await browser.close();
    }

    saveData();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(console.error);

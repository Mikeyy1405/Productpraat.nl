# Playwright API Service Dockerfile
# Multi-stage build for minimal production image

FROM node:20-slim AS base

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libxshmfence1 \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r playwright && useradd -r -g playwright playwright

# Set working directory
WORKDIR /app

# ============================================================================
# Dependencies stage
# ============================================================================
FROM base AS deps

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers
RUN npx playwright install chromium

# ============================================================================
# Build stage
# ============================================================================
FROM base AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build 2>/dev/null || echo "No build step needed"

# ============================================================================
# Production stage
# ============================================================================
FROM base AS production

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy Playwright browsers
COPY --from=deps /root/.cache/ms-playwright /home/playwright/.cache/ms-playwright

# Copy application code
COPY --from=builder /app/*.ts ./
COPY --from=builder /app/*.js ./
COPY --from=builder /app/package*.json ./

# Create data directory
RUN mkdir -p /var/lib/playwright-api && \
    chown -R playwright:playwright /var/lib/playwright-api && \
    chown -R playwright:playwright /home/playwright/.cache && \
    chown -R playwright:playwright /app

# Switch to non-root user
USER playwright

# Environment
ENV NODE_ENV=production
ENV PLAYWRIGHT_API_PORT=3100
ENV PLAYWRIGHT_DATA_DIR=/var/lib/playwright-api

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health || exit 1

# Start the service
CMD ["npx", "tsx", "server.ts"]

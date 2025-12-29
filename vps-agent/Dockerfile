# ProductPraat.nl AI Agent Runtime - Main Container
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (for managing sandbox containers)
RUN curl -fsSL https://get.docker.com -o get-docker.sh && \
    sh get-docker.sh && \
    rm get-docker.sh

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ /app/src/

# Create directories
RUN mkdir -p /app/logs /app/workspace /app/config

# Expose port
EXPOSE 8000

# Run server
CMD ["python", "-m", "src.main"]

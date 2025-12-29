"""
Main entry point for WritGo.nl AI Agent VPS Runtime
"""

import os
import sys
import logging
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/agent.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def main():
    """Start the agent server."""
    logger.info("=" * 60)
    logger.info("WritGo.nl AI Agent VPS Runtime")
    logger.info("Manus.im CodeAct + Abacus Multi-Model Architecture")
    logger.info("=" * 60)

    # Check required environment variables
    required_vars = ["ANTHROPIC_API_KEY", "WRITGO_WEBHOOK_SECRET"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        logger.error("Please set them in .env file")
        sys.exit(1)

    # Log configuration
    logger.info(f"WritGo.nl API: {os.getenv('WRITGO_API_URL', 'https://writgo.nl')}")
    logger.info(f"Max iterations: {os.getenv('MAX_ITERATIONS', '50')}")
    logger.info(f"Sandbox timeout: {os.getenv('SANDBOX_TIMEOUT', '300')}s")
    logger.info(f"Default model: {os.getenv('DEFAULT_MODEL', 'claude-opus-4-20250514')}")

    # Start server
    import uvicorn
    from src.api.server import app

    logger.info("Starting FastAPI server on http://0.0.0.0:8000")
    logger.info("Health check: http://localhost:8000/health")
    logger.info("API docs: http://localhost:8000/docs")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )


if __name__ == "__main__":
    main()

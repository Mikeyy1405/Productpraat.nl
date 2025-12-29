"""
FastAPI Server - WritGo.nl Agent VPS Integration
Receives tasks from WritGo.nl and sends results back via webhook
"""

import asyncio
import logging
import os
from typing import Dict, Optional, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
import httpx

from ..core.agent import AgentLoop
from ..core.llm import create_llm_setup
from ..tools.sandbox import DockerSandbox
from ..memory.event_stream import EventStream
from ..memory.file_storage import FileStorage

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="WritGo.nl AI Agent VPS")

# Configuration from environment
CONFIG = {
    "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY"),
    "WRITGO_API_URL": os.getenv("WRITGO_API_URL", "https://writgo.nl"),
    "WRITGO_WEBHOOK_SECRET": os.getenv("WRITGO_WEBHOOK_SECRET"),
    "MAX_ITERATIONS": int(os.getenv("MAX_ITERATIONS", "50")),
    "SANDBOX_TIMEOUT": int(os.getenv("SANDBOX_TIMEOUT", "300")),
    "DEFAULT_MODEL": os.getenv("DEFAULT_MODEL", "claude-opus-4-20250514"),
    "MODEL_COMPLEX": os.getenv("MODEL_COMPLEX", "claude-opus-4-20250514"),
    "MODEL_FAST": os.getenv("MODEL_FAST", "claude-haiku-3-20250307"),
    "MODEL_CODING": os.getenv("MODEL_CODING", "claude-sonnet-4-20250514"),
}

# Initialize LLM
llm_provider, model_router = create_llm_setup(CONFIG)


# === Request/Response Models ===

class TaskRequest(BaseModel):
    task_id: str
    title: str
    description: Optional[str] = None
    prompt: str
    priority: str = "normal"
    user_id: str
    project_id: Optional[str] = None


class TaskResponse(BaseModel):
    status: str
    message: str


class HealthResponse(BaseModel):
    status: str
    version: str
    sandbox_ready: bool


# === Active Tasks Registry ===

active_tasks: Dict[str, Dict] = {}


# === API Endpoints ===

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    # Test Docker availability
    sandbox_ready = False
    try:
        import docker
        client = docker.from_env()
        client.ping()
        sandbox_ready = True
    except:
        pass

    return {
        "status": "healthy",
        "version": "1.0.0",
        "sandbox_ready": sandbox_ready
    }


@app.post("/tasks/execute", response_model=TaskResponse)
async def execute_task(
    task_request: TaskRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """
    Execute a task from WritGo.nl.
    Runs in background and sends results via webhook.
    """
    # Verify authorization
    expected_auth = f"Bearer {CONFIG['WRITGO_WEBHOOK_SECRET']}"
    if authorization != expected_auth:
        raise HTTPException(status_code=401, detail="Unauthorized")

    task_id = task_request.task_id

    # Check if already running
    if task_id in active_tasks:
        raise HTTPException(status_code=409, detail="Task already running")

    # Register task
    active_tasks[task_id] = {
        "status": "queued",
        "started_at": datetime.now().isoformat()
    }

    logger.info(f"Received task {task_id}: {task_request.title}")

    # Execute in background
    background_tasks.add_task(
        run_agent_task,
        task_request
    )

    return {
        "status": "accepted",
        "message": f"Task {task_id} queued for execution"
    }


@app.get("/tasks/{task_id}/status")
async def get_task_status(task_id: str):
    """Get status of running task."""
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    return active_tasks[task_id]


async def run_agent_task(task_request: TaskRequest):
    """
    Execute agent task and send results back to WritGo.nl.
    This is the main integration point!
    """
    task_id = task_request.task_id

    try:
        # Update status to running
        active_tasks[task_id]["status"] = "running"
        await send_status_update(task_id, "running")

        logger.info(f"Starting agent execution for task {task_id}")

        # Initialize components
        sandbox = DockerSandbox(
            timeout=CONFIG["SANDBOX_TIMEOUT"],
            workspace_dir=f"/tmp/agent_workspace_{task_id}"
        )
        event_stream = EventStream()
        file_storage = FileStorage(workspace_dir=f"/tmp/agent_workspace_{task_id}")

        # Create agent loop
        agent = AgentLoop(
            llm_provider=llm_provider,
            model_router=model_router,
            sandbox=sandbox,
            event_stream=event_stream,
            file_storage=file_storage,
            max_iterations=CONFIG["MAX_ITERATIONS"]
        )

        # Run task
        result = await agent.run(
            task=task_request.prompt,
            context={
                "user_id": task_request.user_id,
                "project_id": task_request.project_id,
                "priority": task_request.priority
            }
        )

        # Send results to WritGo.nl
        await send_task_results(task_id, result)

        # Update local status
        active_tasks[task_id]["status"] = "completed"
        active_tasks[task_id]["completed_at"] = datetime.now().isoformat()

        logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}", exc_info=True)

        # Update status
        active_tasks[task_id]["status"] = "failed"
        active_tasks[task_id]["error"] = str(e)

        # Send error to WritGo.nl
        await send_task_error(task_id, str(e))

    finally:
        # Cleanup after 1 hour
        await asyncio.sleep(3600)
        if task_id in active_tasks:
            del active_tasks[task_id]


async def send_status_update(task_id: str, status: str):
    """Send status update to WritGo.nl webhook."""
    webhook_url = f"{CONFIG['WRITGO_API_URL']}/api/agent/webhook"

    payload = {
        "task_id": task_id,
        "status": status
    }

    headers = {
        "Authorization": f"Bearer {CONFIG['WRITGO_WEBHOOK_SECRET']}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            logger.info(f"Status update sent to WritGo.nl: {status}")
    except Exception as e:
        logger.error(f"Failed to send status update: {e}")


async def send_task_results(task_id: str, result: Dict[str, Any]):
    """Send task results to WritGo.nl webhook."""
    webhook_url = f"{CONFIG['WRITGO_API_URL']}/api/agent/webhook"

    payload = {
        "task_id": task_id,
        "status": "completed",
        "result_data": result.get("result"),
        "result_files": result.get("result", {}).get("files", []),
        "session_data": {
            "iterations": result.get("iterations"),
            "events": result.get("events")
        },
        "activity_log": result.get("events", [])
    }

    headers = {
        "Authorization": f"Bearer {CONFIG['WRITGO_WEBHOOK_SECRET']}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            logger.info(f"Results sent to WritGo.nl for task {task_id}")
    except Exception as e:
        logger.error(f"Failed to send results: {e}")


async def send_task_error(task_id: str, error_message: str):
    """Send task error to WritGo.nl webhook."""
    webhook_url = f"{CONFIG['WRITGO_API_URL']}/api/agent/webhook"

    payload = {
        "task_id": task_id,
        "status": "failed",
        "error_message": error_message
    }

    headers = {
        "Authorization": f"Bearer {CONFIG['WRITGO_WEBHOOK_SECRET']}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            logger.info(f"Error sent to WritGo.nl for task {task_id}")
    except Exception as e:
        logger.error(f"Failed to send error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

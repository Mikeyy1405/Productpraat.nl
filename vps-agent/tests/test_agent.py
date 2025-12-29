"""
Test agent with a simple task
"""

import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from src.core.agent import AgentLoop
from src.core.llm import create_llm_setup
from src.tools.sandbox import DockerSandbox
from src.memory.event_stream import EventStream
from src.memory.file_storage import FileStorage


async def test_simple_task():
    """Test agent with a simple calculation task."""
    print("=" * 60)
    print("Testing WritGo.nl AI Agent with simple task")
    print("=" * 60)

    # Config
    config = {
        "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
        "DEFAULT_MODEL": "claude-opus-4-20250514",
        "MODEL_COMPLEX": "claude-opus-4-20250514",
        "MODEL_FAST": "claude-haiku-3-20250307",
        "MODEL_CODING": "claude-sonnet-4-20250514",
    }

    # Initialize
    llm_provider, model_router = create_llm_setup(config)
    sandbox = DockerSandbox(workspace_dir="/tmp/test_workspace")
    event_stream = EventStream()
    file_storage = FileStorage(workspace_dir="/tmp/test_workspace")

    # Create agent
    agent = AgentLoop(
        llm_provider=llm_provider,
        model_router=model_router,
        sandbox=sandbox,
        event_stream=event_stream,
        file_storage=file_storage,
        max_iterations=10
    )

    # Test task
    task = "Calculate the first 10 Fibonacci numbers and save them to a file called fibonacci.txt"

    print(f"\nTask: {task}\n")

    # Run
    result = await agent.run(task)

    print("\n" + "=" * 60)
    print("RESULT:")
    print("=" * 60)
    print(f"Status: {result['status']}")
    print(f"Iterations: {result['iterations']}")
    print(f"Files created: {result.get('result', {}).get('files', [])}")
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(test_simple_task())

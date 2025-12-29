"""
File Storage - Workspace file management
Implements Manus.im's file system as external memory pattern
"""

import logging
import aiofiles
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class FileStorage:
    """
    File-based storage for agent workspace.
    Implements Manus's pattern of using filesystem as external memory.
    """

    def __init__(self, workspace_dir: str):
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

    async def save_file(self, filename: str, content: str):
        """Save content to file in workspace."""
        filepath = self.workspace_dir / filename

        # Create parent directories if needed
        filepath.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(filepath, 'w', encoding='utf-8') as f:
            await f.write(content)

        logger.info(f"File saved: {filename}")

    async def read_file(self, filename: str) -> str:
        """Read content from file in workspace."""
        filepath = self.workspace_dir / filename

        if not filepath.exists():
            raise FileNotFoundError(f"File not found: {filename}")

        async with aiofiles.open(filepath, 'r', encoding='utf-8') as f:
            content = await f.read()

        logger.info(f"File read: {filename}")
        return content

    async def delete_file(self, filename: str):
        """Delete file from workspace."""
        filepath = self.workspace_dir / filename

        if filepath.exists():
            filepath.unlink()
            logger.info(f"File deleted: {filename}")

    def file_exists(self, filename: str) -> bool:
        """Check if file exists."""
        return (self.workspace_dir / filename).exists()

    def list_files(self, pattern: str = "*") -> list:
        """List files matching pattern."""
        files = list(self.workspace_dir.glob(pattern))
        return [f.name for f in files if f.is_file()]

    def get_file_path(self, filename: str) -> str:
        """Get absolute path to file."""
        return str(self.workspace_dir / filename)

    def cleanup(self):
        """Clean up workspace directory."""
        import shutil
        if self.workspace_dir.exists():
            shutil.rmtree(self.workspace_dir)
            logger.info(f"Workspace cleaned: {self.workspace_dir}")

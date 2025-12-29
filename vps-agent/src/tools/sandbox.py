"""
Docker Sandbox - Isolated execution environment
Implements Manus.im's Ubuntu VM concept with Docker containers
"""

import asyncio
import docker
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path
import tempfile

logger = logging.getLogger(__name__)


class DockerSandbox:
    """
    Docker-based sandbox for safe code execution.
    Provides Python, Node.js, shell, and browser capabilities.
    """

    def __init__(
        self,
        image: str = "writgo-agent-sandbox:latest",
        workspace_dir: Optional[str] = None,
        timeout: int = 300,  # 5 minutes default
        memory_limit: str = "2g",
        cpu_limit: float = 2.0
    ):
        self.image = image
        self.workspace_dir = workspace_dir or tempfile.mkdtemp(prefix="agent_workspace_")
        self.timeout = timeout
        self.memory_limit = memory_limit
        self.cpu_limit = cpu_limit

        self.client = docker.from_env()
        self.container = None
        self.browser = None

    async def start(self):
        """Start the sandbox container."""
        logger.info(f"Starting sandbox container with image: {self.image}")

        try:
            # Ensure workspace directory exists
            Path(self.workspace_dir).mkdir(parents=True, exist_ok=True)

            # Start container
            self.container = self.client.containers.run(
                self.image,
                detach=True,
                remove=True,  # Auto-remove when stopped
                network_mode="bridge",
                mem_limit=self.memory_limit,
                cpu_quota=int(self.cpu_limit * 100000),
                volumes={
                    self.workspace_dir: {'bind': '/workspace', 'mode': 'rw'}
                },
                working_dir='/workspace',
                environment={
                    'PYTHONPATH': '/opt/tools:/workspace',
                    'PLAYWRIGHT_BROWSERS_PATH': '/ms-playwright'
                },
                stdin_open=True,
                tty=True
            )

            logger.info(f"Sandbox container started: {self.container.id[:12]}")

            # Initialize browser (Playwright)
            await self._init_browser()

        except docker.errors.ImageNotFound:
            logger.error(f"Docker image not found: {self.image}")
            logger.error("Build the image first: docker build -t writgo-agent-sandbox -f Dockerfile.sandbox .")
            raise
        except Exception as e:
            logger.error(f"Failed to start sandbox: {e}")
            raise

    async def stop(self):
        """Stop and cleanup the sandbox container."""
        if self.container:
            try:
                logger.info("Stopping sandbox container")
                self.container.stop(timeout=5)
                logger.info("Sandbox container stopped")
            except Exception as e:
                logger.error(f"Error stopping container: {e}")

    async def run_python(self, code: str) -> str:
        """
        Execute Python code in the sandbox.
        Implements CodeAct paradigm from Manus.im research.
        """
        logger.info("Executing Python code in sandbox")

        # Write code to temp file
        code_filename = f"_agent_code_{asyncio.get_event_loop().time()}.py"
        code_path = f"/workspace/{code_filename}"

        # Write code to file in container
        exit_code, output = self.container.exec_run(
            f"bash -c 'cat > {code_path}'",
            stdin=True,
            demux=True
        )

        # Send code via stdin
        self.container.attach_socket(params={'stdin': 1, 'stdout': 1, 'stderr': 1})

        # Execute code
        try:
            exit_code, output = self.container.exec_run(
                f"python {code_path}",
                timeout=self.timeout,
                demux=True
            )

            stdout, stderr = output

            result = ""
            if stdout:
                result += stdout.decode('utf-8')
            if stderr:
                result += "\nSTDERR:\n" + stderr.decode('utf-8')

            logger.info(f"Python execution completed with exit code: {exit_code}")

            return result if result else f"Code executed successfully (exit code: {exit_code})"

        except Exception as e:
            logger.error(f"Python execution error: {e}")
            return f"Error executing Python code: {str(e)}"

    async def run_shell(self, command: str) -> str:
        """Execute shell command in the sandbox."""
        logger.info(f"Executing shell command: {command[:100]}...")

        try:
            exit_code, output = self.container.exec_run(
                f"bash -c '{command}'",
                timeout=self.timeout,
                demux=True
            )

            stdout, stderr = output

            result = ""
            if stdout:
                result += stdout.decode('utf-8')
            if stderr:
                result += "\nSTDERR:\n" + stderr.decode('utf-8')

            logger.info(f"Shell command completed with exit code: {exit_code}")

            return result if result else f"Command executed (exit code: {exit_code})"

        except Exception as e:
            logger.error(f"Shell execution error: {e}")
            return f"Error executing shell command: {str(e)}"

    async def _init_browser(self):
        """Initialize Playwright browser in container."""
        # Browser is installed in the container, we'll use it via Python code
        init_code = """
from playwright.async_api import async_playwright
import asyncio

async def init():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True)
    page = await browser.new_page()
    # Browser ready
    print("Browser initialized")

asyncio.run(init())
"""
        try:
            result = await self.run_python(init_code)
            logger.info("Browser initialized in sandbox")
        except Exception as e:
            logger.warning(f"Browser initialization warning: {e}")

    async def browser_action(
        self,
        url: str,
        action: str,
        selector: Optional[str] = None,
        value: Optional[str] = None
    ) -> str:
        """
        Perform browser automation action.
        Uses Playwright in the sandbox container.
        """
        logger.info(f"Browser action: {action} on {url}")

        # Build Python code for browser action
        code = """
from playwright.async_api import async_playwright
import asyncio

async def browser_task():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True)
    page = await browser.new_page()
"""

        if action == "navigate":
            code += f"""
    await page.goto('{url}', wait_until='networkidle')
    content = await page.content()
    await browser.close()
    return content
"""

        elif action == "get_text":
            selector_str = f"'{selector}'" if selector else "'body'"
            code += f"""
    await page.goto('{url}', wait_until='networkidle')
    element = await page.query_selector({selector_str})
    text = await element.inner_text() if element else "Element not found"
    await browser.close()
    return text
"""

        elif action == "screenshot":
            code += f"""
    await page.goto('{url}', wait_until='networkidle')
    screenshot = await page.screenshot(path='/workspace/screenshot.png', full_page=True)
    await browser.close()
    return "Screenshot saved to /workspace/screenshot.png"
"""

        elif action == "click":
            code += f"""
    await page.goto('{url}', wait_until='networkidle')
    await page.click('{selector}')
    await page.wait_for_load_state('networkidle')
    await browser.close()
    return "Clicked on {selector}"
"""

        elif action == "fill_form":
            code += f"""
    await page.goto('{url}', wait_until='networkidle')
    await page.fill('{selector}', '{value}')
    await browser.close()
    return "Filled {selector} with value"
"""

        elif action == "extract_links":
            code += f"""
    await page.goto('{url}', wait_until='networkidle')
    links = await page.query_selector_all('a[href]')
    urls = [await link.get_attribute('href') for link in links]
    await browser.close()
    return '\\n'.join(urls[:50])  # First 50 links
"""

        code += """
try:
    result = asyncio.run(browser_task())
    print(result)
except Exception as e:
    print(f"Browser error: {e}")
"""

        return await self.run_python(code)

    async def web_search(self, query: str, num_results: int = 5) -> str:
        """
        Perform web search using Brave Search API (or DuckDuckGo as fallback).
        """
        logger.info(f"Web search: {query}")

        # Use Python requests to search (via DuckDuckGo HTML scraping as free option)
        code = f"""
import requests
from bs4 import BeautifulSoup
import json

query = "{query}"
url = f"https://html.duckduckgo.com/html/?q={{query}}"

headers = {{
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}}

response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, 'html.parser')

results = []
for result in soup.find_all('div', class_='result')[:  {num_results}]:
    title_elem = result.find('a', class_='result__a')
    snippet_elem = result.find('a', class_='result__snippet')

    if title_elem:
        results.append({{
            'title': title_elem.get_text(strip=True),
            'url': title_elem.get('href', ''),
            'snippet': snippet_elem.get_text(strip=True) if snippet_elem else ''
        }})

print(json.dumps(results, indent=2))
"""

        return await self.run_python(code)

    def list_files(self) -> List[str]:
        """List files in workspace."""
        try:
            exit_code, output = self.container.exec_run("ls -1 /workspace")
            if exit_code == 0:
                files = output.decode('utf-8').strip().split('\n')
                return [f for f in files if f and not f.startswith('_agent_')]
            return []
        except Exception as e:
            logger.error(f"Error listing files: {e}")
            return []

    def read_file(self, filename: str) -> str:
        """Read file from workspace."""
        try:
            exit_code, output = self.container.exec_run(f"cat /workspace/{filename}")
            if exit_code == 0:
                return output.decode('utf-8')
            return f"Error reading file: exit code {exit_code}"
        except Exception as e:
            return f"Error reading file: {str(e)}"

    def write_file(self, filename: str, content: str):
        """Write file to workspace."""
        try:
            # Use heredoc to write file
            cmd = f"cat > /workspace/{filename} << 'EOF'\n{content}\nEOF"
            exit_code, output = self.container.exec_run(f"bash -c '{cmd}'")
            return exit_code == 0
        except Exception as e:
            logger.error(f"Error writing file: {e}")
            return False

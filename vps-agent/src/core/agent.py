"""
WritGo.nl AI Agent - Core Agent Loop
Gebaseerd op Manus.im CodeAct paradigma + Abacus multi-model routing
"""

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from ..tools.sandbox import DockerSandbox
from ..tools.affiliate_tools import AffiliateTools, get_niche_keywords
from ..memory.event_stream import EventStream
from ..memory.file_storage import FileStorage
from .llm import LLMProvider, ModelRouter
from .planner import Planner
from .tools_definitions import TOOLS, ALL_TOOLS, get_tools

logger = logging.getLogger(__name__)


class AgentLoop:
    """
    Main agent loop implementing the Manus.im pattern:
    Observe → Plan → Act → Check
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        model_router: ModelRouter,
        sandbox: DockerSandbox,
        event_stream: EventStream,
        file_storage: FileStorage,
        max_iterations: int = 50,
        tool_categories: List[str] = None,
    ):
        self.llm = llm_provider
        self.router = model_router
        self.sandbox = sandbox
        self.events = event_stream
        self.storage = file_storage
        self.planner = Planner(llm_provider)
        self.max_iterations = max_iterations

        # Initialize affiliate tools
        self.affiliate_tools = AffiliateTools()

        # Select tools based on categories
        self.tools = get_tools(tool_categories) if tool_categories else ALL_TOOLS

    async def run(self, task: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Run the agent loop for a given task.

        Args:
            task: The task description
            context: Optional context (project_id, user preferences, etc.)

        Returns:
            Dict with status, result, iterations, etc.
        """
        logger.info(f"Starting agent loop for task: {task[:100]}...")

        # Initialize sandbox
        await self.sandbox.start()

        try:
            # === PHASE 1: PLANNING ===
            plan = await self.planner.create_plan(task, context)
            logger.info(f"Plan created with {len(plan['steps'])} steps")

            # Save plan to workspace (Manus todo.md pattern)
            await self.storage.save_file("todo.md", self.planner.format_plan(plan))

            # Initialize event stream
            self.events.add_event({
                "type": "task",
                "content": task,
                "timestamp": datetime.now().isoformat()
            })

            iteration = 0
            consecutive_errors = 0
            max_consecutive_errors = 3

            # === PHASE 2: EXECUTION LOOP ===
            while iteration < self.max_iterations:
                iteration += 1
                logger.info(f"Iteration {iteration}/{self.max_iterations}")

                # Build context for LLM
                context = self._build_context(plan)

                # Get next action from LLM (with model routing)
                action = await self._get_next_action(context, task)

                # Check if task is complete
                if action.get("type") == "complete":
                    logger.info("Task marked as complete by agent")
                    break

                # Execute action in sandbox
                observation = await self._execute_action(action)

                # Update event stream
                self.events.add_event({
                    "type": "action",
                    "content": action,
                    "timestamp": datetime.now().isoformat()
                })
                self.events.add_event({
                    "type": "observation",
                    "content": observation,
                    "timestamp": datetime.now().isoformat()
                })

                # Update plan progress
                self.planner.update_progress(action, observation)

                # Save updated plan
                await self.storage.save_file(
                    "todo.md",
                    self.planner.format_plan(plan)
                )

                # Error handling (Manus pattern: keep errors in context)
                if self._is_error(observation):
                    consecutive_errors += 1
                    logger.warning(f"Error in iteration {iteration}: {observation[:200]}")

                    if consecutive_errors >= max_consecutive_errors:
                        logger.error("Too many consecutive errors, stopping")
                        break

                    # Try recovery
                    recovery = await self._handle_error(observation, action)
                    self.events.add_event({
                        "type": "recovery",
                        "content": recovery,
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    consecutive_errors = 0  # Reset on success

                # Check plan completion
                if self.planner.is_complete(plan):
                    logger.info("All plan steps completed")
                    break

            # === PHASE 3: RESULT EXTRACTION ===
            result = await self._extract_result()

            return {
                "status": "completed" if iteration < self.max_iterations else "max_iterations",
                "result": result,
                "iterations": iteration,
                "plan": plan,
                "events": self.events.get_recent(20)
            }

        except Exception as e:
            logger.error(f"Agent loop error: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "iterations": iteration,
                "events": self.events.get_recent(20)
            }

        finally:
            # Cleanup sandbox
            await self.sandbox.stop()

    def _build_context(self, plan: Dict) -> Dict[str, Any]:
        """
        Build context for LLM including events, plan, and workspace state.
        Implements Manus's context engineering best practices.
        """
        # Get recent events (truncate to prevent token overflow)
        recent_events = self.events.get_recent(20)

        # Get workspace files
        workspace_files = self.sandbox.list_files()

        # Get current step from plan
        current_step = self.planner.get_current_step(plan)

        return {
            "events": recent_events,
            "plan": plan,
            "current_step": current_step,
            "workspace_files": workspace_files,
            "iteration_count": len([e for e in recent_events if e["type"] == "action"])
        }

    async def _get_next_action(self, context: Dict, original_task: str) -> Dict[str, Any]:
        """
        Get next action from LLM using multi-model routing (Abacus pattern).
        """
        # Build system prompt (Manus-style)
        system_prompt = self._build_system_prompt()

        # Build user prompt with context
        user_prompt = self._format_context_prompt(context, original_task)

        # Determine task complexity for model routing
        complexity = self._estimate_complexity(context)

        # Route to appropriate model (Abacus pattern)
        model = self.router.select_model(
            task_type=context["current_step"].get("type", "general"),
            complexity=complexity
        )

        logger.info(f"Using model: {model}")

        # Get response from LLM with tool calling
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        response = await self.llm.complete(
            messages=messages,
            tools=TOOLS,
            model=model
        )

        return self._parse_action(response)

    async def _execute_action(self, action: Dict[str, Any]) -> str:
        """
        Execute action in sandbox.
        Supports CodeAct paradigm (Python code) + traditional function calls + affiliate tools.
        """
        action_type = action.get("type")

        try:
            # === CORE TOOLS ===
            if action_type == "execute_python":
                # CodeAct paradigm: Execute Python code
                return await self.sandbox.run_python(action["code"])

            elif action_type == "shell_command":
                return await self.sandbox.run_shell(action["command"])

            elif action_type == "browser_navigate":
                return await self.sandbox.browser_action(
                    url=action["url"],
                    action=action["action"],
                    selector=action.get("selector")
                )

            elif action_type == "web_search":
                return await self.sandbox.web_search(action["query"])

            elif action_type == "save_file":
                await self.storage.save_file(action["filename"], action["content"])
                return f"File saved: {action['filename']}"

            elif action_type == "read_file":
                content = await self.storage.read_file(action["filename"])
                return content

            # === AFFILIATE TOOLS (Bol.com) ===
            elif action_type == "search_products":
                result = await self.affiliate_tools.search_products(
                    query=action["query"],
                    category=action.get("category"),
                    max_results=action.get("max_results", 10)
                )
                return json.dumps(result, indent=2, ensure_ascii=False)

            elif action_type == "get_product_details":
                result = await self.affiliate_tools.get_product_details(action["ean"])
                return json.dumps(result, indent=2, ensure_ascii=False)

            elif action_type == "generate_affiliate_link":
                link = self.affiliate_tools.bol_client.generate_affiliate_link(
                    action["product_url"],
                    action.get("product_name", "")
                )
                return f"Affiliate link: {link}"

            elif action_type == "analyze_competition":
                result = await self.affiliate_tools.analyze_competition(
                    query=action["query"],
                    num_competitors=action.get("num_competitors", 5)
                )
                return json.dumps(result, indent=2, ensure_ascii=False)

            elif action_type == "get_niche_suggestions":
                keywords = get_niche_keywords(action["niche"])
                return json.dumps({
                    "niche": action["niche"],
                    "keywords": keywords
                }, indent=2)

            # === CONTENT TOOLS ===
            elif action_type == "generate_review_outline":
                from ..tools.affiliate_tools import CONTENT_TEMPLATES
                template = CONTENT_TEMPLATES.get(
                    action.get("template", "product_review"),
                    CONTENT_TEMPLATES["product_review"]
                )
                return f"Template outline:\n{template}"

            elif action_type == "generate_seo_meta":
                # Generate SEO metadata
                title = action["title"]
                summary = action["content_summary"]
                keywords = action.get("target_keywords", [])

                meta = {
                    "meta_title": f"{title} | Vergelijking & Review {datetime.now().year}",
                    "meta_description": summary[:155] + "..." if len(summary) > 155 else summary,
                    "keywords": keywords
                }
                return json.dumps(meta, indent=2)

            elif action_type == "format_product_card":
                product = action["product"]
                rank = action.get("rank", 0)
                pros = action.get("pros", [])
                cons = action.get("cons", [])

                card_html = self._format_product_card_html(product, rank, pros, cons)
                return card_html

            # === WRITGO TOOLS ===
            elif action_type == "save_to_writgo":
                result = await self.affiliate_tools.save_content(
                    project_id=action["project_id"],
                    title=action["title"],
                    content=action["content"],
                    content_type=action.get("content_type", "article")
                )
                return json.dumps(result, indent=2)

            elif action_type == "schedule_content":
                result = await self.affiliate_tools.schedule_content_batch(
                    project_id=action["project_id"],
                    topics=action["topics"],
                    start_date=action["start_date"],
                    interval_days=action.get("interval_days", 1)
                )
                return json.dumps(result, indent=2)

            elif action_type == "get_affiliate_stats":
                result = await self.affiliate_tools.get_affiliate_stats(action["project_id"])
                return json.dumps(result, indent=2)

            else:
                return f"Unknown action type: {action_type}"

        except Exception as e:
            logger.error(f"Error executing {action_type}: {e}")
            return f"Error executing {action_type}: {str(e)}"

    def _format_product_card_html(
        self,
        product: Dict,
        rank: int = 0,
        pros: List[str] = None,
        cons: List[str] = None
    ) -> str:
        """Generate HTML product card for articles."""
        pros = pros or []
        cons = cons or []

        rank_badge = f'<div class="product-rank">#{rank}</div>' if rank > 0 else ''

        pros_html = ""
        if pros:
            pros_items = ''.join(f'<li>{p}</li>' for p in pros)
            pros_html = f'<div class="product-pros"><h4>Pluspunten</h4><ul>{pros_items}</ul></div>'

        cons_html = ""
        if cons:
            cons_items = ''.join(f'<li>{c}</li>' for c in cons)
            cons_html = f'<div class="product-cons"><h4>Minpunten</h4><ul>{cons_items}</ul></div>'

        return f'''
<div class="bol-product-card" data-ean="{product.get('ean', '')}">
  {rank_badge}
  <div class="product-image">
    <img src="{product.get('image_url', '')}" alt="{product.get('title', '')}" loading="lazy" />
  </div>
  <div class="product-info">
    <h3 class="product-title">{product.get('title', '')}</h3>
    <div class="product-price">€{product.get('price', 'N/A')}</div>
    <div class="product-rating">{'⭐' * int(product.get('rating', 0))} ({product.get('rating', 'N/A')}/5)</div>
    {pros_html}
    {cons_html}
    <a href="{product.get('affiliate_link', '#')}" target="_blank" rel="noopener sponsored" class="product-cta">
      Bekijk op Bol.com →
    </a>
  </div>
</div>
'''

    def _is_error(self, observation: str) -> bool:
        """Check if observation contains an error."""
        error_indicators = [
            "error:",
            "traceback",
            "exception",
            "failed",
            "command not found",
            "permission denied"
        ]
        return any(indicator in observation.lower() for indicator in error_indicators)

    async def _handle_error(self, observation: str, failed_action: Dict) -> str:
        """
        Handle errors by asking LLM to diagnose and suggest recovery.
        Manus pattern: Keep errors in context for learning.
        """
        recovery_prompt = f"""
        The following action failed:
        {failed_action}

        Error output:
        {observation}

        Diagnose the error and suggest how to fix it.
        """

        response = await self.llm.complete(
            messages=[{"role": "user", "content": recovery_prompt}],
            model=self.router.select_model("analysis", 0.5)
        )

        return response.get("content", "Unable to diagnose error")

    async def _extract_result(self) -> Dict[str, Any]:
        """
        Extract final result from workspace and event stream.
        """
        # Get all files created
        files = self.sandbox.list_files()

        # Get final output from events
        final_events = self.events.get_by_type("observation")[-5:]

        # Read result files
        result_data = {}
        for filename in files:
            if filename.endswith(('.json', '.md', '.txt', '.csv')):
                content = await self.storage.read_file(filename)
                result_data[filename] = content

        return {
            "files": files,
            "result_data": result_data,
            "final_observations": final_events
        }

    def _build_system_prompt(self) -> str:
        """
        Build system prompt following Manus.im pattern.
        """
        return """You are WritGo.nl AI Agent, an autonomous AI assistant that completes complex tasks.

You have access to a Ubuntu Linux sandbox with Python, Node.js, and browser automation tools.

## Your Capabilities:
- Execute Python code for data processing, analysis, web scraping
- Run shell commands for system operations
- Control a browser for web automation
- Search the web for information
- Read and write files to your workspace

## Agent Loop:
1. Analyze the current state and plan
2. Select ONE tool/action to take next
3. Wait for the observation (result)
4. Update your progress
5. Repeat until task is complete

## Rules:
- ALWAYS respond with a tool call, never direct text
- Execute ONE action per iteration
- Check results before proceeding to next step
- If an error occurs, diagnose it and try a different approach
- Keep errors in context to learn from them
- Use the todo.md file to track progress
- Save intermediate results to files
- For reports: minimum 3000-5000 words with citations

## CodeAct Paradigm:
You can write Python code as your action. This gives you maximum flexibility.
Import any libraries you need. The sandbox has requests, beautifulsoup4, pandas, playwright, etc.

Example:
```python
import requests
from bs4 import BeautifulSoup

response = requests.get('https://example.com')
soup = BeautifulSoup(response.text, 'html.parser')
data = soup.find_all('div', class_='content')

# Process and save
with open('results.txt', 'w') as f:
    for item in data:
        f.write(item.text + '\\n')
```

Now complete the task step by step."""

    def _format_context_prompt(self, context: Dict, task: str) -> str:
        """Format context into prompt for LLM."""
        recent_events = context["events"][-10:]  # Last 10 events

        prompt = f"""## Task:
{task}

## Current Plan:
{self.planner.format_plan(context['plan'])}

## Current Step:
{context['current_step']['description'] if context['current_step'] else 'Planning'}

## Recent Actions:
"""
        for event in recent_events:
            if event["type"] == "action":
                prompt += f"\nAction: {event['content'].get('type', 'unknown')}"
            elif event["type"] == "observation":
                # Truncate long observations
                obs = event["content"][:500]
                prompt += f"\nResult: {obs}\n"

        prompt += f"""

## Workspace Files:
{', '.join(context['workspace_files']) if context['workspace_files'] else 'None'}

What is your next action?"""

        return prompt

    def _estimate_complexity(self, context: Dict) -> float:
        """
        Estimate task complexity for model routing.
        Returns 0.0 (simple) to 1.0 (complex)
        """
        step = context.get("current_step", {})
        step_type = step.get("type", "general")

        # Complexity heuristics
        complexity = 0.5  # Default

        if step_type in ["code", "analysis", "research"]:
            complexity = 0.8
        elif step_type in ["browser", "scraping"]:
            complexity = 0.6
        elif step_type in ["simple", "file_operation"]:
            complexity = 0.3

        # Increase if many failed attempts
        error_count = len([e for e in context["events"] if "error" in str(e).lower()])
        complexity += min(error_count * 0.1, 0.3)

        return min(complexity, 1.0)

    def _parse_action(self, response: Dict) -> Dict[str, Any]:
        """Parse LLM response into action dict."""
        if "tool_calls" in response and response["tool_calls"]:
            tool_call = response["tool_calls"][0]
            return {
                "type": tool_call["function"]["name"],
                **tool_call["function"]["arguments"]
            }

        # Fallback: try to extract from content
        content = response.get("content", "")
        if "complete" in content.lower():
            return {"type": "complete"}

        return {"type": "unknown", "content": content}

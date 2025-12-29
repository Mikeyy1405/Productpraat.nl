"""
Planner Module - Manus.im todo.md pattern
Breaks tasks into numbered steps and tracks progress
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class Planner:
    """
    Task planner implementing Manus.im's todo.md pattern.
    Creates numbered action plans and tracks progress.
    """

    def __init__(self, llm_provider):
        self.llm = llm_provider

    async def create_plan(self, task: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Create a structured plan for the task.

        Args:
            task: Task description
            context: Optional context (project info, user preferences)

        Returns:
            Plan dict with steps, metadata, etc.
        """
        logger.info(f"Creating plan for task: {task[:100]}...")

        # Build planning prompt
        planning_prompt = self._build_planning_prompt(task, context)

        # Get plan from LLM
        response = await self.llm.complete(
            messages=[{"role": "user", "content": planning_prompt}],
            model="claude-opus-4-20250514"  # Use Opus for planning
        )

        # Parse response into structured plan
        plan = self._parse_plan_response(response["content"], task)

        logger.info(f"Plan created with {len(plan['steps'])} steps")

        return plan

    def _build_planning_prompt(self, task: str, context: Optional[Dict]) -> str:
        """Build prompt for plan generation."""
        prompt = f"""Create a detailed, step-by-step plan to accomplish this task:

{task}

"""
        if context:
            prompt += f"""Additional context:
- Project: {context.get('project_name', 'N/A')}
- Priority: {context.get('priority', 'normal')}
"""

        prompt += """
Break the task into specific, actionable steps.
Each step should be clear and measurable.

Format your response as a numbered list:
1. [Step description]
2. [Step description]
...

Be thorough but concise. Focus on the "what" not the "how" (the agent will figure out how).

Output ONLY the numbered list, no additional text.
"""
        return prompt

    def _parse_plan_response(self, response: str, original_task: str) -> Dict[str, Any]:
        """Parse LLM response into structured plan dict."""
        lines = response.strip().split('\n')
        steps = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Parse numbered steps (1., 2., etc.)
            if line[0].isdigit() and ('.' in line or ')' in line):
                # Remove number prefix
                step_text = line.split('.', 1)[-1].split(')', 1)[-1].strip()

                # Infer step type from content
                step_type = self._infer_step_type(step_text)

                steps.append({
                    "description": step_text,
                    "status": "pending",
                    "type": step_type,
                    "started_at": None,
                    "completed_at": None,
                    "observation": None
                })

        return {
            "task": original_task,
            "steps": steps,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }

    def _infer_step_type(self, step_text: str) -> str:
        """Infer step type from description."""
        text_lower = step_text.lower()

        if any(keyword in text_lower for keyword in ["search", "google", "find information"]):
            return "research"
        elif any(keyword in text_lower for keyword in ["scrape", "browser", "navigate", "website"]):
            return "browser"
        elif any(keyword in text_lower for keyword in ["analyze", "process", "calculate"]):
            return "analysis"
        elif any(keyword in text_lower for keyword in ["write", "create file", "save", "generate"]):
            return "file_operation"
        elif any(keyword in text_lower for keyword in ["code", "script", "program"]):
            return "code"
        else:
            return "general"

    def format_plan(self, plan: Dict[str, Any]) -> str:
        """
        Format plan as Manus-style todo.md file.

        Example output:
        # Task: Create market analysis report

        ## Plan:
        1. [x] Research top 10 competitors
        2. [ ] Analyze pricing strategies
        3. [ ] Write report
        ...
        """
        output = f"# Task: {plan['task']}\n\n"
        output += f"## Plan\n\n"
        output += f"Created: {plan['created_at']}\n"
        output += f"Status: {plan['status']}\n\n"

        for i, step in enumerate(plan['steps'], 1):
            status_icon = "[x]" if step['status'] == 'completed' else "[ ]"
            output += f"{i}. {status_icon} {step['description']}\n"

            if step['observation']:
                output += f"   → {step['observation'][:200]}...\n"

        output += "\n## Progress\n\n"
        completed = len([s for s in plan['steps'] if s['status'] == 'completed'])
        total = len(plan['steps'])
        progress = (completed / total * 100) if total > 0 else 0

        output += f"Completed: {completed}/{total} ({progress:.1f}%)\n"

        return output

    def update_progress(self, action: Dict, observation: str):
        """
        Update plan progress based on action and observation.
        Match action to plan step and mark as completed.
        """
        # This will be called from agent loop
        # For now, placeholder - full implementation would match action to step
        pass

    def get_current_step(self, plan: Dict[str, Any]) -> Optional[Dict]:
        """Get the current pending step from plan."""
        for step in plan['steps']:
            if step['status'] == 'pending':
                return step
        return None

    def is_complete(self, plan: Dict[str, Any]) -> bool:
        """Check if all steps in plan are completed."""
        return all(step['status'] == 'completed' for step in plan['steps'])

    def mark_step_complete(self, plan: Dict[str, Any], step_index: int, observation: str):
        """Mark a specific step as completed."""
        if 0 <= step_index < len(plan['steps']):
            plan['steps'][step_index]['status'] = 'completed'
            plan['steps'][step_index]['completed_at'] = datetime.now().isoformat()
            plan['steps'][step_index]['observation'] = observation

    def mark_step_failed(self, plan: Dict[str, Any], step_index: int, error: str):
        """Mark a specific step as failed."""
        if 0 <= step_index < len(plan['steps']):
            plan['steps'][step_index]['status'] = 'failed'
            plan['steps'][step_index]['completed_at'] = datetime.now().isoformat()
            plan['steps'][step_index]['observation'] = f"ERROR: {error}"

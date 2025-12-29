"""
LLM Provider & Model Router
Supports Claude (Anthropic) and OpenAI with multi-model routing (Abacus pattern)
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def complete(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate completion with optional tool calling."""
        pass


class ClaudeProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, api_key: str, default_model: str = "claude-opus-4-20250514"):
        self.client = AsyncAnthropic(api_key=api_key)
        self.default_model = default_model

    async def complete(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate completion using Claude."""
        model = model or self.default_model

        # Separate system message if present
        system_msg = None
        user_messages = messages

        if messages and messages[0]["role"] == "system":
            system_msg = messages[0]["content"]
            user_messages = messages[1:]

        try:
            response = await self.client.messages.create(
                model=model,
                messages=user_messages,
                system=system_msg,
                tools=tools if tools else [],
                max_tokens=kwargs.get("max_tokens", 4096),
                temperature=kwargs.get("temperature", 0.7)
            )

            # Parse response
            result = {
                "content": "",
                "tool_calls": []
            }

            for content_block in response.content:
                if content_block.type == "text":
                    result["content"] += content_block.text
                elif content_block.type == "tool_use":
                    result["tool_calls"].append({
                        "id": content_block.id,
                        "function": {
                            "name": content_block.name,
                            "arguments": content_block.input
                        }
                    })

            logger.info(f"Claude response: {result['content'][:100]}...")
            if result["tool_calls"]:
                logger.info(f"Tool calls: {[tc['function']['name'] for tc in result['tool_calls']]}")

            return result

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""

    def __init__(self, api_key: str, default_model: str = "gpt-4-turbo-preview"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.default_model = default_model

    async def complete(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate completion using OpenAI."""
        model = model or self.default_model

        try:
            completion_kwargs = {
                "model": model,
                "messages": messages,
                "temperature": kwargs.get("temperature", 0.7),
                "max_tokens": kwargs.get("max_tokens", 4096)
            }

            if tools:
                completion_kwargs["tools"] = tools
                completion_kwargs["tool_choice"] = "auto"

            response = await self.client.chat.completions.create(**completion_kwargs)

            message = response.choices[0].message

            result = {
                "content": message.content or "",
                "tool_calls": []
            }

            if message.tool_calls:
                for tool_call in message.tool_calls:
                    result["tool_calls"].append({
                        "id": tool_call.id,
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": eval(tool_call.function.arguments)  # JSON string to dict
                        }
                    })

            logger.info(f"OpenAI response: {result['content'][:100]}...")
            if result["tool_calls"]:
                logger.info(f"Tool calls: {[tc['function']['name'] for tc in result['tool_calls']]}")

            return result

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise


class ModelRouter:
    """
    Multi-model routing based on Abacus Deep Agent pattern.
    Selects optimal model based on task type and complexity.
    """

    def __init__(
        self,
        providers: Dict[str, LLMProvider],
        config: Optional[Dict] = None
    ):
        self.providers = providers
        self.config = config or {}

        # Model configurations
        self.models = {
            "complex": self.config.get("MODEL_COMPLEX", "claude-opus-4-20250514"),
            "fast": self.config.get("MODEL_FAST", "claude-haiku-3-20250307"),
            "coding": self.config.get("MODEL_CODING", "claude-sonnet-4-20250514"),
            "default": self.config.get("DEFAULT_MODEL", "claude-opus-4-20250514")
        }

    def select_model(self, task_type: str, complexity: float) -> str:
        """
        Select optimal model based on task type and complexity.

        Args:
            task_type: Type of task (code, analysis, research, simple, etc.)
            complexity: Complexity score from 0.0 to 1.0

        Returns:
            Model identifier string
        """
        # High complexity tasks → Opus
        if complexity > 0.7:
            logger.info(f"High complexity ({complexity}), using Opus")
            return self.models["complex"]

        # Coding tasks → Sonnet (balanced)
        if task_type in ["code", "coding", "programming"]:
            logger.info(f"Coding task, using Sonnet")
            return self.models["coding"]

        # Low complexity, quick tasks → Haiku
        if complexity < 0.3 and task_type in ["simple", "file_operation", "read"]:
            logger.info(f"Simple task ({complexity}), using Haiku")
            return self.models["fast"]

        # Analysis, research → Opus
        if task_type in ["analysis", "research", "planning"]:
            logger.info(f"Complex task type ({task_type}), using Opus")
            return self.models["complex"]

        # Default: Opus for reliability
        logger.info(f"Default routing, using Opus")
        return self.models["default"]

    def get_provider(self, model: str) -> LLMProvider:
        """Get the provider for a given model."""
        # Determine provider based on model name
        if "gpt" in model.lower():
            return self.providers.get("openai")
        elif "claude" in model.lower():
            return self.providers.get("claude")
        else:
            # Default to Claude
            return self.providers.get("claude")


def create_llm_setup(config: Dict) -> tuple[LLMProvider, ModelRouter]:
    """
    Factory function to create LLM provider and router.

    Args:
        config: Configuration dict with API keys and model settings

    Returns:
        Tuple of (default_provider, model_router)
    """
    providers = {}

    # Initialize Claude if API key present
    if config.get("ANTHROPIC_API_KEY"):
        providers["claude"] = ClaudeProvider(
            api_key=config["ANTHROPIC_API_KEY"],
            default_model=config.get("DEFAULT_MODEL", "claude-opus-4-20250514")
        )
        logger.info("Claude provider initialized")

    # Initialize OpenAI if API key present
    if config.get("OPENAI_API_KEY"):
        providers["openai"] = OpenAIProvider(
            api_key=config["OPENAI_API_KEY"],
            default_model=config.get("OPENAI_MODEL", "gpt-4-turbo-preview")
        )
        logger.info("OpenAI provider initialized")

    if not providers:
        raise ValueError("No LLM providers configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY")

    # Create router
    router = ModelRouter(providers, config)

    # Default provider (Claude preferred)
    default_provider = providers.get("claude") or providers.get("openai")

    return default_provider, router

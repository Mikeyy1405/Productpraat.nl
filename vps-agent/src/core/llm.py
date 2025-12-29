"""
LLM Provider & Model Router
Supports Abacus.AI (Claude via OpenAI-compatible API) with multi-model routing
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
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


class AbacusProvider(LLMProvider):
    """Abacus.AI LLM provider (OpenAI-compatible API for Claude models)."""

    def __init__(self, api_key: str, base_url: str = "https://api.abacus.ai/v1", default_model: str = "claude-3-5-sonnet"):
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.default_model = default_model

    async def complete(
        self,
        messages: List[Dict],
        tools: Optional[List[Dict]] = None,
        model: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate completion using Abacus.AI."""
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
                import json
                for tool_call in message.tool_calls:
                    result["tool_calls"].append({
                        "id": tool_call.id,
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": json.loads(tool_call.function.arguments)
                        }
                    })

            logger.info(f"Abacus response: {result['content'][:100]}...")
            if result["tool_calls"]:
                logger.info(f"Tool calls: {[tc['function']['name'] for tc in result['tool_calls']]}")

            return result

        except Exception as e:
            logger.error(f"Abacus API error: {e}")
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

        # Model configurations (Abacus.AI model names)
        self.models = {
            "complex": self.config.get("MODEL_COMPLEX", "claude-3-5-sonnet"),
            "fast": self.config.get("MODEL_FAST", "claude-3-haiku"),
            "coding": self.config.get("MODEL_CODING", "claude-3-5-sonnet"),
            "default": self.config.get("DEFAULT_MODEL", "claude-3-5-sonnet")
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
            return self.providers.get("abacus")
        else:
            # Default to Abacus (Claude)
            return self.providers.get("abacus")


def create_llm_setup(config: Dict) -> tuple[LLMProvider, ModelRouter]:
    """
    Factory function to create LLM provider and router.

    Args:
        config: Configuration dict with API keys and model settings

    Returns:
        Tuple of (default_provider, model_router)
    """
    providers = {}

    # Initialize Abacus.AI if API key present (primary provider)
    if config.get("ABACUS_API_KEY"):
        providers["abacus"] = AbacusProvider(
            api_key=config["ABACUS_API_KEY"],
            base_url=config.get("ABACUS_BASE_URL", "https://api.abacus.ai/v1"),
            default_model=config.get("DEFAULT_MODEL", "claude-3-5-sonnet")
        )
        logger.info("Abacus.AI provider initialized")

    # Initialize OpenAI if API key present (optional fallback)
    if config.get("OPENAI_API_KEY"):
        providers["openai"] = OpenAIProvider(
            api_key=config["OPENAI_API_KEY"],
            default_model=config.get("OPENAI_MODEL", "gpt-4-turbo-preview")
        )
        logger.info("OpenAI provider initialized")

    if not providers:
        raise ValueError("No LLM providers configured. Set ABACUS_API_KEY")

    # Create router
    router = ModelRouter(providers, config)

    # Default provider (Abacus preferred)
    default_provider = providers.get("abacus") or providers.get("openai")

    return default_provider, router

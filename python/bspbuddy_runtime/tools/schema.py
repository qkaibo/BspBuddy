"""Tool schema: minimal JSON-Schema-based tool definition.

Tools are declared as name + description + parameters (JSON Schema),
then converted to OpenAI function-calling format by the client.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

# Type alias for the raw callable stored in the registry.
ToolFn = Callable[..., Any]


@dataclass
class ToolSchema:
    """A tool that can be called by the LLM via function calling."""

    name: str
    description: str
    parameters: dict[str, Any] = field(
        default_factory=lambda: {"type": "object", "properties": {}, "required": []}
    )
    # Local Python function to execute when LLM calls this tool
    fn: ToolFn | None = None

    def to_openai(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }

    async def execute(self, **kwargs: Any) -> str:
        """Execute the tool and return its result as a string."""
        if not self.fn:
            return f"Tool '{self.name}' has no local implementation."
        try:
            result = self.fn(**kwargs)
            return str(result)
        except Exception as e:
            return f"Tool '{self.name}' failed: {e}"

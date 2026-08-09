"""Web search tool placeholder.

In a full implementation this would call a search API (Bing, SerpAPI, etc.).
For now it's a stub that returns a helpful message.
"""

from bspbuddy_runtime.tools.registry import ToolRegistry


def _web_search(query: str) -> str:
    """Stub web search — returns a placeholder result."""
    return f"[web_search] Stub result for query: {query}\nThis tool requires a search API key to be configured."


def register_search_tools(
    registry: ToolRegistry,
    modes: list[str] | None = None,
) -> None:
    registry.register(
        name="web_search",
        description="Search the web for information. Returns search result snippets.",
        fn=_web_search,
        parameters={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query string.",
                }
            },
            "required": ["query"],
        },
        modes=modes,
    )

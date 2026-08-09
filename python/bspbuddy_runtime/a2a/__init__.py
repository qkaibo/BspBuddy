"""A2A (Agent-to-Agent) protocol support for BspBuddy Sidecar runtime.

Provides agent discovery and task delegation from the local Sidecar
to server-side experts via the A2A protocol.
"""

from bspbuddy_runtime.a2a.client import A2AClient

__all__ = ["A2AClient"]

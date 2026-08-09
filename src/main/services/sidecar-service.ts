// ============================================================
// Sidecar Service — manages the Python local agent runtime process.
//
// Spawns: python -m bspbuddy_runtime
// Communicates via stdin/stdout JSON-RPC (line-delimited JSON).
//
// Lifecycle:
//   initialize({workspaceRoot, inference}) → spawn process
//   startTurn({turnId, conversationId, message, mode}) → stream events
//   cancel(turnId) → cancel in-flight turn
//   shutdown() → kill process
// ============================================================

import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { app } from "electron";
import { existsSync } from "node:fs";
import type { LocalModelConfig } from "./model-config-local";

// ── types ────────────────────────────────────────────────────────────────

export interface SidecarInference {
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface SidecarInitializeParams {
  workspaceRoot: string;
  inference: SidecarInference;
  userId?: string;
  /** Backend URL for A2A agent discovery and delegation */
  backendUrl?: string;
  /** Auth token for backend API calls */
  authToken?: string;
}

export interface SidecarStartTurnParams {
  turnId: string;
  conversationId: string;
  message: string;
  mode?: "craft" | "ask" | "plan" | "design";
  /** Tools to register (OpenAI function calling format). MCP tools from Electron. */
  tools?: Array<{ name: string; description: string; parameters?: Record<string, unknown> }>;
  /** User-defined rules (like .cursorrules) */
  userRules?: string;
  /** Memory context from previous conversations */
  memoryContext?: string;
  /** Expert ID for A2A delegation context */
  expertId?: string;
  /** Context resources (experts/knowledge/SOPs) selected by user in ConversationContextBar */
  contextResources?: string;
}

export type SidecarEventType =
  | "content_delta"
  | "tool_use_start"
  | "tool_use_end"
  | "message_final"
  | "error";

export interface SidecarEvent {
  type: SidecarEventType;
  text?: string;           // content_delta
  content?: string;        // message_final
  tool_name?: string;      // tool_use_start / tool_use_end
  arguments?: Record<string, unknown>;  // tool_use_start
  result?: string;         // tool_use_end
  stop_reason?: string;    // message_final
  message?: string;        // error
}

export interface SidecarTurnResult {
  turnId: string;
  status: "completed" | "error";
}

// ── constants ────────────────────────────────────────────────────────────

const PYTHON_EXE = "python";
const MODULE_NAME = "bspbuddy_runtime";

// ── service ──────────────────────────────────────────────────────────────

class SidecarService {
  private _proc: ChildProcess | null = null;
  private _ready = false;
  private _requestId = 0;
  private _pending: Map<number, {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
  }> = new Map();
  private _buffer = "";
  private _eventHandlers: Map<string, Set<(event: SidecarEvent) => void>> = new Map();

  // ── lifecycle ────────────────────────────────────────────────────────

  isRunning(): boolean {
    return this._proc !== null && !this._proc.killed;
  }

  async initialize(params: SidecarInitializeParams): Promise<void> {
    if (this._proc) {
      await this.shutdown();
    }

    const pythonPath = this._resolvePython();
    // Get the bspbuddy_runtime module path
    // In development, it's at <project>/python/
    // In production (packaged), it should be bundled as extraResources
    const projectRoot = join(app.getAppPath(), "..", "..");
    const runtimePath = join(projectRoot, "python");

    if (!existsSync(runtimePath)) {
      throw new Error(
        `bspbuddy_runtime not found at: ${runtimePath}. ` +
        `Ensure the python/ directory is present.`
      );
    }

    const env = {
      ...process.env,
      PYTHONPATH: runtimePath,
      PYTHONUNBUFFERED: "1",
    };

    this._proc = spawn(pythonPath, ["-m", MODULE_NAME], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: params.workspaceRoot,
    });

    // Collect stderr for debugging
    this._proc.stderr?.on("data", (data: Buffer) => {
      console.log(`[sidecar:py] ${data.toString().trim()}`);
    });

    // Collect stdout for JSON-RPC responses/notifications
    this._proc.stdout?.on("data", (data: Buffer) => {
      this._onData(data.toString());
    });

    this._proc.on("exit", (code: number | null) => {
      console.log(`[sidecar] process exited with code ${code}`);
      this._ready = false;
      this._proc = null;
      // Reject all pending
      for (const [, pending] of this._pending) {
        pending.reject(new Error(`Sidecar process exited (code ${code})`));
      }
      this._pending.clear();
    });

    this._proc.on("error", (err: Error) => {
      console.error(`[sidecar] process error:`, err.message);
      this._ready = false;
    });

    // Wait for initialize response
    const result = await this._call("initialize", {
      workspaceRoot: params.workspaceRoot,
      inference: {
        model: params.inference.model,
        apiKey: params.inference.apiKey,
        baseUrl: params.inference.baseUrl,
      },
      userId: params.userId || "",
      backendUrl: params.backendUrl || "",
      authToken: params.authToken || "",
    }) as { ok: boolean; protocolVersion: string; capabilities: Record<string, boolean> };

    if (!result.ok) {
      throw new Error("Sidecar initialize returned ok=false");
    }

    this._ready = true;
    console.log(`[sidecar] initialized (protocol ${result.protocolVersion})`);
  }

  async shutdown(): Promise<void> {
    if (!this._proc) return;
    try {
      await this._call("shutdown", {});
    } catch {
      // ignore — process may already be dead
    }
    this._proc.kill();
    this._proc = null;
    this._ready = false;
  }

  // ── turns ─────────────────────────────────────────────────────────────

  /**
   * Start a turn and stream events via the callback.
   * Returns a promise that resolves when the turn completes.
   */
  startTurn(
    params: SidecarStartTurnParams,
    onEvent: (event: SidecarEvent) => void,
  ): Promise<SidecarTurnResult> {
    const turnId = params.turnId;
    return new Promise((resolve, reject) => {
      // Register event handler for this turn
      const handler = (event: SidecarEvent) => {
        onEvent(event);
        // Check if this is the terminal message_final or error
        if (event.type === "message_final" || event.type === "error") {
          this._eventHandlers.get(turnId)?.delete(handler);
        }
      };
      this._on(turnId, handler);

      // Send the startTurn request (deferred response — reply when turn completes)
      this._call("startTurn", {
        turnId: params.turnId,
        conversationId: params.conversationId,
        message: params.message,
        mode: params.mode || "craft",
        tools: params.tools || [],
        userRules: params.userRules || "",
        memoryContext: params.memoryContext || "",
        expertId: params.expertId || "",
        contextResources: params.contextResources || "",
      })
        .then((result) => {
          resolve(result as SidecarTurnResult);
        })
        .catch(reject);
    });
  }

  async cancel(turnId: string): Promise<boolean> {
    const result = await this._call("cancel", { turnId }) as { cancelled: boolean };
    return result.cancelled;
  }

  // ── IPC helpers ────────────────────────────────────────────────────────

  private _on(turnId: string, handler: (event: SidecarEvent) => void) {
    if (!this._eventHandlers.has(turnId)) {
      this._eventHandlers.set(turnId, new Set());
    }
    this._eventHandlers.get(turnId)!.add(handler);
  }

  private _emit(turnId: string, event: SidecarEvent) {
    const handlers = this._eventHandlers.get(turnId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (e) {
          console.error("[sidecar] event handler error:", e);
        }
      }
    }
  }

  private async _call(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this._requestId;
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }) + "\n";

    const promise = new Promise<unknown>((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      // Timeout after 120s
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`Sidecar RPC timeout: ${method}`));
        }
      }, 120_000);
    });

    if (this._proc?.stdin?.writable) {
      this._proc.stdin.write(request);
    } else {
      this._pending.delete(id);
      throw new Error("Sidecar stdin not writable");
    }

    return promise;
  }

  private _onData(chunk: string) {
    this._buffer += chunk;
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.method === "turn/event") {
          // Notification: turn event → emit to listeners
          const params = message.params || {};
          const turnId = params.turnId || "";
          const event: SidecarEvent = {
            type: params.type,
            text: params.text,
            content: params.content,
            tool_name: params.tool_name,
            arguments: params.arguments,
            result: params.result,
            stop_reason: params.stop_reason,
            message: params.message,
          };
          // Broadcast to all event handlers (not turn-specific for now)
          for (const [, handlers] of this._eventHandlers) {
            for (const handler of handlers) {
              try {
                handler(event);
              } catch {
                // ignore handler errors
              }
            }
          }
        } else if (message.id !== undefined) {
          // Response to a pending request
          const pending = this._pending.get(message.id);
          if (pending) {
            this._pending.delete(message.id);
            if (message.error) {
              pending.reject(
                new Error(
                  `[${message.error.code}] ${message.error.message}`
                )
              );
            } else {
              pending.resolve(message.result);
            }
          }
        }
      } catch (e) {
        console.error("[sidecar] failed to parse line:", line.slice(0, 200), e);
      }
    }
  }

  private _resolvePython(): string {
    // Prefer the configured Python path, fallback to "python"
    return process.env.BSPBUDDY_PYTHON || PYTHON_EXE;
  }

  getInferenceFromLocalConfig(config: LocalModelConfig): SidecarInference {
    return {
      model: config.model,
      apiKey: config.api_key,
      baseUrl: config.base_url || "",
    };
  }
}

// ── singleton ─────────────────────────────────────────────────────────────

export const sidecarService = new SidecarService();

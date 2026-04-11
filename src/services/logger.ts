/**
 * Structured logging + tool-call wrapping.
 *
 * Every tool call emits a single JSON line to stderr with:
 *   { ts, tool, inputHash, latencyMs, status, errorMessage? }
 *
 * stderr is used (not stdout) because stdio MCP transport sends the JSON-RPC
 * protocol on stdout — writing logs there would corrupt the transport.
 *
 * Tool handlers never throw (they always return { content: [...] }), so we
 * detect errors by inspecting the first content block for an "Error:" prefix.
 * This matches the convention established by handleApiError() in api-client.ts.
 */

import crypto from "node:crypto";

export type ToolStatus = "success" | "error";

export interface ToolCallLog {
  ts: string;
  tool: string;
  inputHash: string;
  latencyMs: number;
  status: ToolStatus;
  errorMessage?: string;
}

export function logToolCall(entry: ToolCallLog): void {
  process.stderr.write(JSON.stringify(entry) + "\n");
}

function hashInput(input: unknown): string {
  try {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(input ?? null))
      .digest("hex")
      .slice(0, 12);
  } catch {
    return "unhashable";
  }
}

interface ContentBlock {
  type: string;
  text?: string;
}
interface ToolResult {
  content?: ContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
}

function detectErrorStatus(result: ToolResult): { status: ToolStatus; errorMessage?: string } {
  if (result?.isError) {
    const first = result.content?.[0]?.text;
    return { status: "error", errorMessage: first };
  }
  const first = result?.content?.[0];
  if (first?.type === "text" && typeof first.text === "string" && first.text.startsWith("Error:")) {
    return { status: "error", errorMessage: first.text };
  }
  return { status: "success" };
}

/**
 * Wrap a tool handler so every invocation is logged to stderr with timing,
 * input hash, and success/error status. The handler signature is preserved
 * so callers pass the wrapped result straight to server.registerTool(...).
 */
export function wrapTool<A, R extends ToolResult>(
  name: string,
  handler: (args: A) => Promise<R>
): (args: A) => Promise<R> {
  return async (args: A) => {
    const startTs = Date.now();
    const inputHash = hashInput(args);
    try {
      const result = await handler(args);
      const latencyMs = Date.now() - startTs;
      const { status, errorMessage } = detectErrorStatus(result);
      logToolCall({
        ts: new Date().toISOString(),
        tool: name,
        inputHash,
        latencyMs,
        status,
        ...(errorMessage !== undefined ? { errorMessage } : {}),
      });
      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTs;
      logToolCall({
        ts: new Date().toISOString(),
        tool: name,
        inputHash,
        latencyMs,
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

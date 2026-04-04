/**
 * Luau Execution Tools
 *
 * Execute Luau scripts headlessly in running Roblox experiences via Open Cloud.
 * This is the most powerful API for agentic workflows — agents can read game state,
 * modify data, and deploy changes without Roblox Studio.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, placeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp } from "../services/api-client.js";
import { LUAU_EXECUTION_BASE, LUAU_EXECUTION_TIMEOUT_MS, LUAU_POLL_INTERVAL_MS, LUAU_MAX_POLL_ATTEMPTS } from "../constants.js";
import { LuauExecutionTask, ResponseFormat } from "../types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerLuauExecutionTools(server: McpServer): void {
  // ── Execute Luau Script ──────────────────────────────────────────────
  const ExecuteLuauSchema = z.object({
    universe_id: universeIdSchema,
    place_id: placeIdSchema,
    script: z
      .string()
      .min(1, "Script cannot be empty")
      .describe(
        "Luau source code to execute. The script runs headlessly in the Roblox engine " +
        "with access to the full DataModel. Return values via 'return' at the end of the script. " +
        "Example: 'return game:GetService(\"Players\"):GetChildren()'"
      ),
    timeout_seconds: z
      .number()
      .int()
      .min(5)
      .max(120)
      .default(30)
      .describe("Maximum seconds to wait for execution to complete (default 30)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_execute_luau",
    {
      title: "Execute Luau Script",
      description: `Execute a Luau script headlessly in a running Roblox experience via Open Cloud.

The script runs within the Roblox engine with access to the full DataModel, services, and APIs.
This is extremely powerful — you can read game state, modify data stores, send messages,
inspect the workspace, and more.

The script must end with a 'return' statement to produce output. The execution is asynchronous —
this tool submits the script, polls for completion, and returns the result.

Args:
  - universe_id (string): Universe ID of the experience
  - place_id (string): Place ID to execute in
  - script (string): Luau source code to execute
  - timeout_seconds (number): Max wait time in seconds (default: 30)
  - response_format ('markdown' | 'json'): Output format

Returns:
  Execution results including return values, state, and timing information.

Examples:
  - Read player count: script="return #game:GetService('Players'):GetPlayers()"
  - Inspect DataStore: script="local ds = game:GetService('DataStoreService'):GetDataStore('PlayerData') return ds:GetAsync('player_123')"
  - Check server info: script="return {placeId=game.PlaceId, placeVersion=game.PlaceVersion, jobId=game.JobId}"

Requires API key scope: luau-execution-sessions:write`,
      inputSchema: ExecuteLuauSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof ExecuteLuauSchema>) => {
      try {
        const baseUrl = LUAU_EXECUTION_BASE(params.universe_id, params.place_id);

        // Submit the execution task
        const task = await makeApiRequest<LuauExecutionTask>(
          `${baseUrl}/luau-execution-session-tasks`,
          "POST",
          { script: params.script },
          undefined,
          LUAU_EXECUTION_TIMEOUT_MS
        );

        const taskPath = task.path;
        const maxAttempts = Math.min(
          Math.ceil(params.timeout_seconds / (LUAU_POLL_INTERVAL_MS / 1000)),
          LUAU_MAX_POLL_ATTEMPTS
        );

        // Poll for completion
        let result = task;
        for (let i = 0; i < maxAttempts; i++) {
          if (result.state === "COMPLETE" || result.state === "FAILED" || result.state === "CANCELLED") {
            break;
          }
          await sleep(LUAU_POLL_INTERVAL_MS);
          result = await makeApiRequest<LuauExecutionTask>(
            `https://apis.roblox.com/cloud/v2/${taskPath}`,
            "GET"
          );
        }

        // Format output
        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        }

        const lines: string[] = [];
        lines.push(`# Luau Execution Result`);
        lines.push("");
        lines.push(`**State:** ${result.state}`);
        lines.push(`**Submitted:** ${formatTimestamp(result.createTime)}`);
        lines.push(`**Completed:** ${formatTimestamp(result.updateTime)}`);
        lines.push("");

        if (result.state === "COMPLETE" && result.output) {
          lines.push("## Output");
          lines.push("```json");
          lines.push(JSON.stringify(result.output.results, null, 2));
          lines.push("```");
        } else if (result.state === "FAILED" && result.error) {
          lines.push("## Error");
          lines.push(`**Code:** ${result.error.code}`);
          lines.push(`**Message:** ${result.error.message}`);
        } else if (result.state === "PROCESSING") {
          lines.push("⏳ Execution still in progress — timed out waiting. The task may still complete.");
          lines.push(`Task path: ${taskPath}`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );

  // ── Get Luau Execution Task ──────────────────────────────────────────
  const GetTaskSchema = z.object({
    universe_id: universeIdSchema,
    place_id: placeIdSchema,
    session_id: z.string().describe("The execution session/task ID to check"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_luau_task",
    {
      title: "Get Luau Execution Task Status",
      description: `Check the status of a previously submitted Luau execution task.

Use this to poll a long-running script or retrieve results you didn't wait for.

Requires API key scope: luau-execution-sessions:read`,
      inputSchema: GetTaskSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: z.infer<typeof GetTaskSchema>) => {
      try {
        const baseUrl = LUAU_EXECUTION_BASE(params.universe_id, params.place_id);
        const result = await makeApiRequest<LuauExecutionTask>(
          `${baseUrl}/luau-execution-session-tasks/${params.session_id}`,
          "GET"
        );

        if (params.response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: `**State:** ${result.state}\n**Updated:** ${formatTimestamp(result.updateTime)}\n\n` +
              (result.output ? `**Output:**\n\`\`\`json\n${JSON.stringify(result.output.results, null, 2)}\n\`\`\`` : "") +
              (result.error ? `**Error:** ${result.error.code} — ${result.error.message}` : ""),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    }
  );
}

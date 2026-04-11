/**
 * Messaging Service Tools
 *
 * Publish messages to running Roblox experience servers from external sources.
 * Enables agent-to-game-server communication for live operations.
 *
 * Uses Messaging Service v2 (Cloud v2 `:publishMessage` sub-operation, GA since
 * December 2025). The legacy v1 endpoint is available as a fallback for API keys
 * that only hold the legacy `universe-messaging-service.v1:publish` scope.
 *
 * Base URL (v2): https://apis.roblox.com/cloud/v2/universes/{id}:publishMessage
 * Base URL (v1): https://apis.roblox.com/messaging-service/v1/universes/{id}/topics/{topic}
 * API key scope: universe-messaging-service:publish (v2) or
 *                universe-messaging-service.v1:publish (v1)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { MESSAGING_V1_BASE, MESSAGING_V2_PUBLISH } from "../constants.js";
import { ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

export function registerMessagingTools(server: McpServer): void {
  // ── Publish Message to Topic ─────────────────────────────────────────
  const PublishMessageSchema = z.object({
    universe_id: universeIdSchema,
    topic: z
      .string()
      .min(1)
      .max(80)
      .describe("Topic name to publish to (max 80 chars). In-game scripts subscribe to this topic via MessagingService:SubscribeAsync()."),
    message: z
      .string()
      .min(1)
      .max(1024)
      .describe("Message payload (max 1024 chars / 1KB). Delivered to all servers subscribed to the topic."),
    use_legacy: z
      .boolean()
      .default(false)
      .describe("Force the legacy v1 endpoint instead of v2. Only needed for API keys with the old scope."),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_publish_message",
    {
      title: "Publish Message to Game Servers",
      description: `Publish a message to a topic on all running game servers in an experience.

Messages are delivered to game servers that have subscribed to the topic via
MessagingService:SubscribeAsync(). This enables external systems (AI agents,
dashboards, webhooks) to communicate with running game servers in real-time.

Common use cases:
- Send admin commands to all servers ("shutdown", "announce:maintenance in 5 min")
- Trigger in-game events ("start_event:holiday_2026")
- Push config updates ("update_config:difficulty=hard")
- Broadcast notifications to players

The in-game handler receives this via:
  MessagingService:SubscribeAsync("topicName", function(message)
    print(message.Data) -- your message string
  end)

By default, uses Messaging v2 (GA Dec 2025). Pass use_legacy=true for the v1
endpoint if your API key only has the old scope.

Requires API key scope: universe-messaging-service:publish
(or universe-messaging-service.v1:publish when use_legacy=true)`,
      inputSchema: PublishMessageSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_publish_message", async (params: z.infer<typeof PublishMessageSchema>) => {
      try {
        if (params.use_legacy) {
          const url = `${MESSAGING_V1_BASE(params.universe_id)}/topics/${encodeURIComponent(params.topic)}`;
          await makeApiRequest<void>(url, "POST", { message: params.message });
        } else {
          const url = MESSAGING_V2_PUBLISH(params.universe_id);
          await makeApiRequest<void>(url, "POST", { topic: params.topic, message: params.message });
        }

        const apiVersion = params.use_legacy ? "v1" : "v2";

        if (params.response_format === ResponseFormat.JSON) {
          const output = {
            success: true,
            api_version: apiVersion,
            universe_id: params.universe_id,
            topic: params.topic,
            message_length: params.message.length,
          };
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }], structuredContent: output };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Message published to topic **"${params.topic}"** in universe ${params.universe_id} (${apiVersion}).\n\n` +
              `All servers subscribed to this topic will receive the message. (${params.message.length} chars)`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

/**
 * Messaging Service Tools
 *
 * Publish messages to running Roblox experience servers from external sources.
 * Enables agent-to-game-server communication for live operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { MESSAGING_V1_BASE } from "../constants.js";
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
      .describe("Topic name to publish to (max 80 chars). Subscribers in-game listen on this topic via MessagingService."),
    message: z
      .string()
      .min(1)
      .max(1024)
      .describe("Message payload (max 1024 chars). This will be received by all servers subscribed to the topic."),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_publish_message",
    {
      title: "Publish Message to Game Servers",
      description: `Publish a message to a topic on all running game servers in an experience.

Messages are delivered to game servers that have subscribed to the topic via MessagingService:SubscribeAsync().
This enables external systems (like AI agents) to communicate with running game servers in real-time.

Common use cases:
- Send admin commands to all servers ("shutdown", "announce:maintenance in 5 min")
- Trigger in-game events ("start_event:holiday_2026")
- Push config updates ("update_config:difficulty=hard")
- Broadcast notifications to players

Args:
  - universe_id: Experience universe ID
  - topic: Topic name (must match what game scripts subscribe to)
  - message: Payload string (max 1024 chars)

The in-game handler receives this via:
  MessagingService:SubscribeAsync("topicName", function(message)
    print(message.Data) -- your message string
  end)

Requires API key scope: universe.messaging-service:publish`,
      inputSchema: PublishMessageSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_publish_message", async (params: z.infer<typeof PublishMessageSchema>) => {
      try {
        const url = `${MESSAGING_V1_BASE(params.universe_id)}/topics/${encodeURIComponent(params.topic)}`;
        await makeApiRequest<void>(url, "POST", { message: params.message });

        if (params.response_format === ResponseFormat.JSON) {
          const output = { success: true, universe_id: params.universe_id, topic: params.topic, message_length: params.message.length };
          return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }], structuredContent: output };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Message published to topic **"${params.topic}"** in universe ${params.universe_id}.\n\n` +
              `All servers subscribed to this topic will receive the message. (${params.message.length} chars)`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

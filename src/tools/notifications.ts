/**
 * Notifications Tools
 *
 * Send experience notifications to users via pre-configured message
 * templates. Templates are created in Creator Hub under Experience
 * Notifications and reference a `messageId`; parameters fill in
 * placeholders at send time.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/users/{userId}/notifications
 * API key scope: user.user-notification:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { USER_NOTIFICATIONS_BASE } from "../constants.js";
import { UserNotification, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

export function registerNotificationTools(server: McpServer): void {
  // ── Send User Notification ────────────────────────────────────────────
  const SendNotificationSchema = z.object({
    user_id: z
      .string()
      .regex(/^\d+$/)
      .describe("Recipient user ID"),
    universe_id: z
      .string()
      .regex(/^\d+$/)
      .describe("Source universe ID — the experience sending the notification"),
    message_id: z
      .string()
      .describe("Notification template ID (configured in Creator Hub → Experience Notifications)"),
    parameters: z
      .record(z.string())
      .optional()
      .describe("Key-value map of template parameter names to string values (e.g. {itemName: 'Sword'})"),
    type: z
      .enum(["MOMENT"])
      .default("MOMENT")
      .describe("Notification type. Currently only MOMENT is supported."),
    launch_data: z
      .string()
      .optional()
      .describe("Optional launch data passed via join-experience deep link"),
    analytics_category: z
      .string()
      .optional()
      .describe("Optional analytics category for reporting"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_send_user_notification",
    {
      title: "Send Experience Notification",
      description: `Send a notification to a specific user from an experience.

Uses a pre-configured notification template (messageId) defined in
Creator Hub. Template parameters are filled in via the parameters map.

Requires API key scope: user.user-notification:write`,
      inputSchema: SendNotificationSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_send_user_notification", async (params: z.infer<typeof SendNotificationSchema>) => {
      try {
        const url = USER_NOTIFICATIONS_BASE(params.user_id);

        const payload: Record<string, unknown> = {
          type: params.type,
          messageId: params.message_id,
        };
        if (params.parameters && Object.keys(params.parameters).length > 0) {
          payload.parameters = Object.fromEntries(
            Object.entries(params.parameters).map(([k, v]) => [k, { stringValue: v }])
          );
        }
        if (params.launch_data !== undefined) {
          payload.joinExperience = { launchData: params.launch_data };
        }
        if (params.analytics_category !== undefined) {
          payload.analyticsData = { category: params.analytics_category };
        }

        const body = {
          source: { universe: `universes/${params.universe_id}` },
          payload,
        };

        const result = await makeApiRequest<UserNotification>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Notification sent to user ${params.user_id} from universe ${params.universe_id} (template: ${params.message_id}).`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

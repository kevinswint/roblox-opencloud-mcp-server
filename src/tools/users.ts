/**
 * Users Tools
 *
 * Read user profiles, generate avatar thumbnails, and list user inventories.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/users
 * API key scopes: user.inventory-item:read, user.advanced:read, user.social:read
 *                 (some endpoints are public, no scope required)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { responseFormatSchema, pageSizeSchema, pageTokenSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { USERS_V2_BASE } from "../constants.js";
import {
  User,
  InventoryItem,
  InventoryItemListResponse,
  ResponseFormat,
} from "../types.js";
import { wrapTool } from "../services/logger.js";

const userIdSchema = z
  .string()
  .regex(/^\d+$/, "User ID must be numeric")
  .describe("The Roblox user ID");

export function registerUserTools(server: McpServer): void {
  // ── Get User ──────────────────────────────────────────────────────────
  const GetUserSchema = z.object({
    user_id: userIdSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_user",
    {
      title: "Get User Profile",
      description: `Fetch a user's profile: username, display name, bio, creation date,
premium status, and social links.

Public endpoint — no scope required for basic info. Optional scopes
\`user.advanced:read\` and \`user.social:read\` unlock additional fields.`,
      inputSchema: GetUserSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_user", async (params: z.infer<typeof GetUserSchema>) => {
      try {
        const url = `${USERS_V2_BASE}/${params.user_id}`;
        const user = await makeApiRequest<User>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(user, null, 2) }], structuredContent: user };
        }

        const lines = [
          `# ${user.displayName || user.name || `User ${params.user_id}`}`,
          "",
          user.name && user.name !== user.displayName ? `**Username:** @${user.name}` : "",
          user.about ? `\n${user.about}\n` : "",
          user.createTime ? `**Joined:** ${formatTimestamp(user.createTime)}` : "",
          user.locale ? `**Locale:** ${user.locale}` : "",
          user.premium ? "**Premium:** ✅" : "",
        ].filter((l) => l !== "");
        if (user.socialNetworkProfiles && Object.keys(user.socialNetworkProfiles).length > 0) {
          lines.push("", "**Social:**");
          Object.entries(user.socialNetworkProfiles).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Generate User Thumbnail ───────────────────────────────────────────
  const GenerateThumbnailSchema = z.object({
    user_id: userIdSchema,
    size: z
      .enum(["48", "50", "60", "75", "100", "110", "150", "180", "352", "420", "720"])
      .default("420")
      .describe("Thumbnail size in pixels (square). API accepts specific values only."),
    format: z.enum(["PNG", "JPEG"]).default("PNG").describe("Output format"),
    shape: z.enum(["ROUND", "SQUARE"]).default("ROUND").describe("Thumbnail shape"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_generate_user_thumbnail",
    {
      title: "Generate User Avatar Thumbnail",
      description: `Kick off avatar thumbnail generation for a user. Returns an operation
that can be polled with get_user_thumbnail_operation.

Public endpoint — no scope required.`,
      inputSchema: GenerateThumbnailSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_generate_user_thumbnail", async (params: z.infer<typeof GenerateThumbnailSchema>) => {
      try {
        const url = `${USERS_V2_BASE}/${params.user_id}:generateThumbnail`;
        const queryParams: Record<string, unknown> = {
          size: params.size,
          format: params.format,
          shape: params.shape,
        };
        const op = await makeApiRequest<Record<string, unknown>>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(op, null, 2) }], structuredContent: op };
        }

        const path = typeof op.path === "string" ? op.path : "";
        const opId = path.split("/").pop() || "(unknown)";
        return {
          content: [{
            type: "text" as const,
            text: `⏳ Thumbnail generation started. Operation: \`${opId}\`\n\n_Poll with roblox_get_user_thumbnail_operation to retrieve the image URL._`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get User Thumbnail Operation ──────────────────────────────────────
  const GetThumbnailOperationSchema = z.object({
    user_id: userIdSchema,
    operation_id: z.string().min(1).describe("Operation ID returned from generate_user_thumbnail"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_user_thumbnail_operation",
    {
      title: "Poll User Thumbnail Operation",
      description: `Check the status of a user thumbnail generation operation.

When done, the response contains the asset URL for the generated thumbnail.`,
      inputSchema: GetThumbnailOperationSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_user_thumbnail_operation", async (params: z.infer<typeof GetThumbnailOperationSchema>) => {
      try {
        const url = `${USERS_V2_BASE}/${params.user_id}/operations/${encodeURIComponent(params.operation_id)}`;
        const op = await makeApiRequest<Record<string, unknown>>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(op, null, 2) }], structuredContent: op };
        }

        const done = op.done === true;
        const error = op.error as { message?: string } | undefined;
        if (error) {
          return { content: [{ type: "text" as const, text: `❌ Thumbnail generation failed: ${error.message}` }] };
        }
        if (!done) {
          return { content: [{ type: "text" as const, text: `⏳ Operation ${params.operation_id} still in progress.` }] };
        }
        const response = op.response as { imageUri?: string } | undefined;
        return {
          content: [{
            type: "text" as const,
            text: `✅ Thumbnail ready: ${response?.imageUri || "(no URI in response)"}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Inventory Items ──────────────────────────────────────────────
  const ListInventorySchema = z.object({
    user_id: userIdSchema,
    filter: z
      .string()
      .optional()
      .describe("Optional filter (e.g. 'assetTypes=HAT', 'gamePassIds=12345')"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_user_inventory",
    {
      title: "List User Inventory",
      description: `List items in a user's inventory (assets, badges, game passes, private servers).

Use filter to narrow results, e.g. \`assetTypes=HAT\`, \`gamePassIds=12345\`,
\`badgeIds=67890\`, \`privateServerIds=11111\`.

Rate limit: 100 req/min (API key).

Requires API key scope: user.inventory-item:read`,
      inputSchema: ListInventorySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_user_inventory", async (params: z.infer<typeof ListInventorySchema>) => {
      try {
        const url = `${USERS_V2_BASE}/${params.user_id}/inventory-items`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;
        if (params.filter) queryParams.filter = params.filter;

        const data = await makeApiRequest<InventoryItemListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const items = data.inventoryItems || [];
        const lines = [`# Inventory for user ${params.user_id}`, ""];
        if (items.length === 0) {
          lines.push("No items found.");
        } else {
          items.forEach((item: InventoryItem, i) => {
            const kind = item.assetDetails
              ? "asset"
              : item.badgeDetails
              ? "badge"
              : item.gamePassDetails
              ? "game-pass"
              : item.privateServerDetails
              ? "private-server"
              : "item";
            const added = item.addTime ? ` — added ${formatTimestamp(item.addTime)}` : "";
            lines.push(`${i + 1}. [${kind}] **${item.path.split("/").pop()}**${added}`);
          });
          if (data.nextPageToken) {
            lines.push("", `_More results. Use page_token: \`${data.nextPageToken}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

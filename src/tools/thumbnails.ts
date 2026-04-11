/**
 * Thumbnails Tools
 *
 * Fetch thumbnails (image URLs) for users, assets, games, groups, badges,
 * and monetization products. These are public endpoints on the separate
 * thumbnails.roblox.com host — no API key or scope required.
 *
 * Base URL: https://thumbnails.roblox.com/v1
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { THUMBNAILS_BASE } from "../constants.js";
import { ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

interface ThumbnailEntry {
  [key: string]: unknown;
  targetId?: number;
  state?: string;
  imageUrl?: string;
  version?: string;
}

interface ThumbnailResponse {
  [key: string]: unknown;
  data?: ThumbnailEntry[];
}

function formatThumbnailList(data: ThumbnailResponse, heading: string): string {
  const lines = [`# ${heading}`, ""];
  const items = data.data || [];
  if (items.length === 0) {
    lines.push("_No thumbnails returned._");
    return lines.join("\n");
  }
  items.forEach((t) => {
    const state = t.state === "Completed" ? "✅" : `⚠️ ${t.state}`;
    lines.push(`- ${state} **${t.targetId}** — ${t.imageUrl || "(no URL)"}`);
  });
  return lines.join("\n");
}

export function registerThumbnailTools(server: McpServer): void {
  // ── User Avatar Headshots ─────────────────────────────────────────────
  const UserHeadshotSchema = z.object({
    user_ids: z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(100)
      .describe("One or more user IDs (max 100)"),
    size: z
      .enum(["48x48", "50x50", "60x60", "75x75", "100x100", "110x110", "150x150", "180x180", "352x352", "420x420", "720x720"])
      .default("150x150")
      .describe("Thumbnail size"),
    format: z.enum(["Png", "Jpeg", "Webp"]).default("Png"),
    is_circular: z.boolean().default(false).describe("Return a round-cropped image"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_user_headshots",
    {
      title: "Get User Avatar Headshots",
      description: `Fetch avatar headshot thumbnail URLs for one or more users.

Public endpoint — no scope required.`,
      inputSchema: UserHeadshotSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_user_headshots", async (params: z.infer<typeof UserHeadshotSchema>) => {
      try {
        const url = `${THUMBNAILS_BASE}/v1/users/avatar-headshot`;
        const queryParams: Record<string, unknown> = {
          userIds: params.user_ids.join(","),
          size: params.size,
          format: params.format,
          isCircular: params.is_circular,
        };
        const data = await makeApiRequest<ThumbnailResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        return { content: [{ type: "text" as const, text: formatThumbnailList(data, "User headshots") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Game Icons ────────────────────────────────────────────────────────
  const GameIconsSchema = z.object({
    universe_ids: z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(100)
      .describe("One or more universe IDs (max 100)"),
    size: z.enum(["50x50", "128x128", "150x150", "256x256", "420x420", "512x512"]).default("256x256"),
    format: z.enum(["Png", "Jpeg", "Webp"]).default("Png"),
    is_circular: z.boolean().default(false),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_game_icons",
    {
      title: "Get Game Icons",
      description: `Fetch icon thumbnail URLs for one or more experiences (universes).

Public endpoint — no scope required.`,
      inputSchema: GameIconsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_game_icons", async (params: z.infer<typeof GameIconsSchema>) => {
      try {
        const url = `${THUMBNAILS_BASE}/v1/games/icons`;
        const queryParams: Record<string, unknown> = {
          universeIds: params.universe_ids.join(","),
          size: params.size,
          format: params.format,
          isCircular: params.is_circular,
        };
        const data = await makeApiRequest<ThumbnailResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        return { content: [{ type: "text" as const, text: formatThumbnailList(data, "Game icons") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Asset Thumbnails ──────────────────────────────────────────────────
  const AssetThumbnailSchema = z.object({
    asset_ids: z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(100)
      .describe("One or more asset IDs (max 100)"),
    size: z.enum(["30x30", "42x42", "50x50", "60x62", "75x75", "110x110", "140x140", "150x150", "160x100", "250x250", "256x144", "420x420", "480x270", "768x432"]).default("420x420"),
    format: z.enum(["Png", "Jpeg", "Webp"]).default("Png"),
    is_circular: z.boolean().default(false),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_asset_thumbnails",
    {
      title: "Get Asset Thumbnails",
      description: `Fetch thumbnail URLs for assets (decals, models, clothing, etc.).

Public endpoint — no scope required.`,
      inputSchema: AssetThumbnailSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_asset_thumbnails", async (params: z.infer<typeof AssetThumbnailSchema>) => {
      try {
        const url = `${THUMBNAILS_BASE}/v1/assets`;
        const queryParams: Record<string, unknown> = {
          assetIds: params.asset_ids.join(","),
          size: params.size,
          format: params.format,
          isCircular: params.is_circular,
        };
        const data = await makeApiRequest<ThumbnailResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        return { content: [{ type: "text" as const, text: formatThumbnailList(data, "Asset thumbnails") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Group Icons ───────────────────────────────────────────────────────
  const GroupIconsSchema = z.object({
    group_ids: z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(100)
      .describe("One or more group IDs (max 100)"),
    size: z.enum(["150x150", "420x420"]).default("150x150"),
    format: z.enum(["Png", "Jpeg"]).default("Png"),
    is_circular: z.boolean().default(false),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_group_icons",
    {
      title: "Get Group Icons",
      description: `Fetch icon thumbnail URLs for one or more groups.

Public endpoint — no scope required.`,
      inputSchema: GroupIconsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_group_icons", async (params: z.infer<typeof GroupIconsSchema>) => {
      try {
        const url = `${THUMBNAILS_BASE}/v1/groups/icons`;
        const queryParams: Record<string, unknown> = {
          groupIds: params.group_ids.join(","),
          size: params.size,
          format: params.format,
          isCircular: params.is_circular,
        };
        const data = await makeApiRequest<ThumbnailResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        return { content: [{ type: "text" as const, text: formatThumbnailList(data, "Group icons") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Batch Thumbnail Request ───────────────────────────────────────────
  const BatchSchema = z.object({
    requests: z
      .array(
        z.object({
          type: z.string().describe("Thumbnail type (e.g. 'AvatarHeadShot', 'GameIcon', 'Asset')"),
          target_id: z.number().int().describe("Numeric ID for the item"),
          size: z.string().describe("Size string, e.g. '150x150'"),
          format: z.enum(["Png", "Jpeg", "Webp"]).default("Png"),
          is_circular: z.boolean().default(false),
        })
      )
      .min(1)
      .max(100)
      .describe("Batch of mixed-type thumbnail requests (max 100 per call)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_batch_get_thumbnails",
    {
      title: "Batch Get Thumbnails (Mixed Types)",
      description: `Fetch many thumbnails of mixed types in a single request — useful for
dashboards or leaderboards needing avatars, game icons, and asset previews.

Public endpoint — no scope required.`,
      inputSchema: BatchSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_batch_get_thumbnails", async (params: z.infer<typeof BatchSchema>) => {
      try {
        const url = `${THUMBNAILS_BASE}/v1/batch`;
        const body = params.requests.map((r, i) => ({
          requestId: `req-${i}`,
          type: r.type,
          targetId: r.target_id,
          size: r.size,
          format: r.format,
          isCircular: r.is_circular,
        }));
        const data = await makeApiRequest<ThumbnailResponse>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        return { content: [{ type: "text" as const, text: formatThumbnailList(data, "Batch thumbnails") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

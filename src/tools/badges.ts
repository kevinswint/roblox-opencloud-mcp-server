/**
 * Badges Tools
 *
 * List and manage badges for a universe. The Cloud v2 badges surface is
 * limited — most endpoints live under the legacy badges API or the public
 * thumbnails/metadata hosts. This module wraps the useful read endpoints
 * plus the legacy create/update write endpoints.
 *
 * Base URLs:
 *   https://badges.roblox.com/v1                    (public read)
 *   https://apis.roblox.com/legacy-badges/v1        (write)
 * API key scopes: legacy-universe.badge:manage-and-spend-robux (create),
 *                 legacy-universe.badge:write (update)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { LEGACY_BADGES_BASE } from "../constants.js";
import { Badge, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

const BADGES_PUBLIC_V1 = "https://badges.roblox.com/v1";

function formatBadge(b: Badge): string {
  const lines = [
    `**${b.displayName || b.name || `Badge ${b.id}`}**`,
    b.description || "",
    `- ID: ${b.id}`,
    `- Enabled: ${b.enabled ? "✅" : "❌"}`,
  ];
  if (b.statistics) {
    const s = b.statistics;
    lines.push(`- Awards: ${s.awardedCount ?? 0} (past 24h: ${s.pastDayAwardedCount ?? 0})`);
    if (s.winRatePercentage !== undefined) lines.push(`- Win rate: ${s.winRatePercentage}%`);
  }
  if (b.created) lines.push(`- Created: ${formatTimestamp(b.created)}`);
  return lines.filter((l) => l !== "").join("\n");
}

export function registerBadgeTools(server: McpServer): void {
  // ── Get Badge ─────────────────────────────────────────────────────────
  const GetBadgeSchema = z.object({
    badge_id: z.string().regex(/^\d+$/).describe("Badge ID"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_badge",
    {
      title: "Get Badge",
      description: `Fetch badge metadata: name, description, enabled state, and stats.

Public endpoint — no scope required.`,
      inputSchema: GetBadgeSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_badge", async (params: z.infer<typeof GetBadgeSchema>) => {
      try {
        const url = `${BADGES_PUBLIC_V1}/badges/${params.badge_id}`;
        const badge = await makeApiRequest<Badge>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(badge, null, 2) }], structuredContent: badge };
        }

        return { content: [{ type: "text" as const, text: formatBadge(badge) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Universe Badges ──────────────────────────────────────────────
  const ListUniverseBadgesSchema = z.object({
    universe_id: universeIdSchema,
    limit: z.number().int().min(1).max(100).default(25).describe("Page size (1-100)"),
    cursor: z.string().optional().describe("Pagination cursor"),
    sort_order: z.enum(["Asc", "Desc"]).default("Asc").describe("Sort order by creation date"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_universe_badges",
    {
      title: "List Universe Badges",
      description: `List all badges for a universe.

Public endpoint — no scope required.`,
      inputSchema: ListUniverseBadgesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_universe_badges", async (params: z.infer<typeof ListUniverseBadgesSchema>) => {
      try {
        const url = `${BADGES_PUBLIC_V1}/universes/${params.universe_id}/badges`;
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          sortOrder: params.sort_order,
        };
        if (params.cursor) queryParams.cursor = params.cursor;

        const data = await makeApiRequest<{ data?: Badge[]; nextPageCursor?: string }>(
          url,
          "GET",
          undefined,
          queryParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const badges = data.data || [];
        const lines = [`# Badges for universe ${params.universe_id}`, ""];
        if (badges.length === 0) {
          lines.push("No badges found.");
        } else {
          badges.forEach((b) => lines.push(`- **${b.displayName || b.name}** (id: ${b.id}) — ${b.enabled ? "enabled" : "disabled"}`));
          if (data.nextPageCursor) {
            lines.push("", `_More results. Use cursor: \`${data.nextPageCursor}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List User Badges ──────────────────────────────────────────────────
  const ListUserBadgesSchema = z.object({
    user_id: z.string().regex(/^\d+$/).describe("User ID"),
    limit: z.number().int().min(1).max(100).default(25).describe("Page size (1-100)"),
    cursor: z.string().optional().describe("Pagination cursor"),
    sort_order: z.enum(["Asc", "Desc"]).default("Desc").describe("Sort order"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_user_badges",
    {
      title: "List User's Badges",
      description: `List badges owned by a user.

Public endpoint — no scope required.`,
      inputSchema: ListUserBadgesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_user_badges", async (params: z.infer<typeof ListUserBadgesSchema>) => {
      try {
        const url = `${BADGES_PUBLIC_V1}/users/${params.user_id}/badges`;
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          sortOrder: params.sort_order,
        };
        if (params.cursor) queryParams.cursor = params.cursor;

        const data = await makeApiRequest<{ data?: Badge[]; nextPageCursor?: string }>(
          url,
          "GET",
          undefined,
          queryParams
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const badges = data.data || [];
        const lines = [`# Badges owned by user ${params.user_id}`, ""];
        if (badges.length === 0) {
          lines.push("No badges found.");
        } else {
          badges.forEach((b) => lines.push(`- **${b.displayName || b.name}** (id: ${b.id})`));
          if (data.nextPageCursor) {
            lines.push("", `_More results. Use cursor: \`${data.nextPageCursor}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Badge Award Date for User ────────────────────────────────────
  const BadgeAwardSchema = z.object({
    user_id: z.string().regex(/^\d+$/).describe("User ID"),
    badge_id: z.string().regex(/^\d+$/).describe("Badge ID"),
  }).strict();

  server.registerTool(
    "roblox_get_badge_awarded_date",
    {
      title: "Get Badge Awarded Date",
      description: `Get the timestamp when a user earned a specific badge, or confirm they don't have it.

Public endpoint — no scope required.`,
      inputSchema: BadgeAwardSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_badge_awarded_date", async (params: z.infer<typeof BadgeAwardSchema>) => {
      try {
        const url = `${BADGES_PUBLIC_V1}/users/${params.user_id}/badges/${params.badge_id}/awarded-date`;
        const data = await makeApiRequest<{ awardedDate?: string | null }>(url, "GET");

        if (!data.awardedDate) {
          return { content: [{ type: "text" as const, text: `User ${params.user_id} has not earned badge ${params.badge_id}.` }] };
        }
        return {
          content: [{
            type: "text" as const,
            text: `✅ User ${params.user_id} earned badge ${params.badge_id} on ${formatTimestamp(data.awardedDate)}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Universe Free Badge Quota ─────────────────────────────────────
  const QuotaSchema = z.object({
    universe_id: universeIdSchema,
  }).strict();

  server.registerTool(
    "roblox_get_universe_badge_quota",
    {
      title: "Get Universe Free Badge Quota",
      description: `Check how many free badges the universe can still create this period.

Public endpoint — no scope required.`,
      inputSchema: QuotaSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_universe_badge_quota", async (params: z.infer<typeof QuotaSchema>) => {
      try {
        const url = `${BADGES_PUBLIC_V1}/universes/${params.universe_id}/free-badges-quota`;
        const data = await makeApiRequest<Record<string, unknown>>(url, "GET");

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Badge Metadata ─────────────────────────────────────────────
  const UpdateBadgeSchema = z.object({
    badge_id: z.string().regex(/^\d+$/).describe("Badge ID to update"),
    name: z.string().optional().describe("New badge name"),
    description: z.string().optional().describe("New description"),
    enabled: z.boolean().optional().describe("Enable or disable the badge"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_badge",
    {
      title: "Update Badge",
      description: `Update badge metadata (name, description, enabled state).

Requires API key scope: legacy-universe.badge:write`,
      inputSchema: UpdateBadgeSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_badge", async (params: z.infer<typeof UpdateBadgeSchema>) => {
      try {
        const url = `${LEGACY_BADGES_BASE}/badges/${params.badge_id}`;
        const body: Record<string, unknown> = {};
        if (params.name !== undefined) body.name = params.name;
        if (params.description !== undefined) body.description = params.description;
        if (params.enabled !== undefined) body.enabled = params.enabled;

        if (Object.keys(body).length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update." }] };
        }

        const result = await makeApiRequest<Badge>(url, "PATCH", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated badge ${params.badge_id}. Fields: ${Object.keys(body).join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

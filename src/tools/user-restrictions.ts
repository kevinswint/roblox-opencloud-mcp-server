/**
 * User Restrictions (Bans) Tools
 *
 * Manage game-join bans at the universe and place level.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/universes/{id}/user-restrictions
 * API key scopes: universe.user-restriction:read, universe.user-restriction:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  universeIdSchema,
  placeIdSchema,
  responseFormatSchema,
  pageSizeSchema,
  pageTokenSchema,
} from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { UNIVERSE_RESTRICTIONS_BASE, PLACE_RESTRICTIONS_BASE } from "../constants.js";
import { UserRestriction, UserRestrictionListResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

function formatRestrictionLine(r: UserRestriction): string {
  const restriction = r.gameJoinRestriction;
  if (!restriction) return `- **${r.path}**`;
  const status = restriction.active ? "🔴 ACTIVE" : "⚪ INACTIVE";
  const duration = restriction.duration ? ` (${restriction.duration})` : "";
  const reason = restriction.displayReason ? ` — "${restriction.displayReason}"` : "";
  return `- **${r.user || r.path}** ${status}${duration}${reason}`;
}

export function registerUserRestrictionsTools(server: McpServer): void {
  // ── List Universe Restrictions ────────────────────────────────────────
  const ListUniverseSchema = z.object({
    universe_id: universeIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_user_restrictions",
    {
      title: "List Banned Users",
      description: `List all user restrictions (bans) active at the universe level.

Returns each restriction's user, status, duration, and reason.

Requires API key scope: universe.user-restriction:read`,
      inputSchema: ListUniverseSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_user_restrictions", async (params: z.infer<typeof ListUniverseSchema>) => {
      try {
        const url = UNIVERSE_RESTRICTIONS_BASE(params.universe_id);
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<UserRestrictionListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const lines = [`# User Restrictions — Universe ${params.universe_id}`, ""];
        const restrictions = data.userRestrictions || [];
        if (restrictions.length === 0) {
          lines.push("No user restrictions.");
        } else {
          restrictions.forEach((r) => lines.push(formatRestrictionLine(r)));
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

  // ── Get User Restriction ──────────────────────────────────────────────
  const GetSchema = z.object({
    universe_id: universeIdSchema,
    user_id: z.string().regex(/^\d+$/).describe("The user ID to look up"),
    place_id: placeIdSchema.optional(),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_user_restriction",
    {
      title: "Get User Restriction (Ban Status)",
      description: `Check whether a user is currently banned from a universe or specific place.

If place_id is provided, returns the place-level restriction; otherwise the universe-level
restriction is returned.

Requires API key scope: universe.user-restriction:read`,
      inputSchema: GetSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_user_restriction", async (params: z.infer<typeof GetSchema>) => {
      try {
        const base = params.place_id
          ? PLACE_RESTRICTIONS_BASE(params.universe_id, params.place_id)
          : UNIVERSE_RESTRICTIONS_BASE(params.universe_id);
        const url = `${base}/${params.user_id}`;

        const restriction = await makeApiRequest<UserRestriction>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(restriction, null, 2) }], structuredContent: restriction };
        }

        const r = restriction.gameJoinRestriction;
        const lines = [
          `# Ban Status: User ${params.user_id}`,
          "",
          `**Scope:** ${params.place_id ? `Place ${params.place_id}` : `Universe ${params.universe_id}`}`,
          `**Active:** ${r?.active ? "🔴 Yes" : "⚪ No"}`,
        ];
        if (r?.startTime) lines.push(`**Started:** ${formatTimestamp(r.startTime)}`);
        if (r?.duration) lines.push(`**Duration:** ${r.duration}`);
        if (r?.displayReason) lines.push(`**Display reason:** ${r.displayReason}`);
        if (r?.privateReason) lines.push(`**Private reason:** ${r.privateReason}`);
        if (r?.excludeAltAccounts !== undefined) lines.push(`**Exclude alts:** ${r.excludeAltAccounts}`);
        if (r?.inherited !== undefined) lines.push(`**Inherited:** ${r.inherited}`);
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update User Restriction (ban/unban/modify) ────────────────────────
  const UpdateSchema = z.object({
    universe_id: universeIdSchema,
    user_id: z.string().regex(/^\d+$/).describe("The user ID to restrict"),
    place_id: placeIdSchema.optional(),
    active: z.boolean().describe("Set to true to ban, false to unban"),
    duration: z
      .string()
      .optional()
      .describe("Optional duration (e.g. '3600s' for 1 hour). Omit for permanent."),
    private_reason: z
      .string()
      .optional()
      .describe("Reason shown in moderator dashboards (not to user)"),
    display_reason: z
      .string()
      .optional()
      .describe("Reason shown to user on join attempt"),
    exclude_alt_accounts: z.boolean().optional().describe("Whether to also ban detected alt accounts"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_user_restriction",
    {
      title: "Ban / Unban / Update User Restriction",
      description: `Create, update, or lift a user restriction (ban).

Set active=true with a duration to ban. Set active=false to unban. Omit duration
for a permanent ban. If place_id is provided, restriction applies to that place
only; otherwise applies to the entire universe.

⚠️ This takes immediate effect — the user will be disconnected on next join attempt.

Requires API key scope: universe.user-restriction:write`,
      inputSchema: UpdateSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_user_restriction", async (params: z.infer<typeof UpdateSchema>) => {
      try {
        const base = params.place_id
          ? PLACE_RESTRICTIONS_BASE(params.universe_id, params.place_id)
          : UNIVERSE_RESTRICTIONS_BASE(params.universe_id);
        const url = `${base}/${params.user_id}`;

        const gameJoinRestriction: Record<string, unknown> = { active: params.active };
        if (params.duration !== undefined) gameJoinRestriction.duration = params.duration;
        if (params.private_reason !== undefined) gameJoinRestriction.privateReason = params.private_reason;
        if (params.display_reason !== undefined) gameJoinRestriction.displayReason = params.display_reason;
        if (params.exclude_alt_accounts !== undefined) gameJoinRestriction.excludeAltAccounts = params.exclude_alt_accounts;

        const body = { gameJoinRestriction };
        const result = await makeApiRequest<UserRestriction>(
          url,
          "PATCH",
          body,
          { updateMask: "gameJoinRestriction" }
        );

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const verb = params.active ? "banned" : "unbanned";
        const scope = params.place_id ? `place ${params.place_id}` : `universe ${params.universe_id}`;
        return {
          content: [{
            type: "text" as const,
            text: `✅ User **${params.user_id}** ${verb} in ${scope}${params.duration ? ` for ${params.duration}` : ""}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Restriction Logs (audit trail) ───────────────────────────────
  const ListLogsSchema = z.object({
    universe_id: universeIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_user_restriction_logs",
    {
      title: "List Ban/Restriction Audit Log",
      description: `List the audit log for all restriction changes (bans, unbans, modifications)
in a universe.

Requires API key scope: universe.user-restriction:read`,
      inputSchema: ListLogsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_user_restriction_logs", async (params: z.infer<typeof ListLogsSchema>) => {
      try {
        const url = `${UNIVERSE_RESTRICTIONS_BASE(params.universe_id)}:listLogs`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<Record<string, unknown>>(url, "GET", undefined, queryParams);

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

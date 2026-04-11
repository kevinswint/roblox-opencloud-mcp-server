/**
 * Groups Tools
 *
 * Read group info, members, roles, and join requests. Approve or decline join
 * requests and reassign member roles.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/groups
 * API key scopes: group:read, group:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { responseFormatSchema, pageSizeSchema, pageTokenSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { GROUPS_V2_BASE } from "../constants.js";
import {
  Group,
  GroupMembership,
  GroupMembershipListResponse,
  GroupRole,
  GroupRoleListResponse,
  GroupJoinRequest,
  GroupJoinRequestListResponse,
  GroupShout,
  ResponseFormat,
} from "../types.js";
import { wrapTool } from "../services/logger.js";

const groupIdSchema = z
  .string()
  .regex(/^\d+$/, "Group ID must be numeric")
  .describe("The Roblox group ID");

export function registerGroupTools(server: McpServer): void {
  // ── Get Group ─────────────────────────────────────────────────────────
  const GetGroupSchema = z.object({
    group_id: groupIdSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_group",
    {
      title: "Get Group",
      description: `Fetch group metadata: name, description, owner, member count, and lock status.

Public endpoint — no scope required.`,
      inputSchema: GetGroupSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_group", async (params: z.infer<typeof GetGroupSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}`;
        const group = await makeApiRequest<Group>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(group, null, 2) }], structuredContent: group };
        }

        const lines = [
          `# ${group.displayName || `Group ${params.group_id}`}`,
          "",
          group.description ? `${group.description}\n` : "",
          `**Members:** ${group.memberCount ?? "?"}`,
          `**Owner:** ${group.owner || "(none)"}`,
          `**Verified:** ${group.verified ? "✅" : "❌"}`,
          `**Locked:** ${group.locked ? "🔒 Yes" : "No"}`,
          `**Public entry:** ${group.publicEntryAllowed ? "Allowed" : "Requires approval"}`,
        ].filter((l) => l !== "");
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Group Memberships ────────────────────────────────────────────
  const ListMembershipsSchema = z.object({
    group_id: groupIdSchema,
    filter: z
      .string()
      .optional()
      .describe("Optional filter (e.g. 'user == \"users/12345\"')"),
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_group_memberships",
    {
      title: "List Group Memberships",
      description: `List members of a group. Optionally filter by a specific user.

Public endpoint — no scope required for read.`,
      inputSchema: ListMembershipsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_group_memberships", async (params: z.infer<typeof ListMembershipsSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/memberships`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;
        if (params.filter) queryParams.filter = params.filter;

        const data = await makeApiRequest<GroupMembershipListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const members = data.groupMemberships || [];
        const lines = [`# Memberships for group ${params.group_id}`, ""];
        if (members.length === 0) {
          lines.push("No members found (or filter returned no results).");
        } else {
          members.forEach((m, i) => {
            const role = m.role ? ` — ${m.role.split("/").pop()}` : "";
            const joined = m.createTime ? ` · joined ${formatTimestamp(m.createTime)}` : "";
            lines.push(`${i + 1}. **${m.user || m.path}**${role}${joined}`);
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

  // ── List Group Roles ──────────────────────────────────────────────────
  const ListRolesSchema = z.object({
    group_id: groupIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_group_roles",
    {
      title: "List Group Roles",
      description: `List all roles in a group, ordered by rank.

Requires API key scope: group:read`,
      inputSchema: ListRolesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_group_roles", async (params: z.infer<typeof ListRolesSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/roles`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<GroupRoleListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const roles = data.groupRoles || [];
        const lines = [`# Roles in group ${params.group_id}`, ""];
        if (roles.length === 0) {
          lines.push("No roles found.");
        } else {
          roles.forEach((r) => {
            lines.push(`- **${r.displayName}** (rank ${r.rank ?? "?"}, ${r.memberCount ?? 0} members)`);
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

  // ── Get Group Role ────────────────────────────────────────────────────
  const GetRoleSchema = z.object({
    group_id: groupIdSchema,
    role_id: z.string().min(1).describe("The role ID to fetch"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_group_role",
    {
      title: "Get Group Role",
      description: `Fetch details about a single group role — name, rank, permissions, member count.

Requires API key scope: group:read`,
      inputSchema: GetRoleSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_group_role", async (params: z.infer<typeof GetRoleSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/roles/${encodeURIComponent(params.role_id)}`;
        const role = await makeApiRequest<GroupRole>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(role, null, 2) }], structuredContent: role };
        }

        const lines = [
          `# ${role.displayName}`,
          "",
          role.description ? `${role.description}\n` : "",
          `**Rank:** ${role.rank ?? "?"}`,
          `**Members:** ${role.memberCount ?? 0}`,
        ].filter((l) => l !== "");
        if (role.permissions) {
          lines.push("", "**Permissions:**");
          Object.entries(role.permissions).forEach(([k, v]) => lines.push(`- ${k}: ${v ? "✅" : "❌"}`));
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Join Requests ────────────────────────────────────────────────
  const ListJoinRequestsSchema = z.object({
    group_id: groupIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_group_join_requests",
    {
      title: "List Group Join Requests",
      description: `List pending join requests for a group.

Requires API key scope: group:read`,
      inputSchema: ListJoinRequestsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_group_join_requests", async (params: z.infer<typeof ListJoinRequestsSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/join-requests`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<GroupJoinRequestListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const requests = data.groupJoinRequests || [];
        const lines = [`# Pending join requests for group ${params.group_id}`, ""];
        if (requests.length === 0) {
          lines.push("No pending join requests.");
        } else {
          requests.forEach((r) => {
            lines.push(`- **${r.user || r.path}** — requested ${formatTimestamp(r.createTime)}`);
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

  // ── Accept Join Request ───────────────────────────────────────────────
  const AcceptSchema = z.object({
    group_id: groupIdSchema,
    join_request_id: z.string().min(1).describe("The join request ID to accept"),
  }).strict();

  server.registerTool(
    "roblox_accept_group_join_request",
    {
      title: "Accept Group Join Request",
      description: `Accept a pending group join request — adds the user as a member.

Requires API key scope: group:write`,
      inputSchema: AcceptSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_accept_group_join_request", async (params: z.infer<typeof AcceptSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/join-requests/${encodeURIComponent(params.join_request_id)}:accept`;
        await makeApiRequest<void>(url, "POST", {});

        return {
          content: [{
            type: "text" as const,
            text: `✅ Accepted join request ${params.join_request_id} in group ${params.group_id}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Decline Join Request ──────────────────────────────────────────────
  const DeclineSchema = z.object({
    group_id: groupIdSchema,
    join_request_id: z.string().min(1).describe("The join request ID to decline"),
  }).strict();

  server.registerTool(
    "roblox_decline_group_join_request",
    {
      title: "Decline Group Join Request",
      description: `Decline a pending group join request.

Requires API key scope: group:write`,
      inputSchema: DeclineSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_decline_group_join_request", async (params: z.infer<typeof DeclineSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/join-requests/${encodeURIComponent(params.join_request_id)}:decline`;
        await makeApiRequest<void>(url, "POST", {});

        return {
          content: [{
            type: "text" as const,
            text: `✅ Declined join request ${params.join_request_id} in group ${params.group_id}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Group Membership (Assign Role) ────────────────────────────
  const UpdateMembershipSchema = z.object({
    group_id: groupIdSchema,
    membership_id: z.string().min(1).describe("The membership ID (from list_group_memberships)"),
    role_id: z.string().min(1).describe("The role ID to assign"),
  }).strict();

  server.registerTool(
    "roblox_update_group_membership_role",
    {
      title: "Assign Group Member Role",
      description: `Change a group member's role.

Requires API key scope: group:write`,
      inputSchema: UpdateMembershipSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_group_membership_role", async (params: z.infer<typeof UpdateMembershipSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/memberships/${encodeURIComponent(params.membership_id)}`;
        const rolePath = `groups/${params.group_id}/roles/${params.role_id}`;
        const result = await makeApiRequest<GroupMembership>(
          url,
          "PATCH",
          { role: rolePath },
          { updateMask: "role" }
        );

        if (result.role) {
          return {
            content: [{
              type: "text" as const,
              text: `✅ Updated membership ${params.membership_id} → role ${params.role_id}.`,
            }],
          };
        }
        return { content: [{ type: "text" as const, text: `✅ Membership updated.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Group Shout ───────────────────────────────────────────────────
  const GetShoutSchema = z.object({
    group_id: groupIdSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_group_shout",
    {
      title: "Get Group Shout",
      description: `Fetch the current group shout (the pinned announcement from group leaders).

Requires API key scope: group:read`,
      inputSchema: GetShoutSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_group_shout", async (params: z.infer<typeof GetShoutSchema>) => {
      try {
        const url = `${GROUPS_V2_BASE}/${params.group_id}/shout`;
        const shout = await makeApiRequest<GroupShout>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(shout, null, 2) }], structuredContent: shout };
        }

        if (!shout.content) {
          return { content: [{ type: "text" as const, text: "_No active shout._" }] };
        }
        return {
          content: [{
            type: "text" as const,
            text: `# Group ${params.group_id} shout\n\n> ${shout.content}\n\n_Posted by ${shout.poster || "unknown"} on ${formatTimestamp(shout.updateTime || shout.createTime)}_`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

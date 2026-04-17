/**
 * Configs API Tools
 *
 * Manage creator-driven config repositories for Roblox experiences.
 * GA since March 10, 2026. Draft/publish workflow with revision history.
 *
 * Base URL: https://apis.roblox.com/creator-configs-public-api/v1
 * API key scopes: universe:read, universe:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema, pageSizeSchema, pageTokenSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { CONFIGS_REPOSITORY_BASE } from "../constants.js";
import { ConfigVersion, ConfigRevisionListResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

const repositorySchema = z
  .enum(["InExperienceConfig", "DataStoresConfig"])
  .describe(
    "Repository name. Roblox restricts this to a fixed set: 'InExperienceConfig' " +
      "(runtime feature flags / game config) or 'DataStoresConfig' (data store configuration)."
  );

export function registerConfigTools(server: McpServer): void {
  // ── Get Published Config ──────────────────────────────────────────────
  const GetConfigSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_config",
    {
      title: "Get Published Config",
      description: `Read the currently-published config document for a repository.

Use this to read the live config values that running game servers see.

Requires API key scope: universe:read`,
      inputSchema: GetConfigSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_config", async (params: z.infer<typeof GetConfigSchema>) => {
      try {
        const url = CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository);
        const config = await makeApiRequest<ConfigVersion>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(config, null, 2) }], structuredContent: config };
        }

        const lines = [
          `# Config: ${params.repository}`,
          "",
          `**Universe:** ${params.universe_id}`,
          `**Updated:** ${formatTimestamp(config.updateTime)}`,
          config.etag ? `**ETag:** ${config.etag}` : "",
          "",
          "## Data",
          "```json",
          JSON.stringify(config.data ?? {}, null, 2),
          "```",
        ].filter(Boolean);

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Draft Config ──────────────────────────────────────────────────
  const GetDraftSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_config_draft",
    {
      title: "Get Config Draft",
      description: `Read the unpublished draft for a config repository.

Drafts are edits staged before publishing. Use this to review pending changes.

Requires API key scope: universe:read`,
      inputSchema: GetDraftSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_config_draft", async (params: z.infer<typeof GetDraftSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/draft`;
        const draft = await makeApiRequest<ConfigVersion>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(draft, null, 2) }], structuredContent: draft };
        }

        const lines = [
          `# Config Draft: ${params.repository}`,
          "",
          `**Updated:** ${formatTimestamp(draft.updateTime)}`,
          "",
          "## Data",
          "```json",
          JSON.stringify(draft.data ?? {}, null, 2),
          "```",
        ];

        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Config Draft (merge) ───────────────────────────────────────
  const UpdateDraftSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    data: z.record(z.unknown()).describe("Partial config data to merge into the draft"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_config_draft",
    {
      title: "Update Config Draft (Merge)",
      description: `Merge partial data into the config repository's draft.

This does a PATCH-style merge — keys in the provided data overwrite existing draft
values, and unspecified keys remain unchanged. To replace the entire draft instead,
use roblox_replace_config_draft.

⚠️ This updates the draft, not the published config. Use roblox_publish_config to
make changes live.

Requires API key scope: universe:write`,
      inputSchema: UpdateDraftSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_update_config_draft", async (params: z.infer<typeof UpdateDraftSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/draft`;
        const result = await makeApiRequest<ConfigVersion>(url, "PATCH", { entries: params.data });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Draft updated for **${params.repository}**.\n\n_Updated: ${formatTimestamp(result.updateTime)}_\n\n` +
              `⚠️ Draft changes are NOT live until you call \`roblox_publish_config\`.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Replace Config Draft (overwrite) ──────────────────────────────────
  const ReplaceDraftSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    data: z.record(z.unknown()).describe("Full config data to replace the draft"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_replace_config_draft",
    {
      title: "Replace Config Draft (Overwrite)",
      description: `Overwrite the entire draft with new data. Existing draft keys NOT present
in the new data are DELETED from the draft.

⚠️ This is destructive — any draft keys not in the new payload are dropped. Use
roblox_update_config_draft for merge-style updates.

Requires API key scope: universe:write`,
      inputSchema: ReplaceDraftSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_replace_config_draft", async (params: z.infer<typeof ReplaceDraftSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/draft:overwrite`;
        const result = await makeApiRequest<ConfigVersion>(url, "PUT", { entries: params.data });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Draft replaced for **${params.repository}**.\n\n_Updated: ${formatTimestamp(result.updateTime)}_\n\n` +
              `⚠️ Draft changes are NOT live until you call \`roblox_publish_config\`.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Delete Config Draft ───────────────────────────────────────────────
  const DeleteDraftSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
  }).strict();

  server.registerTool(
    "roblox_delete_config_draft",
    {
      title: "Delete Config Draft",
      description: `Discard the draft, reverting it to the currently published state.

⚠️ All unpublished draft edits are lost. This does not affect the published config.

Requires API key scope: universe:write`,
      inputSchema: DeleteDraftSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_delete_config_draft", async (params: z.infer<typeof DeleteDraftSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/draft`;
        await makeApiRequest<void>(url, "DELETE");

        return {
          content: [{
            type: "text" as const,
            text: `✅ Draft cleared for **${params.repository}**. Repository now matches the published state.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Publish Config ────────────────────────────────────────────────────
  const PublishConfigSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_publish_config",
    {
      title: "Publish Config Draft",
      description: `Publish the current draft as the live config. This makes draft changes visible
to running game servers reading from this repository.

⚠️ This is a LIVE operation — running servers will pick up new values. Test carefully
in a non-production universe first.

Requires API key scope: universe:write`,
      inputSchema: PublishConfigSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_publish_config", async (params: z.infer<typeof PublishConfigSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/publish`;
        const result = await makeApiRequest<ConfigVersion>(url, "POST", {});

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Published config **${params.repository}** for universe ${params.universe_id}.\n\n` +
              `_Published: ${formatTimestamp(result.updateTime)}_\n\n` +
              `Running game servers will pick up the new values on their next poll.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── List Config Revisions ─────────────────────────────────────────────
  const ListRevisionsSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_config_revisions",
    {
      title: "List Config Revisions",
      description: `List the revision history of a config repository.

Each revision corresponds to a published version, oldest to newest. Use this plus
roblox_restore_config_revision to roll back to a prior state.

Requires API key scope: universe:read`,
      inputSchema: ListRevisionsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_config_revisions", async (params: z.infer<typeof ListRevisionsSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/revisions`;
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<ConfigRevisionListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const lines = [`# Revisions: ${params.repository}`, ""];
        const revisions = data.revisions || [];
        if (revisions.length === 0) {
          lines.push("No revisions found.");
        } else {
          for (const rev of revisions) {
            lines.push(`- **${rev.path.split("/").pop()}** — ${formatTimestamp(rev.createTime)}${rev.etag ? ` (etag: ${rev.etag})` : ""}`);
          }
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

  // ── Restore Config Revision ───────────────────────────────────────────
  const RestoreRevisionSchema = z.object({
    universe_id: universeIdSchema,
    repository: repositorySchema,
    revision_id: z.string().min(1).describe("The revision ID to restore (from roblox_list_config_revisions)"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_restore_config_revision",
    {
      title: "Restore Config Revision",
      description: `Restore a previous published revision as the current live config.

⚠️ This is a live rollback. Running game servers will pick up the restored state.

Requires API key scope: universe:write`,
      inputSchema: RestoreRevisionSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_restore_config_revision", async (params: z.infer<typeof RestoreRevisionSchema>) => {
      try {
        const url = `${CONFIGS_REPOSITORY_BASE(params.universe_id, params.repository)}/revisions/${encodeURIComponent(params.revision_id)}/restore`;
        const result = await makeApiRequest<ConfigVersion>(url, "POST");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Restored revision **${params.revision_id}** to **${params.repository}**.\n\n_Updated: ${formatTimestamp(result.updateTime)}_`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

/**
 * Universe Secrets Tools
 *
 * Manage encrypted secrets (API keys, tokens, credentials) for a Roblox experience.
 * Secrets are fetched inside Luau via HttpService with reference names.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/universes/{id}/secrets
 * API key scopes: universe.secret:read, universe.secret:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema, pageSizeSchema, pageTokenSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { UNIVERSE_SECRETS_BASE } from "../constants.js";
import { UniverseSecret, UniverseSecretListResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

export function registerSecretsTools(server: McpServer): void {
  // ── List Secrets ──────────────────────────────────────────────────────
  const ListSecretsSchema = z.object({
    universe_id: universeIdSchema,
    page_size: pageSizeSchema,
    page_token: pageTokenSchema,
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_list_secrets",
    {
      title: "List Universe Secrets",
      description: `List the secrets stored for a universe.

Only names and metadata are returned — raw secret values are never exposed via API.

Requires API key scope: universe.secret:read`,
      inputSchema: ListSecretsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_list_secrets", async (params: z.infer<typeof ListSecretsSchema>) => {
      try {
        const url = UNIVERSE_SECRETS_BASE(params.universe_id);
        const queryParams: Record<string, unknown> = { maxPageSize: params.page_size };
        if (params.page_token) queryParams.pageToken = params.page_token;

        const data = await makeApiRequest<UniverseSecretListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const secrets = data.secrets || [];
        const lines = [`# Secrets for Universe ${params.universe_id}`, ""];
        if (secrets.length === 0) {
          lines.push("No secrets found.");
        } else {
          for (const s of secrets) {
            lines.push(`- **${s.name}** — updated ${formatTimestamp(s.updateTime)}${s.rotationFrequency ? ` (rotates ${s.rotationFrequency})` : ""}`);
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

  // ── Create Secret ─────────────────────────────────────────────────────
  const CreateSecretSchema = z.object({
    universe_id: universeIdSchema,
    name: z.string().min(1).describe("Secret name (referenced from in-game scripts)"),
    value: z.string().min(1).describe("Secret value (plaintext — will be encrypted server-side)"),
    rotation_frequency: z.string().optional().describe("Optional rotation interval (e.g. '30d')"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_create_secret",
    {
      title: "Create Universe Secret",
      description: `Create a new secret for a universe.

The value is sent in plaintext over HTTPS and encrypted server-side. Name your
secrets clearly — you'll reference them from Luau via HttpService.

⚠️ Be careful with secret values in logs and chat — this tool sees the plaintext value.

Requires API key scope: universe.secret:write`,
      inputSchema: CreateSecretSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_create_secret", async (params: z.infer<typeof CreateSecretSchema>) => {
      try {
        const url = UNIVERSE_SECRETS_BASE(params.universe_id);
        const body: Record<string, unknown> = { name: params.name, value: params.value };
        if (params.rotation_frequency) body.rotationFrequency = params.rotation_frequency;

        const result = await makeApiRequest<UniverseSecret>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Created secret **${result.name}** in universe ${params.universe_id}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Update Secret ─────────────────────────────────────────────────────
  const UpdateSecretSchema = z.object({
    universe_id: universeIdSchema,
    secret_id: z.string().min(1).describe("The secret ID to update"),
    value: z.string().min(1).optional().describe("New secret value"),
    rotation_frequency: z.string().optional().describe("New rotation frequency"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_secret",
    {
      title: "Update Universe Secret",
      description: `Update a secret's value or rotation frequency.

Requires API key scope: universe.secret:write`,
      inputSchema: UpdateSecretSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_secret", async (params: z.infer<typeof UpdateSecretSchema>) => {
      try {
        const url = `${UNIVERSE_SECRETS_BASE(params.universe_id)}/${encodeURIComponent(params.secret_id)}`;
        const body: Record<string, unknown> = {};
        const updateMask: string[] = [];
        if (params.value !== undefined) { body.value = params.value; updateMask.push("value"); }
        if (params.rotation_frequency !== undefined) { body.rotationFrequency = params.rotation_frequency; updateMask.push("rotationFrequency"); }

        if (updateMask.length === 0) {
          return { content: [{ type: "text" as const, text: "No fields to update." }] };
        }

        const result = await makeApiRequest<UniverseSecret>(url, "PATCH", body, { updateMask: updateMask.join(",") });

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated secret **${result.name}**. Fields changed: ${updateMask.join(", ")}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Delete Secret ─────────────────────────────────────────────────────
  const DeleteSecretSchema = z.object({
    universe_id: universeIdSchema,
    secret_id: z.string().min(1).describe("The secret ID to delete"),
  }).strict();

  server.registerTool(
    "roblox_delete_secret",
    {
      title: "Delete Universe Secret",
      description: `Delete a universe secret permanently.

⚠️ This is irreversible. Game scripts referencing this secret will fail at runtime.

Requires API key scope: universe.secret:write`,
      inputSchema: DeleteSecretSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_delete_secret", async (params: z.infer<typeof DeleteSecretSchema>) => {
      try {
        const url = `${UNIVERSE_SECRETS_BASE(params.universe_id)}/${encodeURIComponent(params.secret_id)}`;
        await makeApiRequest<void>(url, "DELETE");

        return {
          content: [{
            type: "text" as const,
            text: `✅ Secret **${params.secret_id}** deleted from universe ${params.universe_id}.`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

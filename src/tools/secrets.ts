/**
 * Universe Secrets Tools
 *
 * Manage encrypted secrets (API keys, tokens, credentials) for a Roblox experience.
 * Secrets are fetched inside Luau via HttpService with reference names.
 *
 * Roblox requires client-side encryption using LibSodium sealed box before
 * creating or updating secrets. This module handles encryption transparently:
 * callers pass plaintext and the tool encrypts automatically.
 *
 * Base URL: https://apis.roblox.com/cloud/v2/universes/{id}/secrets
 * API key scopes: universe.secret:read, universe.secret:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import _sodium from "libsodium-wrappers";
import { universeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError, formatTimestamp, truncateResponse } from "../services/api-client.js";
import { UNIVERSE_SECRETS_BASE } from "../constants.js";
import { ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

// ── Types ────────────────────────────────────────────────────────────────

interface SecretPublicKey {
  [key: string]: unknown;
  secret: string;   // base64-encoded X25519 public key
  key_id: string;    // key identifier to include in create/update
}

interface SecretResource {
  [key: string]: unknown;
  path?: string;
  id?: string;
  key_id?: string;
  domain?: string;
  createTime?: string;
  updateTime?: string;
}

interface SecretListResponse {
  [key: string]: unknown;
  secrets?: SecretResource[];
  nextPageToken?: string;
  // Roblox may also use cursor-based pagination
  cursor?: string;
}

// ── Encryption Helper ────────────────────────────────────────────────────

/**
 * Fetch the universe's public key, encrypt the plaintext with LibSodium
 * sealed box, and return the base64-encoded ciphertext + key_id.
 */
async function encryptSecretValue(
  universeId: string,
  plaintext: string
): Promise<{ encryptedBase64: string; keyId: string }> {
  // 1. Fetch the universe's public key
  const pkUrl = `${UNIVERSE_SECRETS_BASE(universeId)}/public-key`;
  const pk = await makeApiRequest<SecretPublicKey>(pkUrl, "GET");

  if (!pk.secret || !pk.key_id) {
    throw new Error(
      `Public key response missing expected fields. Got: ${JSON.stringify(pk)}. ` +
      `Ensure your API key has universe.secret:read scope.`
    );
  }

  // 2. Encrypt with LibSodium sealed box
  await _sodium.ready;
  const sodium = _sodium;
  const publicKeyBytes = sodium.from_base64(pk.secret, sodium.base64_variants.ORIGINAL);
  const messageBytes = sodium.from_string(plaintext);
  const encrypted = sodium.crypto_box_seal(messageBytes, publicKeyBytes);

  // 3. Base64 encode
  const encryptedBase64 = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

  return { encryptedBase64, keyId: pk.key_id };
}

export function registerSecretsTools(server: McpServer): void {
  // ── List Secrets ──────────────────────────────────────────────────────
  const ListSecretsSchema = z.object({
    universe_id: universeIdSchema,
    limit: z.number().int().min(1).max(500).default(10)
      .describe("Number of secrets per page (1-500, default 10)"),
    cursor: z.string().optional()
      .describe("Pagination cursor from a previous response"),
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
        const queryParams: Record<string, unknown> = { limit: params.limit };
        if (params.cursor) queryParams.cursor = params.cursor;

        const data = await makeApiRequest<SecretListResponse>(url, "GET", undefined, queryParams);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const secrets = data.secrets || [];
        const lines = [`# Secrets for Universe ${params.universe_id}`, ""];
        if (secrets.length === 0) {
          lines.push("No secrets found.");
        } else {
          for (const s of secrets) {
            const label = s.id || s.path || "(unknown)";
            const updated = s.updateTime ? ` — updated ${formatTimestamp(s.updateTime)}` : "";
            lines.push(`- **${label}**${updated}`);
          }
          const nextCursor = data.cursor || data.nextPageToken;
          if (nextCursor) {
            lines.push("", `_More results. Use cursor: \`${nextCursor}\`_`);
          }
        }
        return { content: [{ type: "text" as const, text: truncateResponse(lines.join("\n")) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Get Secret Public Key ─────────────────────────────────────────────
  const GetPublicKeySchema = z.object({
    universe_id: universeIdSchema,
  }).strict();

  server.registerTool(
    "roblox_get_secret_public_key",
    {
      title: "Get Secret Encryption Public Key",
      description: `Retrieve the universe's public key for encrypting secrets.

The key is a base64-encoded X25519 public key used with LibSodium sealed box
encryption. You don't normally need to call this directly — create_secret and
update_secret handle encryption automatically.

Requires API key scope: universe.secret:read`,
      inputSchema: GetPublicKeySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_secret_public_key", async (params: z.infer<typeof GetPublicKeySchema>) => {
      try {
        const url = `${UNIVERSE_SECRETS_BASE(params.universe_id)}/public-key`;
        const data = await makeApiRequest<SecretPublicKey>(url, "GET");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(data, null, 2),
          }],
          structuredContent: data,
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Create Secret ─────────────────────────────────────────────────────
  const CreateSecretSchema = z.object({
    universe_id: universeIdSchema,
    secret_id: z.string().min(1).describe("Secret identifier (referenced from in-game scripts)"),
    value: z.string().min(1).describe("Secret value in plaintext — will be encrypted client-side with LibSodium sealed box before sending to Roblox"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_create_secret",
    {
      title: "Create Universe Secret",
      description: `Create a new secret for a universe.

The plaintext value you provide is automatically encrypted using the universe's
public key (LibSodium sealed box) before being sent to Roblox. The API never
sees or stores plaintext.

⚠️ Be careful with secret values in logs and chat — this tool sees the plaintext value.

Requires API key scopes: universe.secret:read (to fetch public key), universe.secret:write`,
      inputSchema: CreateSecretSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_create_secret", async (params: z.infer<typeof CreateSecretSchema>) => {
      try {
        // Encrypt the plaintext value with the universe's public key
        const { encryptedBase64, keyId } = await encryptSecretValue(params.universe_id, params.value);

        const url = UNIVERSE_SECRETS_BASE(params.universe_id);
        const body: Record<string, unknown> = {
          id: params.secret_id,
          secret: encryptedBase64,
          key_id: keyId,
        };

        const result = await makeApiRequest<SecretResource>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        const label = result.id || params.secret_id;
        return {
          content: [{
            type: "text" as const,
            text: `✅ Created secret **${label}** in universe ${params.universe_id}.\n\nThe value was encrypted with LibSodium sealed box before transmission.`,
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
    value: z.string().min(1).describe("New secret value in plaintext — will be encrypted client-side before sending"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_update_secret",
    {
      title: "Update Universe Secret",
      description: `Update a secret's value. The new plaintext value is automatically encrypted
using the universe's public key (LibSodium sealed box) before being sent.

Requires API key scopes: universe.secret:read (to fetch public key), universe.secret:write`,
      inputSchema: UpdateSecretSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_update_secret", async (params: z.infer<typeof UpdateSecretSchema>) => {
      try {
        // Encrypt the plaintext value with the universe's public key
        const { encryptedBase64, keyId } = await encryptSecretValue(params.universe_id, params.value);

        const url = `${UNIVERSE_SECRETS_BASE(params.universe_id)}/${encodeURIComponent(params.secret_id)}`;
        const body: Record<string, unknown> = {
          secret: encryptedBase64,
          key_id: keyId,
        };

        const result = await makeApiRequest<SecretResource>(url, "PATCH", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result };
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Updated secret **${params.secret_id}** in universe ${params.universe_id}.\n\nThe new value was encrypted with LibSodium sealed box before transmission.`,
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

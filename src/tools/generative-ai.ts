/**
 * Generative AI Tools
 *
 * Text-to-speech asset generation and text translation. Both are
 * universe-scoped sub-operations under Cloud v2.
 *
 * Base URLs:
 *   POST /cloud/v2/universes/{universeId}:generateSpeechAsset
 *   POST /cloud/v2/universes/{universeId}:translateText
 * API key scopes:
 *   speech:   universe:write, asset:read, asset:write
 *   translate: universe:write
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { universeIdSchema, responseFormatSchema } from "../schemas/common.js";
import { makeApiRequest, handleApiError } from "../services/api-client.js";
import { GENERATE_SPEECH_BASE, TRANSLATE_TEXT_BASE, CLOUD_V2_BASE_URL } from "../constants.js";
import { SpeechAssetOperation, TranslateTextResponse, ResponseFormat } from "../types.js";
import { wrapTool } from "../services/logger.js";

export function registerGenerativeAiTools(server: McpServer): void {
  // ── Generate Speech Asset ─────────────────────────────────────────────
  const GenerateSpeechSchema = z.object({
    universe_id: universeIdSchema,
    text: z
      .string()
      .min(1)
      .max(5000)
      .describe("Text to synthesize (1-5000 characters)"),
    language_code: z
      .string()
      .optional()
      .describe("BCP-47 language code (e.g. 'en-US', 'ja-JP'). Defaults to English."),
    voice_name: z
      .string()
      .optional()
      .describe("Optional voice name if the API supports voice selection"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_generate_speech_asset",
    {
      title: "Generate Speech Asset (TTS)",
      description: `Synthesize speech from text into a Roblox audio asset.

Returns an async operation. Poll with get_generative_operation to
retrieve the final asset ID for use in your experience.

Requires API key scopes: universe:write, asset:read, asset:write`,
      inputSchema: GenerateSpeechSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    wrapTool("roblox_generate_speech_asset", async (params: z.infer<typeof GenerateSpeechSchema>) => {
      try {
        const url = GENERATE_SPEECH_BASE(params.universe_id);
        const body: Record<string, unknown> = {
          text: params.text,
        };
        if (params.language_code) body.languageCode = params.language_code;
        if (params.voice_name) body.voiceName = params.voice_name;

        const op = await makeApiRequest<SpeechAssetOperation>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(op, null, 2) }], structuredContent: op };
        }

        const opId = op.path.split("/").pop() || "(unknown)";
        const done = op.done === true;
        if (done && op.response) {
          return {
            content: [{
              type: "text" as const,
              text: `✅ Speech asset generated. Asset path: ${op.response.path}${op.response.assetId ? ` (id: ${op.response.assetId})` : ""}`,
            }],
          };
        }
        return {
          content: [{
            type: "text" as const,
            text: `⏳ Speech generation started. Operation: \`${opId}\`\n\n_Poll with roblox_get_generative_operation to retrieve the asset URL._`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Translate Text ────────────────────────────────────────────────────
  const TranslateTextSchema = z.object({
    universe_id: universeIdSchema,
    text: z
      .string()
      .min(1)
      .max(5000)
      .describe("Text to translate"),
    source_language_code: z
      .string()
      .optional()
      .describe("Source BCP-47 code. If omitted the API auto-detects."),
    target_language_codes: z
      .array(z.string())
      .min(1)
      .describe("One or more target BCP-47 codes (e.g. ['ja-JP', 'fr-FR'])"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_translate_text",
    {
      title: "Translate Text",
      description: `Translate text from one language into one or more target languages.
Uses Roblox's in-experience localization translation engine.

Requires API key scope: universe:write`,
      inputSchema: TranslateTextSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_translate_text", async (params: z.infer<typeof TranslateTextSchema>) => {
      try {
        const url = TRANSLATE_TEXT_BASE(params.universe_id);
        const body: Record<string, unknown> = {
          text: params.text,
          targetLanguageCodes: params.target_language_codes,
        };
        if (params.source_language_code) body.sourceLanguageCode = params.source_language_code;

        const data = await makeApiRequest<TranslateTextResponse>(url, "POST", body);

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data };
        }

        const translations = data.translations || [];
        const lines = [`# Translation results`, ""];
        if (translations.length === 0) {
          lines.push("_No translations returned._");
        } else {
          translations.forEach((t) => {
            lines.push(`**${t.targetLanguageCode}:** ${t.text}`);
          });
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );

  // ── Poll Generative Operation ────────────────────────────────────────
  const OperationSchema = z.object({
    universe_id: universeIdSchema,
    operation_id: z.string().min(1).describe("Operation ID returned by a generative AI call"),
    response_format: responseFormatSchema,
  }).strict();

  server.registerTool(
    "roblox_get_generative_operation",
    {
      title: "Poll Generative AI Operation",
      description: `Poll the status of a speech generation (or other generative AI)
long-running operation. When done, the response contains the resulting
asset path or error details.`,
      inputSchema: OperationSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    wrapTool("roblox_get_generative_operation", async (params: z.infer<typeof OperationSchema>) => {
      try {
        const url = `${CLOUD_V2_BASE_URL}/universes/${params.universe_id}/operations/${encodeURIComponent(params.operation_id)}`;
        const op = await makeApiRequest<SpeechAssetOperation>(url, "GET");

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text" as const, text: JSON.stringify(op, null, 2) }], structuredContent: op };
        }

        if (op.error) {
          return { content: [{ type: "text" as const, text: `❌ Operation failed: ${op.error.message}` }] };
        }
        if (op.done !== true) {
          return { content: [{ type: "text" as const, text: `⏳ Operation ${params.operation_id} still in progress.` }] };
        }
        if (op.response) {
          return {
            content: [{
              type: "text" as const,
              text: `✅ Operation complete. Asset path: ${op.response.path}${op.response.assetId ? ` (id: ${op.response.assetId})` : ""}`,
            }],
          };
        }
        return { content: [{ type: "text" as const, text: `✅ Operation ${params.operation_id} complete.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }] };
      }
    })
  );
}

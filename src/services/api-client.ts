/**
 * Roblox Open Cloud API Client
 *
 * Shared HTTP client with authentication, error handling, rate limit awareness,
 * and response formatting utilities.
 */

import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { API_TIMEOUT_MS, CHARACTER_LIMIT } from "../constants.js";

// API key loaded from environment
function getApiKey(): string {
  const key = process.env.ROBLOX_API_KEY;
  if (!key) {
    throw new Error(
      "ROBLOX_API_KEY environment variable is required. " +
        "Create an API key at https://create.roblox.com/dashboard/credentials"
    );
  }
  return key;
}

/**
 * Make an authenticated request to the Roblox Open Cloud API.
 */
export async function makeApiRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: unknown,
  params?: Record<string, unknown>,
  timeoutMs: number = API_TIMEOUT_MS,
  additionalHeaders?: Record<string, string>
): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url,
    data,
    params,
    timeout: timeoutMs,
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...additionalHeaders,
    },
  };

  const response = await axios(config);
  return response.data as T;
}

/**
 * Handle Roblox API errors and return actionable error messages.
 */
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ code?: string; message?: string }>;
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const body = axiosErr.response.data;
      const detail = body?.message || JSON.stringify(body);

      switch (status) {
        case 400:
          return `Error: Bad request — ${detail}. Check that all parameters are correctly formatted.`;
        case 401:
          return "Error: Authentication failed. Check your ROBLOX_API_KEY environment variable.";
        case 403:
          return `Error: Permission denied — ${detail}. Ensure your API key has the required scopes for this operation.`;
        case 404:
          return `Error: Resource not found — ${detail}. Verify the universe ID, place ID, or resource path.`;
        case 409:
          return `Error: Conflict — ${detail}. The resource may have been modified concurrently. Retry with the latest version.`;
        case 429:
          return "Error: Rate limit exceeded. Wait a few seconds before retrying. Consider reducing request frequency.";
        case 500:
        case 502:
        case 503:
          return `Error: Roblox API server error (${status}). This is usually temporary — retry in a few seconds.`;
        default:
          return `Error: API request failed with status ${status} — ${detail}`;
      }
    } else if (axiosErr.code === "ECONNABORTED") {
      return "Error: Request timed out. The operation may still be processing — check before retrying.";
    } else if (axiosErr.code === "ENOTFOUND" || axiosErr.code === "ECONNREFUSED") {
      return "Error: Cannot reach Roblox API servers. Check your network connection.";
    }
  }
  return `Error: Unexpected error — ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Truncate a response string if it exceeds the character limit.
 */
export function truncateResponse(
  text: string,
  hint?: string
): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  const truncated = text.slice(0, CHARACTER_LIMIT);
  const suffix = `\n\n---\n⚠️ Response truncated (${text.length} → ${CHARACTER_LIMIT} chars).${hint ? ` ${hint}` : " Use pagination or filters to narrow results."}`;
  return truncated + suffix;
}

/**
 * Format a timestamp string to a human-readable format.
 */
export function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "N/A";
  try {
    return new Date(ts).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return ts;
  }
}

/**
 * Extract a universe ID from a path like "universes/12345".
 */
export function extractIdFromPath(path: string, resource: string): string {
  const regex = new RegExp(`${resource}/(\\d+)`);
  const match = path.match(regex);
  return match ? match[1] : path;
}

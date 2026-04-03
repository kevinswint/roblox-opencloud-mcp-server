/**
 * Shared Zod schemas used across multiple tool domains.
 */

import { z } from "zod";
import { ResponseFormat } from "../types.js";

export const universeIdSchema = z
  .string()
  .regex(/^\d+$/, "Universe ID must be a numeric string")
  .describe("The universe ID of your Roblox experience (find it in Creator Hub URL or experience settings)");

export const placeIdSchema = z
  .string()
  .regex(/^\d+$/, "Place ID must be a numeric string")
  .describe("The place ID within the experience");

export const responseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

export const pageTokenSchema = z
  .string()
  .optional()
  .describe("Pagination token from a previous response to get the next page");

export const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe("Number of results per page (1-100, default 20)");

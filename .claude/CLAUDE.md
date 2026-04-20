# roblox-opencloud-mcp-server — Project Instructions

## Fix Bugs Immediately — Never Backlog
Inherits from `~/.claude/CLAUDE.md`.

This server has a recurring class of bug: **Roblox endpoint expects a body shape the server isn't sending**. Content-Type mismatches (415), field-name mismatches (silent no-op or 400 with `field: "X"`), and URL-path mismatches (404) all look superficially different but share one root cause: the MCP server is sending something the API doesn't accept.

When a tool fails:

1. **Probe first.** Write a throwaway tsx script that tries 3–4 candidate body shapes against the real Roblox API and prints status + response. Do not skip this step — guessing costs more time than probing.
2. **Fix the root cause.** Do not add a workaround in the agent; do not mark the tool as "known issue" and route around it. Fix the body shape in the tool.
3. **Never reduce scope.** If one tool in a family (e.g., `update_developer_product`) is fixed, check every sibling tool in the same file for the same bug pattern and fix them too in the same commit. In this codebase, `create_X` and `update_X` usually share the same content-type requirements; if one needs multipart, the other does too.
4. **Rebuild and verify.** `npm run build`, then call the tool via the Python agent's workflows to confirm end-to-end.

## Execute Obvious Enhancements
If you notice a missing schema description, a misleading error message, a magic string that should be a constant, a URL helper that's inconsistent with its peers — fix it in the same commit. Do not leave "cleanup for later" comments.

## Commit Pattern
- `fix(<domain>): <short>` for bugs (see recent history: `fix(monetization): ...`, `fix(memory-stores): ...`)
- `feat(<domain>): <short>` for new tools
- `docs(LIMITATIONS): ...` for gap documentation updates
- Always explain *why* in the body, with a reference to how the bug surfaced (which workflow, which universe, what error)
- Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` footer

## Resolved Bug Patterns (don't re-introduce)
- Create endpoints for monetization (`developer_products/v2`, `game-passes/v1`) require multipart/form-data with PascalCase field names — `Name`, `Description`, `PriceInRobux` (dev products) or `IsForSale`, `Price` (game passes). JSON bodies return 415.
- Update endpoints (`PATCH`) on the same APIs *also* require multipart — no `updateMask` query param. Only include the fields being changed. Endpoint returns 204; do a follow-up GET to maintain the response contract.
- Config API (`creator-configs-public-api/v1`) only accepts `InExperienceConfig` and `DataStoresConfig` as `{repository}` path segment values — never `"default"`.
- Config update body expects `{entries: {...}}` at top level, not `{data: {...}}`. The server wraps each value as `{value: X, description: null}` automatically.
- `list_data_stores` returns objects whose `id` field is the store name path (`"universes/X/data-stores/NAME"`); strip the prefix before passing to `list_data_store_entries` (or normalize via the tool).
- `list_data_store_entries` returns entries under the `entries` key, not `keys`.
- Ordered data stores list: `orderBy` must be `"value"`, `"value desc"`, or empty.
- Memory store sorted maps list: `orderBy` must be `"asc"` or `"desc"`.
- `get_developer_product` and `get_game_pass` need the `/creator` suffix appended to the URL.

## Probe Script Template
Keep throwaway probes at the repo root, named `probe_<tool>.ts`. Always use sandbox universe `10028140802` (place `74561430818448`) or test universes `10029094905 / 10029101709 / 10029106560`. Delete the probe after the fix lands.

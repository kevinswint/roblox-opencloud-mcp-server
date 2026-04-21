# Changelog

All notable changes to this project are documented here. Dates use ISO 8601.
Versions follow [Semantic Versioning](https://semver.org/).

## [0.1.1] — 2026-04-20

### Added
- `roblox_get_secret_public_key` tool for LibSodium sealed-box secrets flow. Secrets domain now has 5 tools, bringing the total to 96.

### Fixed
- Timing-safe comparison for HTTP `MCP_AUTH_TOKEN` Bearer auth.
- Badge limit values and thumbnail size format.
- Monetization create/update endpoints for developer products and game passes — now use `multipart/form-data` with the PascalCase field names the API requires (`Name`, `Description`, `PriceInRobux`, `IsForSale`, `Price`). JSON bodies return 415.
- `list_data_stores` identifier normalization — extracts the store name from the `path` field rather than the non-spec `id` field.
- Ordered Data Store `orderBy` schema — exposes the API-valid wire values (`"value"`, `"value desc"`, `""`).
- Memory Store Sorted Map `orderBy` schema — exposes the API-valid wire values (`"asc"`, `"desc"`); default changed to `"desc"`.
- `get_developer_product` and `get_game_pass` URLs — now append the required `/creator` suffix.
- Miscellaneous API field / body mismatches across monetization, configs, data stores, and memory stores.

### Security
- Bumped `axios` to 1.15.0+ to clear the `follow-redirects` auth-header-leak advisory ([GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653)).
- Bumped `hono` via `@modelcontextprotocol/sdk` to clear the JSX SSR HTML injection advisory ([GHSA-458j-xx4x-4375](https://github.com/advisories/GHSA-458j-xx4x-4375)).
- Adversarial code audit hardening pass.

## [0.1.0] — 2026-04-12

Initial release. 95 tools across 18 domains: Luau Execution, Data Stores, Ordered Data Stores, Memory Stores, Messaging, Universes & Places, Monetization (Developer Products & Game Passes), Creator Store Products, Configs, Universe Secrets, User Restrictions, Assets, Groups, Users & Inventory, Badges, Thumbnails, Experience Notifications, and Generative AI. Dual stdio + HTTP transport via the official `@modelcontextprotocol/sdk`.

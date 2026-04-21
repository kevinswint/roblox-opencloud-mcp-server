# LIMITATIONS — Roblox Open Cloud

This server wraps 96 Open Cloud tools across 18 domains. Primary gaps: analytics and experiments APIs, public moderation endpoints, webhook management, Team Create modern API, and modernized localization. Full detail below.

This document outlines the constraints and gaps in the Roblox Open Cloud API as wrapped by the roblox-opencloud-mcp-server (v0.1).

## What This Server Ships

The server provides **96 tools across 18 domains**, covering documented, API-key-callable Open Cloud surfaces with meaningful CRUD or action endpoints:

| Domain | Tool Count | Stability |
|--------|-----------|-----------|
| Luau Execution | 2 | Beta |
| Data Stores (standard) | 7 | GA |
| Ordered Data Stores | 6 | GA |
| Memory Stores | 10 | GA |
| Messaging Service | 1 | GA |
| Universes + Places | 5 | GA |
| Monetization | 8 | GA |
| Creator Store Products | 2 | GA |
| Configs API | 8 | GA |
| Universe Secrets | 5 | GA |
| User Restrictions | 4 | GA |
| Assets v1 | 10 | GA |
| Groups | 9 | GA |
| Users + Inventory | 4 | GA |
| Badges | 6 | Mixed |
| Thumbnails | 5 | GA |
| Experience Notifications | 1 | GA |
| Generative AI | 3 | Beta |

## Surfaces Deliberately Not Wrapped

### 1. Private Servers / VIP Servers
Every VIP server endpoint requires `.ROBLOSECURITY` cookie authentication, which the server avoids since cookie-based auth ties tools to specific user sessions rather than app credentials.

### 2. Trades
Endpoints are cookie-only. Per Roblox announcements, trading is deprecated.

### 3. Interactions (Follows, Favorites, Votes)
Cookie-only for writes. Public reads don't need wrapping since they're already accessible anonymously.

### 4. Localization Tables (Legacy)
Uses pre-Open-Cloud `legacy-universe:manage` scopes. Modern replacement via Configs API exists but doesn't cover full CRUD for localization entries.

### 5. Avatars (User-Scoped)
Write operations require cookies—inappropriate for app-credential workflows.

### 6. Sponsored Campaigns / Ad Management
Cookie-based. High-trust spending operations shouldn't run through generic tools.

### 7. Team Create Collaboration
Legacy-scoped endpoints assume human Studio interaction, not agent provisioning.

### 8. Moderation (Standalone Text/Asset Checks)
**Critical gap:** No public endpoint exists to pre-screen text or assets for moderation violations outside of actual upload. This forces developers to build parallel moderation pipelines.

### 9. Webhooks / Event Delivery
The Creator Hub UI supports webhooks, but no programmatic API exists to register, list, or manage them.

### 10. Subscriptions (Experience Subscriptions)
Cloud v2 references a `Subscription` resource type with no documented endpoints.

### 11. Matchmaking
Marked Beta with unclear scopes; endpoints appear internal.

### 12. Analytics, Experiments, and Error Telemetry
**Most-requested absence:** No public APIs for DAU, revenue, retention, A/B tests, error logs, server metrics, or session data.

### 13. Place Publishing
The exact request shape for publishing place versions isn't documented clearly enough to wrap safely.

### 14. Studio Plugin Management
No public API for plugin installation or configuration.

## Surfaces With No Public API Whatsoever

- Experience Events (live ops calendars)
- Developer community voting / comments
- Feedback widgets and bug reports
- Badge awarding outside live servers
- Creator Hub notifications
- Roblox advertising auction state
- Server performance dashboards
- Script profiler results
- Network inspector captures
- Memory profiler captures
- Content deletion/GDPR workflows

## Beta Dependencies (Expect Schema/Scope Churn)

### Luau Execution
- Available since Sept 2024, still Beta
- Task ID structure deeply nested; recent docs introduced binary input handling separately
- Scripts calling `wait()` or yielding indefinitely pin tasks in `PROCESSING`—the server gives up after 30 poll attempts
- Requires `universe-datastores.*` scopes if scripts reference DataStoreService

### Generative AI (TTS + Translate)
- Speech generation response shape (`imageUri` vs `assetUri` vs `path`) has shifted between docs versions
- NOT available: Cube 3D/4D, material generation, mesh generation, speech-to-text

### Inventories
- Only `/users/{id}/inventory-items` is Cloud v2; rest is legacy
- Separate rate limit: 100 req/min via API key, 20/min via OAuth
- Filter syntax (`assetTypes=HAT`) loosely documented

### Memory Stores
- GA'd Dec 2025; flush operation shape finalized early 2026

### Creator Configs
- Repository names are a closed enum: only `InExperienceConfig` and `DataStoresConfig` work (not free-form)
- `POST .../publish` returns 500 with empty body on some universes despite valid drafts
- Draft PATCH/PUT uses `{entries: {...}}`, not `{data: ...}` (latter silently fails)

## The Rate-Limit Ceiling

All Open Cloud calls from one API key share a **500 requests/min ceiling**. Implications:

- Long bulk operations are paced (listing 10,000 DataStore entries takes ~20 seconds minimum)
- Shared keys hit limits faster than expected
- Some endpoints have lower per-endpoint limits (Inventories: 100 req/min; Memory Store flush: 1/min)
- The server emits stderr warnings at 80% utilization

## Known Quirks Per Domain

- **Data Stores v1 vs v2:** Server wraps v2 only; cursor/pageToken pagination differs
- **Ordered Data Stores:** Separate URL path and scope names; not a Data Store subtype
- **Memory Store scopes:** Bare prefix pattern (`universe.memory-store.queue:*`) rather than `universe.<resource>:<action>`
- **Game Passes vs Developer Products:** Different base URLs, different scope shapes
- **Creator Store Products:** Separate surface with 30 req/min limit (much lower than 500/min ceiling)
- **Messaging v2:** Structured as universe sub-operation; v1 fallback available
- **Badge writes:** Legacy scope `legacy-universe.badge:*`; reads are public
- **Thumbnails:** Fully public; no API key required
- **Groups:** Primarily read-only; limited write support (accept/decline requests, assign roles)
- **User Restrictions:** Server wraps universe-level; place-level also available
- **Configs API:** GA'd 2026-03-10; draft→publish workflow risks blanking production config on empty draft publish
- **Luau Execution:** Polls task endpoint until `COMPLETE`; doesn't stream logs real-time; latest-version by default

## Scope Fragmentation

Scopes lack consistent naming patterns:

| Pattern | Example | Used By |
|---------|---------|---------|
| `universe.<resource>.<action>` | `universe.developer-product:read` | Newer GA APIs |
| `universe-<resource>.<action>` | `universe-datastores.objects:update` | Data Stores v2 |
| `<resource>:<action>` | `creator-store-product:write` | Creator Store, Assets |
| `legacy-<resource>:<action>` | `legacy-universe.badge:write` | Badge writes |
| `universe.<deep-path>:<action>` | `universe.ordered-data-store.scope.entry:read` | Ordered Data Stores |

## Recommendations for Roblox (Priority Order)

1. **Analytics & experiments APIs** (DAU, retention, revenue, errors, A/B tests)—#1 partner ask
2. **Public moderation endpoints** (text/asset pre-screening without upload)
3. **Webhook management API** (register, list, test, delete)
4. **Team Create modern API** (agent-provisioned Studio access)
5. **Localization Tables modern API** (retire `legacy-universe:manage`)
6. **Private Server management API** (modern Cloud v2 surface)
7. **Scope grammar unification** + scope lookup API
8. **Place Publishing API documentation**
9. **Subscriptions API completion**
10. **Studio plugin management API**

**Central theme:** Open Cloud optimizes for data manipulation but under-invests in observability and integration. Filling these gaps would substantially expand what external tooling and agents can do.

## Document Maintenance

Re-validate this file whenever:
- A new Open Cloud GA release occurs
- Scope shapes change
- Tools return 404s on previously-working endpoints
- Users report legitimate API gaps

**As of:** April 20, 2026. Assume staleness if reading >3 months later.

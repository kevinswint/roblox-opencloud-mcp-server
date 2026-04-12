# LIMITATIONS — Roblox Creator Hub Open Cloud, as of April 2026

This document is the point of the project. The 95 tools shipped in
v0.1 are a faithful wrapper of what's currently possible through the
public Open Cloud surface — but "faithful" is not the same as
"complete." The Creator Hub experience has roughly three times as
many programmatic affordances inside Roblox Studio and the Creator
Hub web UI as it does through Open Cloud, and that's before counting
the hundreds of services that have no programmatic surface at all.

If you're an AI agent trying to do real work inside a Roblox project,
this file tells you where the wall is and why it's there. If you're a
platform PM at Roblox, this file is a prioritized punchlist of what
external tooling is asking for and why the existing half-measures
aren't enough.

**All content is as of 2026-04-11.** Open Cloud is moving fast —
entire surfaces have gone GA since the plan that produced this server
was drafted. Cross-reference the dates on any claim below against
[create.roblox.com/docs/cloud](https://create.roblox.com/docs/cloud).

---

## Contents

1. [What this server ships](#what-this-server-ships)
2. [Surfaces deliberately not wrapped, and why](#surfaces-deliberately-not-wrapped-and-why)
3. [Surfaces that have no public Open Cloud equivalent](#surfaces-that-have-no-public-open-cloud-equivalent)
4. [Beta dependencies you should assume will break](#beta-dependencies-you-should-assume-will-break)
5. [The rate-limit ceiling](#the-rate-limit-ceiling)
6. [Known quirks and stability notes per domain](#known-quirks-and-stability-notes-per-domain)
7. [Scope fragmentation](#scope-fragmentation)
8. [Recommendations for Roblox](#recommendations-for-roblox)

---

## What this server ships

**95 tools across 18 domains**, covering every public Open Cloud
surface that is (a) documented, (b) callable with an API key (i.e.
not cookie-only), and (c) has at least one non-trivial CRUD or
action endpoint worth wrapping.

| Domain | Tool count | Stability |
|---|---|---|
| Luau Execution | 2 | **Beta** |
| Data Stores (standard) | 7 | GA |
| Ordered Data Stores | 6 | GA |
| Memory Stores (Queues + Sorted Maps) | 10 | GA |
| Messaging Service (v2 + v1 fallback) | 1 | GA |
| Universes + Places | 5 | GA |
| Monetization — Developer Products + Game Passes | 8 | GA (Dec 2025) |
| Creator Store Products | 2 | GA |
| Configs API | 8 | GA (Mar 10 2026) |
| Universe Secrets | 4 | GA |
| User Restrictions (bans) | 4 | GA |
| Assets v1 | 10 | GA |
| Groups | 9 | GA (read-only public, some writes) |
| Users + Inventory | 4 | GA |
| Badges | 6 | Mix (legacy writes, public reads) |
| Thumbnails | 5 | GA public read |
| Experience Notifications | 1 | GA |
| Generative AI (TTS + Translate) | 3 | **Beta** |

See [README.md](README.md) for the full tool index and
[DEMOS.md](DEMOS.md) for 11 end-to-end agent flows.

---

## Surfaces deliberately not wrapped, and why

The following surfaces exist in Roblox but are intentionally omitted
from this server. They are not bugs — they are product gaps or
platform limitations that we surface rather than paper over.

### 1. Private Servers / VIP Servers

**Gap:** No API key support — every endpoint under
`https://apis.roblox.com/v1/vip-servers/*` and
`/v1/games/vip-servers/*` requires `.ROBLOSECURITY` cookie auth.

**Why we don't wrap:** Cookie-based auth is a user-session construct,
not an app-credential one. Wrapping it would require the user to pass
their personal Roblox session cookie into an MCP server, which is a
security anti-pattern and would tie the tools to a specific human
identity rather than an experience's credentials.

**Who this blocks:** Anyone building automated private-server
provisioning for tournaments, paid events, clan matches, or
"reserved room" features. The Developer Hub docs describe this flow,
but programmatically it's cookie-only.

**Fix inside Roblox:** Promote a subset of VIP server management
(create, list, permissions) to Cloud v2 with a new
`universe.private-server:*` scope family.

### 2. Trades

**Gap:** Same story as private servers — `/v1/trades/*` and
`/v2/trades/*` are cookie-only.

**Why we don't wrap:** Same reasoning. Also, per Roblox's own 2025
announcements, the Trades system is deprecated in practice (item
trading is paused for Limited items).

**Recommendation:** leave it alone. Document it here so agents don't
hallucinate a trades tool and waste tokens retrying.

### 3. Interactions (follows, favorites, votes)

**Gap:** Cookie-only. `/v1/users/*/follow`, `/v1/favorites/*`,
`/v1/games/*/votes` all require session cookies.

**Why we don't wrap:** Cookie anti-pattern. Also, many of the read
endpoints already return public data and don't need an API key at
all — a user wanting "how many favorites does game X have?" can just
hit the public URL directly.

**Fix inside Roblox:** Cloud v2 doesn't need to support _sending_
follows/favorites as an app credential (that's a user action), but
it should support _reading_ aggregate counts for your own experiences
without a cookie. The Analytics surface should cover this and does
not.

### 4. Localization Tables (legacy)

**Gap:** The entire `/legacy-localization-tables/v1/*` and
`/legacy-game-internationalization/v1/*` surface uses
`legacy-universe:manage` scopes that feel like a pre-Open-Cloud
artifact.

**Why we don't wrap:** Wrapping legacy-prefixed scopes bakes in a
soon-to-be-retired surface. The actively-maintained alternative is
the in-Studio Localization Tools plus the new Configs API, neither of
which exposes the full CRUD loop for localization-table entries.

**Who this blocks:** Any agent flow that wants to bulk-update
translations without a human opening Studio. The Configs API (which
we _do_ wrap) covers experience config but not localization tables.

**Fix inside Roblox:** Ship a modern `localization-tables` subtree
under Cloud v2 with CRUD on entries, translations, and supported
languages. Deprecate the `legacy-universe:manage` scope.

### 5. Avatars (user-scoped)

**Gap:** Write operations (`set-body-colors`, `set-wearing-assets`,
outfit CRUD) are cookie-only. Read operations are public and don't
need an API key.

**Why we don't wrap:** Cookie anti-pattern for writes; reads don't
need a wrapper because they work anonymously. There is no use case
where an experience's API key should be writing to a user's avatar
without the user's explicit session.

### 6. Sponsored Campaigns / Ad Management

**Gap:** Cookie-based via `adconfiguration.roblox.com`.

**Why we don't wrap:** Cookie anti-pattern, and ad spending is a
high-trust operation that shouldn't run through a generic MCP tool.

**Fix inside Roblox:** If Roblox wants to enable programmatic ad
spend (an emerging request from ad agencies and developer tooling
partners), it needs a dedicated scope like
`universe.sponsored-campaign:manage` with explicit budget caps.

### 7. Team Create collaboration

**Gap:** `/legacy-team-collaboration:manage` scope, and the endpoints
under `/v1/universes/*/teamcreate` only support adding/removing
existing members — not inviting new ones or provisioning project
access for agents.

**Why we don't wrap:** The surface is legacy-scoped and the ergonomics
assume a human is clicking the "Collaborate" button in Studio.

**Fix inside Roblox:** This is one of the most-requested gaps from
developer tooling partners — "let me script who has access to my
experience's Studio project without opening Studio." A modern
`universe.team:*` scope family would unblock a lot of external
tooling.

### 8. Moderation (standalone text/asset checks)

**Gap:** There is no public Open Cloud endpoint for "check this text
for inappropriate content" or "check this asset for moderation
issues" _outside of_ upload. Moderation happens automatically during
`POST /assets` and `POST /chat` flows, but you cannot pre-screen
without either uploading or pasting into a game server.

**Why we don't wrap:** There is literally nothing to wrap.
[**This is one of the most important gaps in the Creator Hub
programmatic surface.**](#recommendations-for-roblox) Every serious
developer tooling vendor builds their own parallel moderation
pipeline (OpenAI moderation, Perspective API, or homegrown
classifiers) because Roblox's own excellent moderation stack is
invisible from outside Studio and experience runtime.

**Fix inside Roblox:** Ship
`POST /cloud/v2/text-moderation:check` and
`POST /cloud/v2/asset-moderation:check` endpoints that take text or
an asset URI and return the same moderation verdict that asset
upload and chat filters return, without actually uploading or
sending. Scope: `moderation:check`. This is a days-of-work feature
with months-of-strategic-value.

### 9. Webhooks / Event Delivery

**Gap:** Roblox has a Webhooks feature surfaced in Creator Hub
("Integrations") but the programmatic side (registering a webhook
URL, listing subscriptions, testing delivery) has no public API. The
inventory phase of this project specifically looked for it and found
nothing documented.

**Why we don't wrap:** Nothing to wrap. The in-Creator-Hub UI works,
but you can't manage webhooks from an agent.

**Who this blocks:** Any integration that wants to register a new
webhook endpoint programmatically (e.g. a Slack/Discord bridge that
provisions itself per experience).

**Fix inside Roblox:** Ship
`GET/POST/DELETE /cloud/v2/universes/{id}/webhooks` with a
`universe.webhook:manage` scope. This is table-stakes for platform
integrations.

### 10. Subscriptions (experience subscriptions)

**Gap:** The Cloud v2 reference lists a `Subscription` resource type
but no enumerated endpoints. The Creator Hub UI has a full
subscription management flow, but it's not externally scriptable.

**Why we don't wrap:** No documented endpoints to wrap. I didn't want
to ship tools that guess at URL shapes and would 404.

**Who this blocks:** Subscription-based experiences that want to
audit or bulk-manage their subscription plans from an agent.

**Fix inside Roblox:** Finish and document the Subscription CRUD
endpoints under `/cloud/v2/universes/{id}/subscriptions`.

### 11. Matchmaking

**Gap:** `/matchmaking-api/v1/*` is marked Beta with no documented
scopes. Most endpoints appear to be internal.

**Why we don't wrap:** The scope story is unclear and the shape of
"programmatic matchmaking" via REST isn't well-defined — matchmaking
is fundamentally a server-side, tight-loop concern that doesn't map
cleanly to request/response tools.

**Fix inside Roblox:** Either finish the public API and document
scopes, or mark it Studio-only and remove from Open Cloud docs
entirely.

### 12. Analytics, Experiments, and Error Telemetry

**Gap:** The most-requested programmatic surfaces and the most
conspicuously absent ones. There is no public Open Cloud API for:

- Reading experience analytics (DAU, revenue, retention curves)
- Running A/B tests or experiments
- Reading error logs / crash reports / script errors
- Reading server performance metrics
- Reading player session data

**Why we don't wrap:** Nothing to wrap.

**Why this matters:** Every serious Roblox developer needs these
signals to do their job. Today they either scrape the Creator Hub UI,
pay a third-party analytics vendor, or build their own
server-script-based telemetry pipeline that fires back to a custom
backend. All three approaches are brittle workarounds for what
should be first-class Open Cloud surfaces.

**Fix inside Roblox:** The big one. Ship
`/cloud/v2/universes/{id}/analytics`,
`/cloud/v2/universes/{id}/experiments`, and
`/cloud/v2/universes/{id}/error-logs`. Each is a multi-quarter
initiative but the strategic unlock is enormous — it would let
external tooling partners build on top of Roblox the way Mixpanel
and LogRocket build on top of the web.

### 13. Place Publishing

**Gap:** There is a Place Publishing API in the docs, but the
request shape is undocumented in current references and the
existing `publish` flow lives inside Studio's Save→Publish UI.

**Why we don't wrap:** I couldn't verify the exact shape of a publish
payload against the live API without risking pushing a broken place
to a test universe. The `roblox_update_place` tool wraps metadata
updates but not "publish new .rbxl content."

**Fix inside Roblox:** Document the multipart upload shape for
`/cloud/v2/universes/{id}/places/{id}/versions` with a clear
content-type contract. This is adjacent to the assets upload path we
_do_ wrap and would benefit from the same pattern.

### 14. Studio Plugin management

**Gap:** No public API for installing, uninstalling, or configuring
Studio plugins on behalf of a user or experience.

**Why we don't wrap:** Nothing to wrap. This is adjacent to the
Creator Store products API (which we _do_ wrap) but Studio plugin
installation is a separate, user-scoped concept.

---

## Surfaces that have no public Open Cloud equivalent

These are Creator Hub features that work perfectly fine in the web UI
but have **zero public API**, not even a cookie-based one:

- Experience Events (live ops calendar)
- Developer community voting / comments
- Feedback widgets and bug reports
- Badge awarding _from outside a live game server_ (you can create
  and update badge metadata, but you cannot award a badge to a user
  without being inside a running server script)
- Creator Hub notifications inbox
- Roblox advertising auction state
- Server performance dashboards
- Script profiler results
- Network inspector captures
- Memory profiler captures
- Content deletion requests / GDPR erasure workflows (partial —
  you can tag entries with user IDs via the Data Stores API but there's
  no API to _initiate_ a GDPR deletion flow)

Every one of these is something an agent might reasonably want to
read or write. None of them are callable today.

---

## Beta dependencies you should assume will break

These are surfaces the server wraps today but are **Beta** — expect
schema or scope churn and plan to revalidate after any major Open
Cloud release.

### Luau Execution (Beta since Sept 2024)

- **What it does:** Lets you run Luau headlessly against a running
  universe and read the result, logs, and return values.
- **Why it's risky:** Path structure is deeply nested with
  session/task IDs. Recent docs have introduced binary input
  handling as a separate surface from task creation, splitting what
  used to be a single `create task` call into two.
- **Known breakage modes:**
  - The task ID returned from a submit call must be passed back
    verbatim — reconstructing it from parts 404s.
  - Scripts that call `wait()` or yield indefinitely will pin the
    task in `PROCESSING` forever. The server's poll budget gives up
    after 30 attempts.
  - Scripts that reference the DataStoreService need the
    `universe-datastores.*` scopes on the same API key, not just
    the Luau Execution scope.
- **If this tool breaks for you:** first thing to check is the
  account-level beta feature toggle in Creator Hub → Account
  Settings → Beta Features. It's opt-in.

### Generative AI — TTS + Translate (Beta)

- Speech generation returns an async operation. The completed
  response shape (`imageUri` vs `assetUri` vs `path`) has shifted
  between docs versions. The server handles the current shape as of
  2026-04-11 — revalidate after any Cloud v2 minor version bump.
- Translate supports multiple target locales in one call but the
  scope requirement (`universe:write`) is stricter than you might
  expect for a read-only operation.
- **NOT available:** Cube 3D/4D, material generation, mesh
  generation, speech-to-text. These are advertised in Roblox
  marketing but not in the public Open Cloud API surface.

### Inventories (Beta, July 2024)

- `GET /users/{id}/inventory-items` is the only Cloud v2 endpoint.
  Everything else is legacy. Pagination via `pageToken` works but
  the filter syntax (`assetTypes=HAT`, `badgeIds=12345`) is
  loosely documented and varies by resource.
- Rate limit: 100 req/min via API key, 20/min via OAuth. Rate limit
  pressure here is independent from the 500/min shared ceiling and
  will bite first if you're listing many users' inventories.

### Memory Stores (GA but recent)

- Went GA in Dec 2025 but the long-running `flush` operation only
  finalized its shape in early 2026. If your agent seems to see
  different operation response formats between sessions, that's why.

---

## The rate-limit ceiling

**All Open Cloud API calls from one API key share a 500 requests/min
ceiling.** This is a hard Roblox-side limit, not something the
server imposes. The server's internal token-bucket rate limiter
paces calls to stay under this ceiling, so individual requests will
block briefly rather than fail outright. But this has implications:

1. **Long bulk operations will be paced.** Listing 10,000 DataStore
   entries across multiple stores will take at least 20 seconds of
   wall-clock time just from the ceiling.
2. **Shared keys are worse.** If the same API key is in use by a
   web dashboard, a Studio plugin, and this MCP server, you'll hit
   the ceiling faster than the MCP server's internal counter
   predicts. Consider provisioning separate keys for separate
   consumers.
3. **Some individual endpoints have lower per-endpoint limits.** The
   Inventories v2 endpoint is 100 req/min (API key). Memory Store
   flushes are 1 per minute. The error messages from `handleApiError`
   call these out when you hit them.

The server emits a warning on stderr when the internal bucket passes
80% utilization so you can react before hitting the ceiling. Tail
stderr with `--loglevel warn` or equivalent to see these.

---

## Known quirks and stability notes per domain

**Data Stores v1 vs v2:** v1 is Beta/Legacy, v2 is GA. This server
wraps v2 only. If you're migrating from a v1-based workflow, the
cursor-based pagination (`cursor`/`limit`) is replaced by
`pageToken`/`maxPageSize`, and scope name spelling differs
(`datastores:write` vs `universe-datastores.objects:update`).

**Ordered Data Stores are not a subtype of Data Stores.** They live
at a different URL path (`/ordered-data-stores/` vs `/data-stores/`)
and use different scope names
(`universe.ordered-data-store.scope.entry:*`). You cannot use a
Data Store scope to read an Ordered Data Store.

**Memory Store scopes use a bare prefix.** Where most scopes look
like `universe.<resource>:<action>`, Memory Store scopes are
`universe.memory-store.queue:*` and
`universe.memory-store.sorted-map:*`. Plan accordingly.

**Game Passes and Developer Products have different base URLs and
different scope shapes.**
`/developer-products/v2/` uses `universe.developer-product:read`,
`/game-passes/v1/` uses `universe.game-pass:read`. There's no single
"monetization scope" and there's no uniformity.

**Creator Store Products are separate from universe monetization.**
They live at `/cloud/v2/creator-store-products` with their own
`creator-store-product:*` scope. Rate limit: 30 req/min, which is
much lower than the 500/min ceiling you might expect.

**Messaging v2 took a long time to ship** and is structured as a
universe sub-operation (`POST /universes/{id}:publishMessage`)
rather than a topic-addressed endpoint. The server wraps v2 by
default with a `use_legacy: true` escape hatch that falls back to
the v1 path-based shape.

**Badge writes are legacy.** The public badge read endpoints
(`badges.roblox.com/v1`) don't need an API key. Badge creation
and update uses `/legacy-badges/v1/*` with
`legacy-universe.badge:*` scopes. When Roblox ships a modern
badges write API, the `roblox_update_badge` tool will need to be
rewritten.

**Thumbnails are fully public.** The `thumbnails.roblox.com/v1/*`
host does not require an API key at all. The server wraps it for
convenience (batch requests, type coercion), but you could also call
it directly.

**Group "writes" are mostly stubs.** The Cloud v2 Groups API is
primarily read-only. The writes it does support (accept/decline
join request, assign role) work fine, but the full membership
management surface is still cookie-only at v1. Don't expect to ban
users from groups or manage group keywords programmatically.

**User Restrictions have two paths: universe-level and place-level.**
This server wraps universe-level (`/user-restrictions`). Place-level
(`/places/{id}/user-restrictions`) has the same shape and is
available if you need it — file an issue if you do.

**Configs API is the newest surface.** GA'd 2026-03-10. The draft →
publish workflow is its signature ergonomic but also its sharpest
edge — a `publish_config` call on an empty draft will blank out your
production config. The `destructiveHint: true` annotation on the
tool is there for a reason.

**Luau Execution supports both latest-version and pinned-version
invocation.** The server uses the latest-version path by default,
which means your Luau script runs against whatever version is
currently live. If you need deterministic behavior across a deploy,
you need to pin the version — filed as a future enhancement, not
available in v0.1.

**Luau Execution log streaming.** The server doesn't stream logs
in real time. It polls the task endpoint until `COMPLETE` and then
returns logs in the final result. For long-running scripts with
interesting log output, you'll want to tail logs separately via
`GET /.../tasks/{id}/logs`.

---

## Scope fragmentation

Open Cloud scopes are not consistently named. You will encounter:

| Shape | Example | Used by |
|---|---|---|
| `universe.<resource>.<action>` | `universe.developer-product:read` | Newer GA APIs |
| `universe-<resource>.<action>` | `universe-datastores.objects:update` | Data Stores v2 |
| `<resource>:<action>` | `creator-store-product:write` | Creator Store, Assets, Thumbnails |
| `legacy-<resource>:<action>` | `legacy-universe.badge:write` | Badge writes |
| `universe.<deep-path>:<action>` | `universe.ordered-data-store.scope.entry:read` | Ordered Data Stores |
| `<short>.<deep-path>:<action>` | `universe.memory-store.queue:read` | Memory Stores |

When configuring an API key, the Creator Hub UI groups scopes
semantically but the scope strings themselves don't share a
consistent grammar. This is annoying for tooling — our
`handleApiError` helper can surface the missing scope name on a 403,
but a developer still has to translate between UI labels and wire
scope names by hand.

**Recommendation for Roblox:** pick one grammar (`universe.<res>:<verb>` is the
most common pattern in new APIs) and migrate older scope names under an
alias system. Ship a scope lookup API:
`GET /cloud/v2/scopes?tool=roblox_list_data_stores` returns the
canonical scope required. That would save every tool vendor a
discovery pass.

---

## Recommendations for Roblox

In strict priority order, based on how much external tooling this
unblocks per engineering quarter:

1. **Analytics & experiments APIs.** DAU, retention, revenue, error
   rates, experiment arms. This is the #1 ask from every serious
   Roblox tooling partner and the most conspicuous absence in the
   Open Cloud surface.
2. **Public moderation endpoints.** Text and asset pre-screening with
   the same verdict the upload flow returns, without actually
   uploading. See [gap #8](#8-moderation-standalone-textasset-checks)
   above.
3. **Webhook management API.** Register, list, test, and delete
   webhooks programmatically. See [gap #9](#9-webhooks--event-delivery).
4. **Team Create modern API.** Let agents provision Studio project
   access without cookies or manual UI clicks. See [gap #7](#7-team-create-collaboration).
5. **Localization Tables modern API.** Retire `legacy-universe:manage`
   scopes by moving the Localization Tables CRUD to a modern Cloud v2
   subtree. See [gap #4](#4-localization-tables-legacy).
6. **Private Server management API.** A modern Cloud v2 surface with
   `universe.private-server:*` scopes. See [gap #1](#1-private-servers--vip-servers).
7. **Scope grammar unification and scope lookup API.** Documented in
   [Scope Fragmentation](#scope-fragmentation).
8. **Place Publishing API documentation.** See [gap #13](#13-place-publishing).
9. **Subscriptions API completion.** See [gap #10](#10-subscriptions-experience-subscriptions).
10. **Studio plugin management API.** See [gap #14](#14-studio-plugin-management).

The common theme across these asks: **Open Cloud today is
optimized for manipulating experiences and data, not for observing,
moderating, or integrating with them.** Filling in the observability
and integration gaps would roughly triple the surface area
available to external tooling partners without adding new product
concepts.

---

## How to keep this document current

This file should be re-validated whenever:

- A new Open Cloud GA release happens (check the
  [release notes](https://create.roblox.com/docs/release-notes)).
- A scope shape changes (watch the
  [Cloud v2 reference](https://create.roblox.com/docs/cloud/reference)).
- A tool in this server starts returning 404s on endpoints that
  used to work (file an issue).
- A user reports "I thought Roblox had X — why isn't it wrapped?"
  (if X turns out to be a legitimate gap, add it to the
  "deliberately not wrapped" section with the reason).

The goal is for this file to **stay honest** as the platform moves.
If you are reading this more than three months after the
`As of April 2026` date at the top, assume at least one section is
stale and double-check before citing it.

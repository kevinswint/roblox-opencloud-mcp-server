#!/bin/bash
# check-scopes.sh — Test every API scope against a sandbox universe
# Usage: ROBLOX_API_KEY=your_key ./scripts/check-scopes.sh [universe_id] [place_id]
#
# Tests one representative endpoint per scope category and reports
# which scopes are working vs missing from your API key.

set -uo pipefail

UNIVERSE_ID="${1:-10028140802}"
PLACE_ID="${2:-74561430818448}"
API_KEY="${ROBLOX_API_KEY:?Set ROBLOX_API_KEY environment variable}"

BASE="https://apis.roblox.com"
V2="$BASE/cloud/v2"

pass=0
fail=0
missing_scopes=()

check() {
  local label="$1"
  local scope="$2"
  local url="$3"
  local method="${4:-GET}"

  local http_code
  local body
  body=$(curl -s -w "\n%{http_code}" -X "$method" -H "x-api-key: $API_KEY" -H "Content-Type: application/json" "$url" 2>/dev/null)
  http_code=$(echo "$body" | tail -1)

  if [[ "$http_code" =~ ^2 ]]; then
    printf "  ✅  %-45s %s\n" "$label" "$scope"
    ((pass++))
  elif [[ "$http_code" == "401" || "$http_code" == "403" ]]; then
    printf "  ❌  %-45s %s\n" "$label" "$scope"
    missing_scopes+=("$scope")
    ((fail++))
  else
    printf "  ⚠️  %-45s %s (HTTP %s)\n" "$label" "$scope" "$http_code"
    ((pass++))  # Not a scope issue
  fi
}

echo ""
echo "Roblox Open Cloud Scope Checker"
echo "================================"
echo "Universe: $UNIVERSE_ID  |  Place: $PLACE_ID"
echo "Key prefix: ${API_KEY:0:12}..."
echo ""

# --- Universe & Place ---
echo "Universe & Place:"
check "Get universe"                "universe:read"                    "$V2/universes/$UNIVERSE_ID"
check "Get place"                   "universe.place:read"              "$V2/universes/$UNIVERSE_ID/places/$PLACE_ID"

# --- Data Stores ---
echo ""
echo "Data Stores:"
check "List data stores"            "universe-datastores.objects:list"  "$V2/universes/$UNIVERSE_ID/data-stores"
check "List ordered DS entries"     "universe.ordered-data-store.scope.entry:read" \
  "$V2/universes/$UNIVERSE_ID/ordered-data-stores/test/scopes/global/entries?maxPageSize=1&orderBy=desc"

# --- Memory Stores ---
echo ""
echo "Memory Stores:"
check "List sorted map items"       "memory-store.sorted-map:read"     "$V2/universes/$UNIVERSE_ID/memory-store/sorted-maps/test/items?orderBy=asc"
check "Read queue"                  "memory-store.queue:read"          "$V2/universes/$UNIVERSE_ID/memory-store/queues/test:read" "POST"
check "Flush memory store"          "memory-store:flush"               "$V2/universes/$UNIVERSE_ID/memory-store:flush" "POST"

# --- Monetization ---
echo ""
echo "Monetization:"
check "List developer products"     "developer-product:read"           "$BASE/developer-products/v2/universes/$UNIVERSE_ID/developer-products/creator"
check "List game passes"            "game-pass:read"                   "$BASE/game-passes/v1/universes/$UNIVERSE_ID/game-passes/creator"

# --- Creator Store ---
echo ""
echo "Creator Store:"
check "Get creator store product"   "creator-store-product:read"       "$V2/creator-store-products/test"

# --- Assets ---
echo ""
echo "Assets:"
check "Get asset"                   "asset:read"                       "$BASE/assets/v1/assets/1"

# --- Luau Execution ---
echo ""
echo "Luau Execution:"
check "Execute Luau (dry)"          "luau-execution-session:write"     "$V2/universes/$UNIVERSE_ID/places/$PLACE_ID/luau-execution-sessions" "POST"

# --- Messaging ---
echo ""
echo "Messaging:"
check "Publish message (v2)"        "universe-messaging-service:publish" "$V2/universes/$UNIVERSE_ID:publishMessage" "POST"

# --- Secrets ---
echo ""
echo "Secrets:"
check "List secrets"                "universe.secret:read"             "$V2/universes/$UNIVERSE_ID/secrets"

# --- User Restrictions ---
echo ""
echo "User Restrictions:"
check "List user restrictions"      "universe.user-restriction:read"   "$V2/universes/$UNIVERSE_ID/user-restrictions"

# --- Badges ---
echo ""
echo "Badges:"
check "List universe badges"        "legacy-badge:read"                "$BASE/legacy-badges/v1/universes/$UNIVERSE_ID/badges"
check "Get badge quota"             "legacy-badge:read"                "$BASE/legacy-badges/v1/universes/$UNIVERSE_ID/free-badges-quota"

# --- Groups ---
echo ""
echo "Groups:"
check "Get group"                   "group:read"                       "$V2/groups/1"

# --- Users ---
echo ""
echo "Users:"
check "Get user"                    "user:read"                        "$V2/users/1"

# --- Configs ---
echo ""
echo "Configs:"
check "List config revisions"       "universe-configuration:read"      "$BASE/creator-configs-public-api/v1/configs/universes/$UNIVERSE_ID/repositories"

# --- Subscriptions ---
echo ""
echo "Subscriptions:"
check "List subscriptions"          "subscription:read"                "$V2/universes/$UNIVERSE_ID/subscriptions"

# --- Summary ---
echo ""
echo "================================"
echo "Results: $pass passed, $fail failed"
if [[ ${#missing_scopes[@]} -gt 0 ]]; then
  echo ""
  echo "Missing or denied scopes:"
  for s in "${missing_scopes[@]}"; do
    echo "  - $s"
  done
  echo ""
  echo "Add these in: https://create.roblox.com/dashboard/credentials"
fi
echo ""

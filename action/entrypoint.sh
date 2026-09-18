#!/usr/bin/env bash
set -euo pipefail

: "${ORBIT_URL:?orbit-url required}"
: "${ORBIT_TOKEN:?token required}"
: "${ORBIT_PROJECT:?project required}"
: "${ORBIT_SCOPE:=production}"
: "${ORBIT_INCLUDE_SECRETS:=true}"
: "${ORBIT_EXPORT_TO_ENV:=true}"
: "${ORBIT_OUTPUT_FILE:=}"
: "${ORBIT_MASK:=true}"

base="${ORBIT_URL%/}"
url="${base}/api/projects/${ORBIT_PROJECT}/env/${ORBIT_SCOPE}/dotenv"
if [ "${ORBIT_INCLUDE_SECRETS}" = "true" ]; then
  url="${url}?include=secrets"
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

status=$(curl -sS -o "$tmp" -w '%{http_code}' \
  -H "Authorization: Bearer ${ORBIT_TOKEN}" \
  -H "Accept: text/plain" \
  "$url")

if [ "$status" != "200" ]; then
  echo "::error::Orbit fetch failed (HTTP $status)"
  cat "$tmp" >&2 || true
  exit 1
fi

count=0
while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  name="${line%%=*}"
  value_json="${line#*=}"
  # Values are JSON-encoded strings from Orbit — decode via jq.
  value=$(printf '%s' "$value_json" | jq -r '.')

  if [ "$ORBIT_MASK" = "true" ]; then
    echo "::add-mask::$value"
  fi

  if [ "$ORBIT_EXPORT_TO_ENV" = "true" ] && [ -n "${GITHUB_ENV:-}" ]; then
    {
      printf '%s<<ORBIT_EOF\n' "$name"
      printf '%s\n' "$value"
      printf 'ORBIT_EOF\n'
    } >> "$GITHUB_ENV"
  fi

  if [ -n "$ORBIT_OUTPUT_FILE" ]; then
    printf '%s=%s\n' "$name" "$value_json" >> "$ORBIT_OUTPUT_FILE"
  fi

  count=$((count + 1))
done < "$tmp"

echo "Loaded $count variables from Orbit ($ORBIT_PROJECT/$ORBIT_SCOPE)"

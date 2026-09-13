#!/usr/bin/env bash
set -e

ENTRY="127.0.0.1 orbit.local"

if grep -qF "orbit.local" /etc/hosts; then
  echo "orbit.local already in /etc/hosts"
else
  echo "$ENTRY" | sudo tee -a /etc/hosts > /dev/null
  echo "Added: $ENTRY"
fi

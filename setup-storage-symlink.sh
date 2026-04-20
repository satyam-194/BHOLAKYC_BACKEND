#!/usr/bin/env bash
# Final safety: project <backend>/storage → /var/www/storage so all path.join(__dirname, 'storage') usage
# resolves to canonical disk under /var/www (with or without IMAGE_UPLOAD_BASE in .env).
#
# Usage (as root on the server):
#   chmod +x setup-storage-symlink.sh
#   sudo ./setup-storage-symlink.sh
# Or pass backend dir:
#   sudo ./setup-storage-symlink.sh /root/BHOLAKYC_BACKEND

set -euo pipefail

BACKEND_DIR="${1:-/root/BHOLAKYC_BACKEND}"
TARGET="/var/www/storage"
LINK_PATH="${BACKEND_DIR}/storage"

mkdir -p "$TARGET"/{images,videos,pdfs,merged,indemnity_pdfs}

if [[ -e "$LINK_PATH" ]] && [[ ! -L "$LINK_PATH" ]]; then
  echo "Removing existing directory (not a symlink): $LINK_PATH"
  rm -rf "$LINK_PATH"
fi

ln -sfn "$TARGET" "$LINK_PATH"
echo "OK: $LINK_PATH -> $(readlink -f "$LINK_PATH")"
ls -la "$BACKEND_DIR" | grep storage || true

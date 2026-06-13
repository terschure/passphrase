#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd "$(dirname "$0")" && pwd -P)
repo_root=$(CDPATH= cd "$script_dir/.." && pwd -P)
host="${HOST:-127.0.0.1}"
port="${PORT:-8765}"

case "${1:-}" in
  "")
    ;;
  -h|--help)
    cat <<'USAGE'
Usage: scripts/serve-road-configurable.sh

Serves the passphrase prototype directory on http://127.0.0.1:8765 by default.

Environment:
  HOST   Bind address. Default: 127.0.0.1
  PORT   Port. Default: 8765
USAGE
    exit 0
    ;;
  *)
    printf 'Unknown argument: %s\n' "$1" >&2
    printf 'Run with --help for usage.\n' >&2
    exit 2
    ;;
esac

cat <<EOF
Serving passphrase from:
  http://$host:$port/

Open:
  http://$host:$port/road_configurable.html

Stop with Ctrl-C.
EOF

cd "$repo_root"
exec python3 -m http.server "$port" --bind "$host"

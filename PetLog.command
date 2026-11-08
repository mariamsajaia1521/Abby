#!/bin/zsh
set -euo pipefail

petlog_dir="${0:A:h}"
petlog_origin='http://127.0.0.1:4173'
petlog_url="$petlog_origin/"
cd "$petlog_dir"

petlog_ready() {
  /usr/bin/curl --fail --silent --max-time 2 "$petlog_origin/manifest.webmanifest" |
    /usr/bin/grep -q '"short_name"[[:space:]]*:[[:space:]]*"PetLog"'
}

petlog_error() {
  print -u2 -- "$1"
  if [[ -t 0 ]]; then
    read -r '?დახურვისთვის დააჭირე Enter-ს… '
  fi
  exit 1
}

petlog_node="${commands[node]:-}"
if [[ -z "$petlog_node" ]]; then
  for petlog_candidate in /usr/local/bin/node /opt/homebrew/bin/node; do
    if [[ -x "$petlog_candidate" ]]; then
      petlog_node="$petlog_candidate"
      break
    fi
  done
fi
[[ -n "$petlog_node" ]] || petlog_error 'PetLog-ის გასაშვებად საჭიროა Node.js 24 ან უფრო ახალი ვერსია.'
export OPENSSL_CONF=/dev/null
"$petlog_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' ||
  petlog_error 'განაახლე Node.js მინიმუმ 24 ვერსიამდე და ისევ გახსენი PetLog.'

petlog_needs_build=0
[[ -f dist/index.html ]] || petlog_needs_build=1
for petlog_source in src/**/*(N.) public/**/*(N.) index.html vite.config.ts package.json package-lock.json; do
  if [[ "$petlog_source" -nt dist/index.html ]]; then
    petlog_needs_build=1
    break
  fi
done
if [[ "$petlog_needs_build" == 1 ]]; then
  [[ -f node_modules/vite/bin/vite.js && -f node_modules/typescript/bin/tsc ]] ||
    petlog_error 'ჯერ პროექტის საქაღალდეში გაუშვი npm install, შემდეგ ისევ გახსენი ეს ფაილი.'
  "$petlog_node" node_modules/typescript/bin/tsc --noEmit
  "$petlog_node" node_modules/vite/bin/vite.js build
fi

if petlog_ready; then
  /usr/bin/open "$petlog_url"
  exit 0
fi

print -- 'PetLog იწყებს მუშაობას. ბრაუზერი ავტომატურად გაიხსნება.'
print -- 'აპის გამოყენებისას ეს ტერმინალის ფანჯარა ღია დატოვე.'
(
  for petlog_attempt in {1..30}; do
    if petlog_ready; then
      /usr/bin/open "$petlog_url"
      exit 0
    fi
    /bin/sleep 0.3
  done
) &
exec "$petlog_node" server.ts

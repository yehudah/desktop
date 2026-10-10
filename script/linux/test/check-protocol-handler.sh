#!/bin/bash
# Runs inside the installed-e2e image as a non-root user under a display (xvfb-run -a).
# Checks the installed package's URL-scheme handling end to end:
#  1. the installed desktop file advertises both x-scheme-handler MIME types,
#  2. a pre-existing user default handler survives (user config untouched by the package files),
#  3. `xdg-mime default` + `xdg-open <url>` cold-starts the app and the URL reaches handleAppURL,
#  4. the same URL while the app runs reaches the running instance (second-instance).
# The app's main log line 'Processing protocol url' is the evidence that the URL reached the handler.
# Usage: check-protocol-handler.sh prepare   (as the test user: create a pre-existing default handler)
#        check-protocol-handler.sh check     (as the test user, under xvfb-run -a)
# run-protocol-test.sh drives both, with a root reinstall of the .deb in between.
# The container needs --security-opt seccomp=unconfined so the app can start sandboxed (see T13).
set -u
desktop=/usr/share/applications/github-desktop.desktop
schemes="x-github-client x-github-desktop-dev-auth"
unset XDG_CONFIG_HOME XDG_DATA_HOME
export XDG_CURRENT_DESKTOP='' DE=generic
fail=0
ok() { echo "PASS: $*"; }
bad() { echo "FAIL: $*"; fail=1; }

# Count 'Processing protocol url' lines across all main-process logs under the user's data dir.
count_hits() { cat "$HOME"/.config/GitHub*/logs/*.log 2>/dev/null | grep -c 'Processing protocol url'; }
# PIDs of the app's browser (main) process: exe is the installed binary, no --type= child switch
# (argv0 varies with how the launcher exec'd it, so go by /proc/<pid>/exe).
main_pids() {
  for d in /proc/[0-9]*; do
    [ "$(readlink "$d/exe" 2>/dev/null)" = /usr/lib/github-desktop/github-desktop ] || continue
    tr '\0' ' ' <"$d/cmdline" | grep -q -- '--type=' || echo "${d#/proc/}"
  done | sort | tr '\n' ' '
}
wait_hits() { # wait_hits <expected-min> ; polls up to 40s
  for _ in $(seq 40); do
    [ "$(count_hits)" -ge "$1" ] && return 0
    sleep 1
  done
  return 1
}

if [ "${1:-check}" = prepare ]; then
  mkdir -p "$HOME/.config" "$HOME/.local/share/applications"
  # xdg-mime ignores defaults that name a desktop file which does not exist, so create one.
  printf '[Desktop Entry]\nType=Application\nName=Other client\nExec=true %%u\nMimeType=x-scheme-handler/x-github-client;\n' >"$HOME/.local/share/applications/other-client.desktop"
  printf '[Default Applications]\nx-scheme-handler/x-github-client=other-client.desktop\n' >"$HOME/.config/mimeapps.list"
  sha256sum "$HOME/.config/mimeapps.list" >"$HOME/mimeapps.sha256"
  echo "prepared pre-existing default: $(xdg-mime query default x-scheme-handler/x-github-client)"
  exit 0
fi

echo "== 1. desktop file MIME types"
for s in $schemes; do
  grep -E '^MimeType=' "$desktop" | grep -q "x-scheme-handler/$s;" && ok "$desktop advertises x-scheme-handler/$s" || bad "missing x-scheme-handler/$s"
done
grep -E '^Exec=.*%U' "$desktop" >/dev/null && ok "Exec takes %U: $(grep '^Exec=' "$desktop")" || bad "Exec has no %U"

echo "== 2. pre-existing default handler is not overridden by the package (reinstalled as root after prepare)"
for f in /etc/xdg/mimeapps.list /usr/share/applications/mimeapps.list /usr/share/applications/defaults.list; do
  if grep -qs github-desktop "$f"; then bad "$f mentions github-desktop"; else ok "$f does not set a github-desktop default"; fi
done
q=$(xdg-mime query default x-scheme-handler/x-github-client)
[ "$q" = other-client.desktop ] && ok "default for x-github-client is still $q after (re)install" || bad "default became '$q'"
(cd "$HOME" && sha256sum -c mimeapps.sha256 >/dev/null) && ok "user mimeapps.list unchanged" || bad "mimeapps.list changed"

echo "== 3. cold start via xdg-open"
for s in $schemes; do xdg-mime default github-desktop.desktop "x-scheme-handler/$s"; done
for s in $schemes; do
  q=$(xdg-mime query default "x-scheme-handler/$s")
  [ "$q" = github-desktop.desktop ] && ok "xdg-mime default for $s = $q" || bad "default for $s = '$q'"
done
pgrep -f /usr/lib/github-desktop/github-desktop >/dev/null && bad "app already running before cold start"
xdg-open 'x-github-desktop-dev-auth://oauth?code=TEST&state=TEST' >"$HOME/xdg-open-1.log" 2>&1 &
if wait_hits 1; then ok "cold start: URL reached handler"; else bad "cold start: no 'Processing protocol url' in log"; fi
sleep 5
n=$(pgrep -f '^/usr/lib/github-desktop/github-desktop' | wc -l); [ "$(count_hits)" = 1 ] && ok "cold start logged exactly one URL" || bad "cold start hit count $(count_hits)"
[ "$n" -gt 0 ] && ok "app running ($n processes)" || bad "app not running after cold start"

echo "== 4. second instance while running"
h=$(count_hits)
pids_before=$(main_pids)
timeout 30 xdg-open 'x-github-client://openRepo/https://github.com/desktop/desktop' >"$HOME/xdg-open-2.log" 2>&1; echo "second xdg-open exit=$?"
# A second instance logs the URL twice: once in the short-lived duplicate process (main.ts runs
# handleCommandLineArguments(process.argv) before quitting) and once in the running app via the
# second-instance event. The cold start above logs exactly once, so +2 means the running app got it.
if wait_hits $((h + 2)); then ok "second instance: URL reached running app's handler (+2 log lines)"; else bad "second instance: hit count stayed $h"; fi
timeout 30 xdg-open 'x-github-desktop-dev-auth://oauth?code=TEST2&state=TEST2' >/dev/null 2>&1
wait_hits $((h + 4)) && ok "second instance: dev-auth URL also handled" || bad "second dev-auth URL not handled"
pids_after=$(main_pids)
[ -n "$pids_before" ] && [ "$pids_before" = "$pids_after" ] && ok "same main process handled both URLs (pid $pids_after)" || bad "main pids before=[$pids_before] after=[$pids_after]"
echo "cold-start hits=$h total hits=$(count_hits)"

echo "== log excerpt"
grep -h -E 'Processing protocol url|protocol|second' "$HOME"/.config/GitHub*/logs/*.log 2>/dev/null | head -20
echo "== app log files"; ls -la "$HOME"/.config/GitHub*/logs/ 2>&1 | head

pkill -f /usr/lib/github-desktop/github-desktop || true
[ "$fail" = 0 ] && echo "ALL CHECKS PASSED" || { echo "SOME CHECKS FAILED"; exit 1; }

# V1 Manual Smoke Checklist

Run with one fresh terminal per device + the daemon. Tick each box that
passes; note any failures inline. Do not commit checked-off copies of
this file — it is a template.

## 0. Pre-flight

- [ ] `yarn native-debug-bridge:install` succeeds
- [ ] `yarn native-debug-bridge:doctor` shows all checks green except
      those documented as optional
      (`ios-webkit-debug-proxy`, `xctrace`, `perfetto host`,
      `insert_dylib or optool`)

## 1. iOS simulator

- [ ] `yarn app:ios` builds and launches OneKey
- [ ] `yarn dev:native-debug-bridge` starts the daemon
- [ ] `node debug/bin/odb.js session attach -p ios -d booted` returns
      a session id
- [ ] `node debug/bin/odb.js session status <SID>` shows
      `frida.connected: false` (sim doesn't have gadget; expected)
- [ ] `node debug/bin/odb.js screenshot <SID>` saves a PNG that opens
- [ ] `node debug/bin/odb.js ui-tree <SID>` returns a JSON tree with
      a `UIWindow` root
- [ ] `node debug/bin/odb.js js-eval <SID> '__DEV__'` returns
      `{value:true,type:"boolean"}`
- [ ] `node debug/bin/odb.js js-eval <SID> '__onekey_debug__'` returns
      an object with `store / queryClient / navigation` booleans
      (bootstrap worked)
- [ ] Open a screen with network activity;
      `node debug/bin/odb.js network-list <SID>` shows recent requests
- [ ] Trigger a `console.log` in OneKey;
      `node debug/bin/odb.js console-tail <SID>` shows it
- [ ] `node debug/bin/odb.js perf-metrics <SID>` returns non-null
      `cpu_pct` + `mem_rss_mb`

## 2. iOS real device (with frida-gadget injected)

- [ ] `./debug/scripts/inject-gadget-ios.sh` against a Debug-built
      `.app` succeeds
- [ ] `xcrun devicectl device install app …` installs the patched
      `.app`
- [ ] OneKey launches on device
- [ ] `node debug/bin/odb.js session attach -p ios -d <UDID>` succeeds
- [ ] `node debug/bin/odb.js session status <SID>` shows
      `frida.connected: true`
- [ ] `node debug/bin/odb.js native-call <SID> '-[UIApplication sharedApplication]'`
      returns a non-empty string
- [ ] `node debug/bin/odb.js native-hook <SID> '-[RCTView layoutSubviews]'`
      returns a `hookId`
- [ ] Trigger UI; `node debug/bin/odb.js native-events <SID>` shows
      enter / leave events

## 3. Android emulator / real debuggable device

- [ ] `yarn app:android` launches OneKey
- [ ] `node debug/bin/odb.js session attach -p android -d $(adb get-serialno)`
      succeeds
- [ ] `session status` shows Frida connected (emulator) or fails
      gracefully (non-root real device)
- [ ] `node debug/bin/odb.js screenshot <SID>`,
      `ui-tree <SID>`, `js-eval <SID> '__DEV__'` all work
- [ ] `node debug/bin/odb.js perf-metrics <SID>` returns non-null
      `thread_count` + `cpu_pct` + `mem_rss_mb`

## 4. WebView (DApp browser open)

- [ ] Open the DApp browser in OneKey on iOS sim, navigate to any DApp
- [ ] `brew install ios-webkit-debug-proxy` (one-time)
- [ ] `node debug/bin/odb.js webview-list <SID>` returns at least one
      target
- [ ] `node debug/bin/odb.js webview-eval <SID> <TARGET_ID> 'location.href'`
      returns the page URL
- [ ] `node debug/bin/odb.js webview-dom-query <SID> <TARGET_ID> 'body'`
      returns `outerHTML`

## 5. Record / replay

- [ ] `node debug/bin/odb.js record-start <SID> --layers js,network,ui`
      returns a `recordId` + `path`
- [ ] Interact with OneKey for 10–20 seconds
- [ ] `node debug/bin/odb.js record-stop <SID>` returns
      `eventCount > 0`
- [ ] `node debug/bin/odb.js timeline <PATH> --t 5000` returns events
      around the 5s mark
- [ ] `node debug/bin/odb.js replay <PATH> --target <NEW_SID> --layers js`
      re-executes JS evals on a fresh session

## 6. MCP integration (Claude Code)

- [ ] Add the `~/.claude.json` `mcpServers` stanza
      (`debug/README.md` has the exact JSON)
- [ ] Restart Claude Code
- [ ] In Claude Code, ask:
      "Attach to my running OneKey on iOS sim, take a screenshot,
      then dump the first 3 children of the ui tree."
      Verify Claude calls `session.attach` → `screenshot` → `ui.tree`
      end-to-end.

## Known gotchas

- The Frida CLI on `PATH` is **not** required; the Node `frida`
  package provides everything via the agent.
- `xctrace` traces are large; they live under
  `~/.onekey-debug/traces/`.
- `record.*` writes to `~/.onekey-debug/records/<recordId>.odb/`;
  clean periodically.
- The scrubber redacts mnemonics + private keys in returns. Disable in
  dev with `ODB_SCRUB=0` env var when starting the daemon.

# @onekey/native-debug-bridge

AI-accessible debug bridge for OneKey iOS / Android. Gives Claude, Codex,
and any MCP-aware agent a unified, CDP-like surface — `screenshot`,
`ui.tree`, `js.eval`, WebView CDP, Frida native hooks, performance metrics,
record / replay — no Xcode, no Android Studio, no GUI required.

## Status (V2)

### Shipped

- Daemon over Unix socket (JSON-RPC 2.0), idempotent start, back-pressure
- Sessions (multi-device aware) with adapter health (CDP / Frida / Native)
  — Frida device picked by `deviceId` so two concurrent sessions never
  cross-attach
- **JS layer**: `js.eval`, `js.console.tail`, `js.network.list`, `js.network.body`
- **WebView**: `webview.list`, `webview.eval`, `webview.dom.query`
  (iOS via `ios-webkit-debug-proxy` on a per-session free port, Android
  via `adb forward` to `chrome://inspect`-style CDP endpoints)
- **Native UI**: `ui.tree` (Android `uiautomator` + iOS sim `lldb`
  `recursiveDescription`), `screenshot`
- **Native injection (Frida)**: `native.call`, `native.hook`,
  `native.unhook`, `native.listHooks`, `native.events`, `native.script.run`
- **Performance**: `perf.metrics`, `perf.fps.tail`, `perf.memory.classes`
  (iOS via Frida ObjC enum; Android via `dumpsys meminfo`),
  `perf.trace.start`, `perf.trace.stop` — emits Chrome-trace JSON via real
  `xctrace export` → schema conversion (viewable in `ui.perfetto.dev`)
- **Record / replay**: `record.start`, `record.stop`, `record.status`,
  `replay`, `timeline`, `replay.token` — multi-layer `.odb` directories
  with **zstd**-compressed event streams (via Node 22 `node:zlib`), live
  `replay --apply --layers native` gated by a deterministic confirm-token
- **Safety**: secret scrubber middleware (mnemonics, hex keys, xpub/xprv,
  sensitive key names), opt out via `ODB_SCRUB=0`; destructive replay
  requires `replay.token` round-trip
- **Bootstrap**: `__onekey_debug__` exposed inside Hermes at session attach
  (`store`, `queryClient`, `navigation`, `version`)
- **iOS real device**: `scripts/inject-gadget-ios.sh` for Debug-signed apps
- **30 MCP tools**, **113 tests + 1 skipped**, full typecheck clean

### Deferred (V3+)

- `class_getInstanceSize` binding for accurate iOS `perf.memory.classes`
  byte counts (currently a 200B/instance heuristic)
- Streaming multi-frame zstd (currently one frame at finalize — see
  `src/record/codec.ts` for the rationale)
- Live `replay --layers network` (currently dry-run; replay would
  re-issue requests which is rarely useful for debugging)
- Cross-session video capture / synchronization

## Install

From the monorepo root:

```bash
yarn native-debug-bridge:install   # installs deps inside debug/
```

Requirements: Node ≥ 22, macOS host, Xcode + Command Line Tools (iOS),
`android-platform-tools` (Android). Optional host tools — `xctrace`
(ships with Xcode), `perfetto` / `traceconv`, `ios-webkit-debug-proxy`,
`insert_dylib` or `optool`.

## Pre-flight

```bash
yarn native-debug-bridge:doctor
```

The doctor runs **11 checks**. Expected output (the last three are
optional — they only matter for traces / WebView / real-iOS Frida and
do not block core tools):

```
  ✓ adb
  ✓ xcrun simctl
  ✓ lldb
  ✓ ios-webkit-debug-proxy        (optional, iOS WebView)
  ✓ Hermes :8081  (N target(s))
  ✓ iOS sim booted
  ✓ adb devices  (N device(s))
  ✓ frida (Node package)
  ✓ xctrace                       (optional, iOS perf traces)
  ✓ perfetto host                 (optional, host-side trace conversion)
  ✓ insert_dylib or optool        (optional, real-iOS Frida gadget)
```

If something fails, the `fix:` line tells you how.

## Quick start

```bash
# Terminal A — OneKey dev build
yarn app:ios          # or app:android

# Terminal B — daemon
yarn dev:native-debug-bridge

# Terminal C — try tools (cd debug)
node bin/odb.js daemon status
SID=$(node bin/odb.js session attach -p ios -d booted | jq -r .sessionId)
node bin/odb.js session status   $SID
node bin/odb.js screenshot       $SID
node bin/odb.js ui-tree          $SID | jq '.class'
node bin/odb.js js-eval          $SID '__DEV__'
node bin/odb.js js-eval          $SID '__onekey_debug__'
node bin/odb.js console-tail     $SID
node bin/odb.js network-list     $SID
node bin/odb.js perf-metrics     $SID

# record a 20s session, then inspect
REC=$(node bin/odb.js record-start $SID --layers js,network,ui | jq -r .path)
sleep 20
node bin/odb.js record-stop  $SID
node bin/odb.js timeline     "$REC" --t 5000
```

The CLI sub-commands mirror the daemon's JSON-RPC method names (with
dot → dash so they're shell-friendly: `js.eval` → `js-eval`).

## MCP integration (Claude Code / Codex)

The MCP server is a thin stdio proxy over the daemon's JSON-RPC. **29
tools** are exposed end-to-end — every JSON-RPC method on the daemon
has a matching MCP tool with the same name:

| Group | Tools |
|---|---|
| Session | `session.attach`, `session.list`, `session.detach`, `session.status` |
| Native UI | `screenshot`, `ui.tree` |
| JS / Hermes | `js.eval`, `js.console.tail`, `js.network.list`, `js.network.body` |
| WebView | `webview.list`, `webview.eval`, `webview.dom.query` |
| Native (Frida) | `native.call`, `native.hook`, `native.unhook`, `native.listHooks`, `native.events`, `native.script.run` |
| Performance | `perf.metrics`, `perf.fps.tail`, `perf.memory.classes`, `perf.trace.start`, `perf.trace.stop` |
| Record / replay | `record.start`, `record.stop`, `record.status`, `replay`, `timeline` |

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "onekey-debug": {
      "command": "node",
      "args": [
        "/absolute/path/to/app-monorepo/.worktrees/native-debug-bridge/debug/bin/odb-mcp.js"
      ]
    }
  }
}
```

Restart Claude Code. The daemon must already be running
(`yarn dev:native-debug-bridge`) — the MCP server is just a proxy and
will surface RPC errors verbatim if the daemon isn't reachable.

For Codex: equivalent stanza in `~/.codex/config.toml` (same CLI/MCP
shape). Each tool result is returned as a single JSON-encoded text
block; Claude's tool-use parser handles it directly.

## Architecture

See `docs/plans/2026-05-19-native-debug-bridge-design.md` for the full
design and `docs/plans/2026-05-19-native-debug-bridge-v1.md` for the V1
batch plan (status: shipped). The "Status (V1)" section above is the
authoritative list of what the V1 surface delivers.

```
┌─────────────────────────────┐
│ Claude Code / Codex / human │
└─────────────────────────────┘
         ↓ MCP stdio      ↓ CLI
┌──────────────────────────────────────────┐
│ odbd daemon (Node + TS, Unix socket)     │
│   Dispatcher → Registry → Tools          │
│     scrubber middleware                  │
│   Adapters: CDP (Hermes + WebView),      │
│             Frida (Node agent),          │
│             Native (lldb / adb / xcrun)  │
│   Recorder writes .odb directories       │
└──────────────────────────────────────────┘
         ↓ adb / xcrun / lldb / CDP / Frida
┌──────────────────────────────────────────┐
│ iOS sim · iOS device (with gadget)       │
│ Android emu / debuggable real device     │
└──────────────────────────────────────────┘
```

## Testing

```bash
cd debug
yarn test                  # 19 files, 92 tests
yarn typecheck             # tsc --noEmit
```

The CDP test (`tests/cdp.test.ts`) runs against live Hermes when Metro
is up on `:8081`; otherwise it skips. All other tests are hermetic.

## Real-iOS Frida setup

To attach Frida to OneKey on a non-jailbroken iOS device, inject
`FridaGadget.dylib` into the Debug-signed `.app` once per build. See
[`docs/ios-gadget-setup.md`](./docs/ios-gadget-setup.md) for the script
+ install flow. The `scripts/inject-gadget-ios.sh` helper does the
patch in one line and re-signs with your dev cert.

The Frida CLI is **not** required on `PATH` — the Node `frida` package
ships everything the daemon needs.

## .odb traces

Recorded sessions live under `~/.onekey-debug/records/<recordId>.odb/`.
Each layer (`js`, `network`, `native`, `ui`) is a JSONL file plus a
`manifest.json`. See [`docs/odb-format.md`](./docs/odb-format.md) for
the schema. Clean the directory periodically; `replay` and `timeline`
both read from arbitrary `.odb` paths so you can move them.

Set `ODB_SCRUB=0` when starting the daemon to disable secret scrubbing
in development (default: scrubbing on; mnemonics and hex private keys
are redacted from every tool return).

## License

Internal to OneKey monorepo.

# @onekey/native-debug-bridge

AI-accessible debug bridge for OneKey iOS / Android. Gives Claude, Codex,
and any MCP-aware agent a unified, CDP-like surface — `screenshot`, `ui.tree`,
`js.eval`, and more — over the same Hermes/JS/native fabric Electron CDP exposes
for the web. No Xcode, no Android Studio, no GUI required.

## Status (MVP)

- Daemon over Unix socket, JSON-RPC 2.0
- Session model (multi-device aware)
- `screenshot` (iOS sim + Android)
- `ui.tree` (Android uiautomator + iOS sim lldb)
- `js.eval` (Hermes via CDP)
- MCP server exposing all of the above
- CLI for human-driven debugging
- `doctor` pre-flight

Deferred to V1 (see `docs/plans/2026-05-19-native-debug-bridge-design.md` §3 / §9):
WebView attach, Frida native hooks, real-iOS gadget pipeline, perf trace, record/replay.

## Install

From the monorepo root:

```bash
yarn native-debug-bridge:install   # installs deps inside debug/
```

## Pre-flight

```bash
yarn native-debug-bridge:doctor
```

Expected output (all check marks before tools work):

```
  ✓ adb
  ✓ xcrun simctl
  ✓ lldb
  ✓ Hermes :8081  (2 target(s))
  ✓ iOS sim booted
  ✓ adb devices  (1 device(s))
  ✓ frida (Node package)
```

If something fails, the `fix:` line tells you how.

## Run

```bash
# Terminal A — OneKey dev build
yarn app:ios          # or app:android

# Terminal B — daemon
yarn dev:native-debug-bridge

# Terminal C — try tools
cd debug
node bin/odb.js daemon status
node bin/odb.js session attach -p ios -d booted
node bin/odb.js screenshot S-xxxxxxxx
node bin/odb.js ui-tree   S-xxxxxxxx | jq '.class'
node bin/odb.js js-eval   S-xxxxxxxx '__DEV__'
```

## MCP integration (Claude Code / Codex)

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

Restart Claude Code. The `session.attach`, `screenshot`, `ui.tree`, and `js.eval`
tools will be available to the model. The daemon must already be running
(`yarn dev:native-debug-bridge`) — the MCP server is just a thin proxy.

For Codex: equivalent stanza in `~/.codex/config.toml` (the CLI/MCP shape is the same).

## Real-iOS Frida setup

To attach Frida to OneKey on a non-jailbroken iOS device, you need to inject
`FridaGadget.dylib` into the Debug-signed `.app` once per build. See
[`docs/ios-gadget-setup.md`](./docs/ios-gadget-setup.md) for the one-line
script + install flow.

## Architecture

See `docs/plans/2026-05-19-native-debug-bridge-design.md` for the full design.
See `docs/plans/2026-05-19-native-debug-bridge-mvp.md` for the MVP plan and
implementation breakdown.

```
┌─────────────────────────────┐
│ Claude Code / Codex / human │
└─────────────────────────────┘
        ↓ MCP stdio      ↓ CLI
┌─────────────────────────────────────┐
│ odbd daemon (Node + TS, Unix socket)│
│   Dispatcher → Registry → Tools     │
│   ├── screenshot                    │
│   ├── ui.tree   (uiautomator/lldb)  │
│   └── js.eval   (CDP / Hermes)      │
└─────────────────────────────────────┘
        ↓ adb / xcrun / lldb / CDP
┌─────────────────────────────────────┐
│ iOS sim · Android emu/device        │
└─────────────────────────────────────┘
```

## Testing

```bash
cd debug
yarn test                  # vitest
yarn typecheck             # tsc --noEmit
```

The CDP test runs against live Hermes when Metro is up on `:8081`; otherwise it skips.

## License

Internal to OneKey monorepo.

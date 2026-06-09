# React Native UI verification via agent-device

`agent-device` (callstack, MIT) is a device-automation CLI built for AI agents. It gives a compact
accessibility snapshot plus the **React Native component tree** with interactive refs (`@e1`, `@e3`),
and can tap/type/scroll/screenshot/capture logs across iOS, Android, tvOS, and desktop. We use it for
OneKey's **iOS / Android** RN builds.

Repo: https://github.com/callstack/agent-device

## Contents
- Install
- MCP wiring (preferred for agents)
- Launch the OneKey dev build
- Core commands
- testID anchoring in OneKey
- Pitfalls

## Install

It is an external CLI — not in this monorepo. Install globally (do **not** add it to the monorepo
`package.json`; it's a dev-machine tool, like the OneKey skills CLI):

```bash
npm i -g agent-device         # or: npx agent-device <cmd>
agent-device --version
agent-device doctor           # check Xcode/simulator + adb prerequisites
```

Backends: iOS uses XCTest (needs Xcode + a booted simulator or a provisioned device); Android uses
ADB (needs a running emulator or `adb`-visible device). No special instrumentation build required.

## MCP wiring (preferred)

Register agent-device's MCP server so the agent calls inspect/tap/snapshot directly instead of
shelling out. Add to the project MCP config (e.g. `.mcp.json` / Claude Code MCP settings):

```jsonc
{
  "mcpServers": {
    "agent-device": { "command": "agent-device", "args": ["mcp"] }
  }
}
```

Then reference tools fully-qualified, e.g. `agent-device:snapshot`, `agent-device:tap`. Confirm the
exact `mcp` subcommand and tool names against the installed version (`agent-device mcp --help`).

## Launch the OneKey dev build

Bring up the RN app first, then attach:

```bash
yarn app:ios        # boots simulator + Metro
# or
yarn app:android    # emulator + Metro
```

Then:

```bash
agent-device open --platform ios     # attach to the running app on the booted device
```

If multiple simulators/emulators are booted, pass the device explicitly (`--device <udid/name>` —
check `agent-device open --help`), otherwise it may attach to the wrong one.

## Core commands

```bash
agent-device snapshot                 # a11y tree + RN component tree, returns refs @e1, @e2, ...
agent-device tap @e7                  # tap an element by ref
agent-device fill @e3 "0.5"           # type into an input
agent-device scroll --direction down  # scroll the focused scrollable
agent-device screenshot --out .tmp/ui/rn.png
agent-device logs                     # device/app logs for evidence
agent-device close
```

`snapshot` is the key step for agents: read it, find the element you need by its label/testID/RN
component name, then act on its `@e` ref. Record reproducible flows as `.ad` scripts for re-runs.

## testID anchoring in OneKey

OneKey components expose `testID`. Prefer matching the snapshot entry by `testID` over visible text
(text is i18n-translated and unstable). If the target element lacks a `testID`, add one to the
component first (`grep -rn 'testID' packages/kit/src/views/<area>`), reload the RN bundle, then
re-snapshot.

## Pitfalls

- **Pre-1.0 (v0.17.x)**: API and flag names churn. Always confirm subcommands with `--help` rather
  than trusting cached syntax.
- **Wrong device**: be explicit about `--platform`/`--device` when several are booted.
- **Metro not ready**: `open` before Metro has served the bundle attaches to a white screen — wait
  for the app to finish loading, or snapshot until the home testID appears.
- **Desktop (Electron) is NOT this path**: agent-device's desktop backend targets native macOS/Linux
  apps; for OneKey desktop use CDP 9222 instead ([electron-cdp.md](electron-cdp.md)).
- **Scope**: covers iOS/Android only here; web/extension use Playwright against the dev URL.

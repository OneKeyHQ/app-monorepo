# React Native UI verification via agent-device

`agent-device` (callstack, MIT) is a device-automation CLI built for AI agents. It can
click/type/scroll/screenshot/capture-logs and reload Metro across iOS, Android, tvOS, and desktop.
We use it for OneKey's **iOS / Android** RN builds — and it works: a full multi-step OneKey iOS flow
was driven end-to-end to verify a real fix (2026-06-09).

**testID works on iOS** — `click 'id="my-testid"'`, `is visible 'id="..."'`, and
`get attrs 'id="..."'` all resolve a OneKey `testID` to its native element (returns the real frame,
`hittable`, etc.), even though `snapshot` shows a near-empty tree. Prefer testID over coordinates.
The one real gotcha is the **dev perf-overlay window** stealing taps over its HUD box — see "iOS
reality" below. On Android, `snapshot` additionally returns a full RN component tree with refs
(`@e1`, `@e3`).

Repo: https://github.com/callstack/agent-device

## Contents
- Install
- MCP wiring (preferred for agents)
- Launch the OneKey dev build
- Core commands
- testID anchoring in OneKey
- iOS reality: testID works; the dev perf-overlay steals taps; snapshot is sparse
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
agent-device click 'id="home-more-button"'   # click by testID — works on iOS AND Android
agent-device is visible 'id="..."'            # assert a testID is on screen (resolves on iOS)
agent-device get attrs 'id="..."'             # element frame {x,y,w,h} + hittable/enabled — handy
agent-device click 28 150                     # click by LOGICAL-POINT coordinate (fallback)
agent-device fill 'id="..."' "0.5"            # type into an input (testID / selector / x y)
agent-device scroll down                      # scroll in a direction
agent-device screenshot --out .tmp/ui/rn.png
agent-device metro reload                     # reload the JS bundle after editing src / node_modules
agent-device open so.onekey.wallet            # (re)launch the app by bundle id
agent-device logs clear|start|stop            # manage app logs for evidence
agent-device snapshot                         # a11y + RN component tree w/ refs @e1,@e2 (Android)
```

Selector syntax is `key=value`, e.g. `id="my-testid"` (quote it for the shell). There is **no `tap`
subcommand** — it's `click` (also `press` / `longpress`). Always confirm names with `--help`; this
CLI is pre-1.0 and churns.

## testID anchoring in OneKey

OneKey components expose `testID`, and it resolves on **both** platforms — prefer it over visible
text (text is i18n-translated and unstable) and over raw coordinates (fragile). Anchor with
`id="<testID>"`: `click 'id="home-more-button"'`, `is visible 'id="..."'`, `get attrs 'id="..."'`.
On iOS this works even though `snapshot` looks empty (the resolver queries native
`accessibilityIdentifier` directly). If the target lacks a `testID`, add one
(`grep -rn 'testID' packages/kit/src/views/<area>`), reload the bundle, then retry. The only thing
that can defeat a testID *tap* is the dev perf overlay — see next.

## iOS reality: testID works; the dev perf-overlay steals taps; snapshot is sparse

Verified 2026-06-09 (iPhone 16/17 Pro-class sim, agent-device 0.17.x) by driving a full 3-step
modal flow end-to-end to confirm a real RN fix. The accurate picture:

- **testID resolves and clicks on iOS.** `click 'id="home-more-button"'` opened its menu;
  `is visible 'id="AccountSelectorTriggerBase"'` returned Passed; `get attrs 'id="..."'` returned
  the real frame (`{x,y,w,h}`, `hittable:true`). The resolver hits `accessibilityIdentifier`.
- **The dev perf-overlay HUD (CPU/RAM/fps) is a full-screen window** (`get attrs @e2` → rect
  `{x:0,y:0,w:402,h:874}`, `hittable:true`) that **swallows taps over its visible box** (top-left /
  upper-center). `click 'id=...'` taps the element's *center*; if that center sits under the HUD the
  tap is eaten — the CLI still prints "Tapped" but the screenshot is unchanged. This is the trap that
  masquerades as "testID doesn't work" (it bit us on the account-selector trigger).
  - **Best fix (dev global):** `globalThis.$onekeyPerfMonitor.hide()` removes the overlay instantly
    (`.show()` / `.toggle()` too). Registered in dev by `Bootstrap.tsx`; calls the native
    perf-stats `hideOverlay()`. Call it over the RN Hermes CDP (see below) before driving. Verified
    end-to-end on iOS.
  - **Alt:** turn the overlay OFF in 开发者模式 / dev settings, or `get attrs 'id="..."'` for the rect
    and `click <x> <y>` on a part clear of the HUD (e.g. left/bottom edge).
- **`snapshot` is sparse on iOS** (~14 nodes: the overlay window + one opaque image) because that
  overlay dominates the a11y tree. Don't read "no testIDs exist" from it — `is visible`/`get attrs`/
  `click` with `id="..."` still resolve elements absent from the dump.
- **`screenshot` + reading the PNG is the truth.** Render Errors/redboxes, modals, sheets, and toasts
  are all visible and diff-able. Dismiss a redbox by clicking "Dismiss"; a yellow LogBox warning
  toast (vs a red Render Error) confirms a `throw` was downgraded to a `console.warn`.

### Proven workflow: edit code → verify on iOS

```bash
# 1. Edit the source. For a patch-package fix, edit node_modules directly — RN bundles a package
#    from its `src/` ("react-native" field), so the src edit is what Metro picks up.
# 2. Reload the JS bundle so the edit takes effect:
agent-device logs clear
agent-device metro reload
# 3. WAIT ~10-13s and confirm a stable screen BEFORE driving. Tapping while the bundle is still
#    reloading lands on the springboard or backgrounds the app.
agent-device screenshot --out .tmp/ui/home.png        # confirm home rendered
# 4. Drive by testID, screenshotting after each step. If a click prints "Tapped" but nothing
#    changed, the perf overlay ate it — disable the overlay, or get attrs + click a clear coordinate.
agent-device click 'id="home-more-button"'
agent-device screenshot --out .tmp/ui/step1.png
# 5. The fix is confirmed by what the screenshot shows (e.g. the page renders instead of a redbox).
```

Coordinate fallback: `click <x> <y>` uses **logical points** — convert from a screenshot with
`logical = pixel / devicePixelRatio` (a 1206x2622 px shot on a @3x device gives 402x874 logical, so
divide by 3). The overlay's presence does **not** mean the build is stale: JS edits via
`metro reload` take effect (we changed `node_modules` and saw the result), so runtime JS == source.

### Eval JS on the running RN app (Hermes CDP)

agent-device can't eval JS, but a dev RN build exposes a Hermes CDP target via the Metro inspector —
so you CAN run arbitrary JS (call a global, read state, flip a flag) on the live app. Gotchas that
make it look broken: pick the target with `reactNative: true`, and send `Runtime.evaluate` **without**
`Runtime.enable` first (the Fusebox proxy stalls on `enable`).

```js
// node, needs `ws`. List targets: curl -s http://localhost:8081/json/list
import WebSocket from 'ws';
const url = /* the reactNative:true target's webSocketDebuggerUrl from /json/list */;
const ws = new WebSocket(url); let id = 1; const pending = new Map();
ws.on('message', d => { const j = JSON.parse(d); pending.get(j.id)?.(j); pending.delete(j.id); });
const send = (m, p={}) => new Promise(r => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({id:i, method:m, params:p})); });
ws.on('open', async () => {
  const r = await send('Runtime.evaluate', { expression: 'globalThis.$onekeyPerfMonitor.hide()', returnByValue: true });
  console.log(r.result); ws.close();
});
```

This is how we verified `$onekeyPerfMonitor.hide()/show()/toggle()` live (overlay gone, then back).
Combined with agent-device `screenshot`, it's a full driveable+inspectable loop on iOS.

## Pitfalls

- **Pre-1.0 (v0.17.x)**: API and flag names churn. Always confirm subcommands with `--help` rather
  than trusting cached syntax. Notably it's `click`, not `tap`.
- **iOS snapshot is sparse, but testID still resolves**: don't conclude "no testIDs" from an empty
  `snapshot` — `click`/`is visible`/`get attrs` with `id="..."` work on iOS. `@e` refs need the full
  tree, so those are Android-only.
- **Perf overlay steals center-taps**: if a testID `click` prints "Tapped" but the screenshot is
  unchanged, the dev CPU/RAM/fps HUD (full-screen window) ate it. Disable the overlay, or
  `get attrs` + `click` a clear coordinate (see "iOS reality").
- **"Session already active"**: `open --platform ios` errors if a session is already attached. Reuse
  the existing session (just `screenshot`/`click`), `close` first, or pass a new `--session <name>`.
- **`metro reload` then immediately tapping**: the taps race the reload and hit the springboard /
  background the app. Wait ~10-13s and screenshot to confirm a stable screen first.
- **Wrong device**: be explicit about `--platform`/`--device` when several are booted.
- **Metro not ready**: `open` before Metro has served the bundle attaches to a white/blank screen —
  wait for the app to finish loading (screenshot until home renders).
- **Desktop (Electron) is NOT this path**: agent-device's desktop backend targets native macOS/Linux
  apps; for OneKey desktop use CDP 9222 instead ([electron-cdp.md](electron-cdp.md)).
- **Scope**: covers iOS/Android only here; web/extension use Playwright against the dev URL.

---
name: 1k-ui-verify
description: AI-agent-driven UI verification for OneKey. Use to actually drive the running app and confirm a visual/interactive change works — Electron desktop via Chrome DevTools Protocol (CDP) on port 9222 with playwright-core, and React Native (iOS/Android) via callstack agent-device. Triggers on "verify the UI", "drive the app", "screenshot the change", "check it on desktop/simulator", "CDP 9222", "agent-device", "UI 验证", "跑一下看看", "截图确认".
---

# UI Verification (Desktop CDP + RN agent-device)

Drive the *running* OneKey app to confirm a UI change instead of guessing from code.
Pick the backend by the platform under test — never assume one tool covers all.

## Decision: which backend?

| Platform under test | Backend | Why |
|---|---|---|
| Desktop (Electron) | **CDP 9222 + playwright-core** | Renderer is Chromium; already enabled in dev. See [electron-cdp.md](references/rules/electron-cdp.md) |
| iOS / Android (native RN) | **agent-device** | Real simulator/emulator/device, RN component tree. See [agent-device-rn.md](references/rules/agent-device-rn.md) |
| Web / Extension | Out of scope here | Use plain Playwright/Puppeteer against the dev URL |

`playwright-core` (^1.50.0) is already a root dependency — no install needed for desktop.
agent-device is an external CLI/MCP — see its rule file for setup.

## Workflow

```
- [ ] 1. Confirm platform + expected vs actual (ask the user if a visual bug — per CLAUDE.md)
- [ ] 2. Launch the app for that platform (desktop: yarn app:desktop; RN: build/run the dev app)
- [ ] 3. Connect the backend (CDP connectOverCDP / agent-device open)
- [ ] 4. Navigate to the target screen, capture a BEFORE screenshot if comparing
- [ ] 5. Reproduce the interaction, capture AFTER screenshot + console/logs
- [ ] 6. Report with the screenshot as evidence — do not claim "fixed" without it
```

Always anchor to **`testID`** props, never brittle text/CSS selectors. Add a `testID` to the
component first if one is missing (search `grep -rn 'testID' packages/kit/src/views/<area>`).

## Desktop quick recipe (CDP 9222)

Prereq: `yarn app:desktop` running — its `dev:main` launches Electron with
`--remote-debugging-port=9222 --remote-debugging-address=127.0.0.1`.

```bash
node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --out .tmp/ui/after.png
node .claude/skills/1k-ui-verify/scripts/cdp-shot.mjs --testid header-gift-action --click --out .tmp/ui/clicked.png
```

The script connects to the main window (the page with `[data-testid^="tab-modal"]`), captures a
screenshot, optionally clicks a `testID`, and prints any console errors. Full pattern, console
capture, and pitfalls (DevTools closed, finding the right window): [electron-cdp.md](references/rules/electron-cdp.md).

## RN quick recipe (agent-device)

```bash
agent-device open --platform ios              # boot/attach simulator + app
agent-device metro reload                      # after editing src/node_modules; wait ~10-13s
agent-device click 'id="home-more-button"'     # click by testID — works on iOS AND Android
agent-device fill 'id="amount-input"' "0.5"    # type by testID
agent-device screenshot --out .tmp/ui/rn.png   # read the PNG — it's the source of truth
```

testID works on iOS (`click`/`is visible`/`get attrs` with `id="..."`) even though `snapshot` looks
empty. Gotcha: the dev CPU/RAM/fps perf-overlay is a full-screen window that **swallows taps over
its HUD box** — if a `click` prints "Tapped" but nothing changes, disable the overlay or `get attrs`
+ `click <x y>` on a clear spot. Command is `click`, not `tap`. Full details, the proven
edit→reload→verify workflow, and pitfalls: [agent-device-rn.md](references/rules/agent-device-rn.md).

Prefer the **MCP** integration so the agent calls these directly.

## Regression scenario series

Reproducible freeze/regression scenarios live in one root runner: `scenarios/regression.mjs`.
Each scenario declares a backend (`cdp` for desktop/web, `agent-device` for RN) and the `cdp`
backend is parameterized by port, so web reuses it (no slow per-run Playwright launch — connect
over CDP to an already-running Chrome).

```bash
node scenarios/regression.mjs list
node scenarios/regression.mjs gift-storm-desktop              # CDP 9222 (yarn app:desktop)
node scenarios/regression.mjs gift-storm-web                  # CDP 9223 (Chrome --remote-debugging-port=9223 on app:web)
node scenarios/regression.mjs gift-storm-rn --platform ios    # agent-device
REGRESSION=1 node scenarios/regression.mjs gift-storm-desktop # exit 1 if reproduced (CI gate)
```

The `gift-storm-rn` scenario's selectors (tab labels, testIDs) are mirrored from desktop and
marked VERIFY — confirm against `agent-device snapshot --json` on a live device before relying on it.

## Related Skills

- `/verify` — generic "run the app and confirm a change" harness (this skill is the OneKey-specific how)
- `/run` — launch/screenshot the app
- `/1k-dev-commands` — `yarn app:desktop` / `yarn app:ios` / `yarn app:android`
- `/1k-cross-platform` — platform-specific behavior to verify separately

# OK-60951 App verification and design differences

This is a Draft App-side delivery. Native ActivityKit surfaces were tested with synthetic local orders, without transactions or production push delivery. Server integration remains `awaitingServer` until the proposed contract is implemented and acknowledged.

## Reproduce

Use a development iOS build, unlock the App, and open Developer Settings → BTC Swap Live Activity. The normal OS URL `onekey-wallet://swap_activity?mockPanel=1` opens the same development-only panel. Start success/refund scenarios, change states manually or use automatic ten-second steps, return Home for Compact, long-press the island for Expanded, and lock the simulator for the lock-screen surface. iOS selects when Minimal is shown. Clearing mock cards affects synthetic activities only. Replay same broadcast and Complete last order exercise suppression after system dismissal.

## Verified

- Six focused Jest suites: **67/67 passed**, covering BTC eligibility, status mapping, stable identity across replacement deposits, immutable ETA, push DTO, subscription races/cleanup, native failure/disabled behavior, shell invalidation, original demo, pending-history persistence and polling recovery.
- Commit-profile checks: lint, formatting, architecture/context, background contract, test integrity, patches, native storage and TypeScript passed before feature commit.
- `yarn app:ios` built the native App and Widget extension and reached a matching running DevSession on iPhone 17 / iOS 26.5. The remote shell locator returned HTTP404; the launcher reported its fallback notice and built the native shell locally. Vendor and WebEmbed used local cache. This was not a clean remote-cache hit.
- `yarn app:desktop` reached boot success. No additional Desktop notification implementation was added.
- Native Compact ring/result, Expanded pending/Done/refunding/refunded, lock-screen cards, long ticker truncation, Almost done without invented completion, and card-to-exact-mock-order navigation were inspected in saved screenshots/recording frames.
- After a system lock-screen swipe removed an activity, replaying the same broadcast and then terminal completion both kept native card count at zero.
- The final build's caption and full terminal bar clipping fixes were inspected separately from earlier transition recordings.
- Independent read-only code and native visual reviews completed. The final review found and fixed a polling regression: terminal persistence failure now retries from the last persisted state; refund expiry cleanup is restricted to pre-existing iOS refund tracking.

## Figma comparison

Source: [formal node 26563:99086](https://www.figma.com/design/S2GLhYwpGWI9Z5BFXvbPgX/?node-id=26563-99086), retrieved through the live local Figma MCP on 2026-10-22. Original exported SVGs supply token icons, wordmark, arrows and status/ring paths.

| Element | Source | Result |
|---|---|---|
| Tokens / wordmark | 46pt tokens; 56×16.2715 wordmark | Lock-screen uses source sizes; Compact22 with BTC in front; Expanded40 to fit the system region |
| Text | SF Pro Semibold24 tickers; Bold12 ETA; Regular12 steps | Source typography/colors; 14pt step layout bounds prevent WidgetKit glyph clipping |
| Compact / Minimal | Compact22 status arc; Minimal30 orange arc and BTC18 | Exact exported shapes; Compact runtime inspected; Minimal runtime remains unverified |
| Progress | 10pt capsule; green #3EDC2F / red #D21E24 | Pending caps95%; refund stops at first stop time; terminal fills100%; full round ends verified |
| Expanded | Formal pending/refund374×182, gaps12/6 | System160pt adaptation, gaps8/4 and bottom room; **not an exact outer-geometry match** |
| Tap | Figma tap toggles ETA/ring | User-approved system tap opens order; long press expands |
| Motion | Continuous ring/arrows | Exact static arc and state-change transition; **continuous motion is not implemented/proven** under WidgetKit rendering limits |

## Remaining verification / integration

- Two synthetic activities were created successfully, but this simulator selected Compact rather than displaying Minimal. Minimal code and assets compile; a native Minimal screenshot is still required on an OS-selected multi-app surface.
- Exact one-second presentation timing, minute updates after suspension, app termination/cold-unlock routing, physical-device alerts, APNs/JPush delivery and iPhone-to-Mac mirroring have not been certified. Server-driven updates are required for dependable suspended/terminated behavior.
- Physical signing, token rotation, production subscription authorization, effective APNs environment, invalid-token cleanup, eight-hour expiry and full retention timing require server/device integration. No production readiness or complete Figma pixel/motion parity is claimed.
- Current App minimum iOS deployment version remains16.4; this change does not lower it to the older Jira16.1 request.

See [the server contract](btc-swap-live-activity.md) for field semantics, existing identity/auth context, proposed APIs, frozen refund progress, push payloads and remaining owner decisions. Raw screenshots/videos and the complete requirement-by-requirement evidence index are handed off locally with the Draft PR.

# Validation Recipes

Static checks are necessary but not enough for user-visible transaction state. Validate the surface that owns the regression.

## Desktop / Electron

Use for normal Swap, Market Detail, provider list, review dialog, and token selector.

- Confirm the real OneKey UI is loaded, not the default Electron shell.
- Inspect the relevant network calls and visible UI state.
- Useful filters: `/swap/v1/quote`, `/swap/v1/quote/events`, `/swap/v1/build-tx`, `/swap/v1/tokens`, `flag=token-selector`, `/utility/v2/market/basic-config`, analytics endpoints.

## iOS / Mobile

Use for keyboard, safe area, mobile restart, dialog animation, tab switch, and visual layout.

- Match the Jira/QA device when specified.
- Check keyboard open/close, modal transitions, safe area, restart/refresh, and repeated open/close.
- If Simulator or Metro is not running, state that and ask for the app/logs/screenshots needed for runtime proof.

## Token Selector

Validate Home, Send/Receive, normal Swap, and Swap Pro separately.

- Toggle filters while requests are in flight and verify disabled/loading state.
- Switch account/network and confirm no stale list is shown.
- Refresh/restart and open selector directly.
- Confirm the expected request uses the right flag and request key.

## Market Preset

Validate Market Detail selector, normal Swap/Swap Pro visibility, review fee/slippage display, build/estimate/send payload, Reset/Confirm, blank input, invalid input, and unsupported network states.

Do not treat `$0.00` as proof of zero estimate without inspecting the payload.

## Quote / Provider

- Test first actionable quote under slow/throttled network when possible.
- Confirm manual provider selection survives later events.
- Confirm execution quote and displayed quote list agree.
- Verify no-route/provider-error copy.

## History / Pending

- History modal refreshes on open.
- Long-pending warning thresholds and analytics dedup are correct.
- Limit order and Swap history counts agree.
- Terminal status cleanup is correct.
- EVM/non-EVM tx id comparison is chain-aware.

## Minimum Command Checks

- `git diff --check`
- `npx oxlint --tsconfig ./tsconfig.json --type-aware <files>`
- Targeted Jest for changed utilities/tests
- `yarn lint:staged` and `yarn tsc:staged` before commit unless the user explicitly asks not to commit or only wants read-only analysis


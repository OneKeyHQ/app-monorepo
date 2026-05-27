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

## Account / Network Compatibility

- Reproduce account support bugs from the exact Jira path: select the same cross-chain pair, switch the same wallet/account type, return to Swap, and reverse direction if listed.
- Test software/private-key, HD, and hardware-backed accounts separately when the issue mentions account support.
- Inspect quote/build params for FROM/TO addresses, account ids, network ids, and derive type after account switch, modal close/reopen, tab focus, and All Networks selection.
- Do not accept the unsupported-account banner as proof until the resolved target-network account and outgoing request params match the selected tokens.

## Market Preset

Validate Market Detail selector, normal Swap/Swap Pro visibility, review fee/slippage display, build/estimate/send payload, Reset/Confirm, blank input, invalid input, and unsupported network states.

Do not treat `$0.00` as proof of zero estimate without inspecting the payload.

When route gas limits are provided by quote/preset data, inspect estimate-fee and send-time params to confirm route `gasLimitForDisplay` or the chain equivalent wins over generic estimate defaults.

## Quote / Provider

- Test first actionable quote under slow/throttled network when possible.
- Confirm manual provider selection survives later events.
- Confirm execution quote and displayed quote list agree.
- Verify no-route/provider-error copy.

## Cross-Surface Entry

- From DeFi/Earn or portfolio funding CTAs, open `Trade`, `Buy`, `Swap`, and
  `Wrap` paths from a fresh app state when the issue started outside Swap.
- Confirm the target route carries the intended token direction, `swapSource`,
  `ESwapTabSwitchType`, account, network, and native/wrapped token identity.
- For ETH/WETH cases, test native ETH, WETH, insufficient-balance, unsupported
  Limit, and explicit wrap/unwrap paths separately.
- Inspect quote/build requests after the jump. Source-screen validation is not
  proof that the target surface will execute the same token form.

## Private Send / Incognito

- Toggle Public/Private mode and verify settings persistence, recipient input visibility, and account/network/token invalidation.
- Confirm quote/build requests carry the intended `incognito` param and provider fields.
- Validate recipient input loading and stale validation result handling after hide/show, clear/retype, and account/network change.
- For analytics tasks, capture both success and failure paths for quote, value-drop warning dedupe, create order, and final status.
- For RocketX, confirm ETA, min/max units, received-token identity, and final status from provider/backend payloads before logging or displaying them.

## History / Pending

- After a successful send, verify the local pending history item exists before considering the send path complete.
- Confirm `/swap/v1/state-tx` polling uses the correct chain tx id or provider order id for that provider.
- Confirm the send action cannot be repeated while local tracking is missing or being created.
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

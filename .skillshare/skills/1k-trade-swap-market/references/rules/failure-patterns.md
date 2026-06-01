# Failure Patterns

Use this as the repeat-risk checklist before implementation, review, or release validation.

## Market Preset

- UI state changes but review/build/send still use old fee or slippage.
- Unsupported networks show preset UI because config readiness is not gated.
- Blank custom fee is treated as zero instead of "blank, confirm disabled".
- Reset and Confirm use different flush/save paths.
- Nearby Swap behavior overrides Jira's exact boundary text.

Check config source, saved selection, UI state, review controlled option, estimate params, and execution params. Missing estimate and real zero estimate are different states.

## Quote And Provider Progress

- First actionable quote is blocked by providers still streaming.
- Display quote list and execution quote use different provider keys.
- Manual provider selection is overwritten by a later event.
- Auto slippage or quote tips apply to a stale event.
- Provider error messages disappear when no route is actionable.

Check event id/current-event scoping, execution quote ownership, manual provider lock, and slow/throttled quote behavior.

## Token Selector, LP, And DeFi Filter

- Home DeFi token state is reused for Send/Receive or Swap selector.
- Filter UI changes but selector request key/cache does not.
- Shared switch loading behavior is copied across surfaces without checking the owner. Home and Send/Receive may intentionally disable while their list is loading; Swap may need the switch to stay interactive while only the token-list request refreshes.
- Refresh/restart enters an empty selector because `flag=token-selector` was never fetched.
- Swap token list is assumed to match wallet token list.

Check Home, Send/Receive, normal Swap, and Swap Pro independently. Verify request key, cache owner, loading state, account switch, network switch, refresh/restart, and modal reopen.

## Account, Network, And Address Compatibility

- "Connected account does not support swap" is caused by stale account/network resolution after switching wallet/account type, not by a real provider support result.
- Cross-chain FROM/TO tokens, account selector slots, selected network, global derive type, and resolved target-network account are invalidated on different schedules.
- Reversing swap direction or returning from a modal reuses an address or network from the previous token pair.
- All Networks mode resolves a target-network account, but the quote/build path still reads the old active account network.

Check `useSwapFromAccountNetworkSync`, `useSwapAddressInfo`, account selector `num: 0/1`, `accountForTargetNetwork`, selected token network, global derive type, and the outgoing quote/build addresses before changing the alert copy or provider logic.

## Review, Fee, Balance, And Toast

- Review reads outer page atoms instead of a frozen quote/build snapshot.
- Market preset or quote route `gasLimitForDisplay` is treated as a fallback behind generic estimate-fee defaults, so displayed priority-fee fiat cost can drift from the real route.
- Same-native-token gas, sell amount, and other fees are not aggregated.
- Duplicate toasts stack because repeated validation lacks a stable `toastId`.
- `$0.00` display hides the difference between missing provider fee and real zero.
- Review value-drop depends on stale outer page rate state.

Build review state from quote/build snapshots. Inspect quote/build payloads before labeling fees as zero.

## Limit And Swap Pro Price

- Tiny rate values are formatted too early and lose precision.
- Stored market price belongs to a previous token pair.
- Reverse price toggle changes display but not quote request state.
- Swap <-> Swap Pro tab transitions carry stale or unsupported tokens.

Keep internal numeric state separate from display formatting. Verify token-pair identity before reusing stored prices.

## Cross-Surface Entry And Native/Wrapped Tokens

- DeFi/Earn, Market, or portfolio CTAs reuse Trade/Swap button copy but pass the wrong execution mode, token direction, or source.
- Native ETH and WETH are treated as interchangeable after a surface handoff, so Limit tries to sell native ETH or Swap tries to wrap without an explicit wrap path.
- Unsupported-token warnings are hidden because the source surface already showed an insufficient-balance or "Buy/Trade" state.
- The source screen validates wallet balance for one token form while the target screen validates another token form.
- `swapSource`, `ESwapTabSwitchType`, token direction, and native/wrapped identity are not frozen when jumping into the Swap modal or tab.

For Earn funding CTAs, test the target surface, not only the source button. If Limit cannot sell native ETH, show an explicit wrap or unsupported-token path instead of silently switching semantics.

## History, Pending, And Status

- Send success updates the UI but does not persist a local pending history item, so later status polling cannot attach and duplicate send risk remains.
- Terminal status stops polling too early or clears local pending history before refresh signals.
- `rawStatus` and `finalStatus` are conflated.
- History modal opens with stale pending orders.
- EVM tx hash comparison is applied to non-EVM tx ids.
- Limit order and Swap history counts drift.

Preserve raw provider status where UI or refresh logic needs it. Use chain-aware tx id comparison. Treat pending-history creation as part of the send-success safety gate: compare `/swap/v1/build-tx`, provider order id, chain tx id, `/swap/v1/state-tx` params, and the SimpleDB history item before deciding whether the backend or local tracking is missing.

## Provider-Specific Execution

- Provider field units are guessed on the frontend.
- BTC/UTXO plans are lost during signed rebuild.
- Refund address and receiving address are conflated.
- Private Send/incognito mode changes quote/build params but analytics, recipient validation, value-drop warning dedupe, and final-status mapping are not updated together.
- Provider status mapping is treated as generic Swap status.
- Provider min/max limits are compared against the wrong unit.

Confirm the contract with backend/service code, Jira, or Slack before changing display, validation, analytics, or history behavior.

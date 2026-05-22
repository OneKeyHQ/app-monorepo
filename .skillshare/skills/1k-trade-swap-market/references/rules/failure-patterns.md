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
- Switch remains interactive while filtered request is in flight.
- Refresh/restart enters an empty selector because `flag=token-selector` was never fetched.
- Swap token list is assumed to match wallet token list.

Check Home, Send/Receive, normal Swap, and Swap Pro independently. Verify request key, cache owner, loading state, account switch, network switch, refresh/restart, and modal reopen.

## Review, Fee, Balance, And Toast

- Review reads outer page atoms instead of a frozen quote/build snapshot.
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

## History, Pending, And Status

- Terminal status stops polling too early or clears local pending history before refresh signals.
- `rawStatus` and `finalStatus` are conflated.
- History modal opens with stale pending orders.
- EVM tx hash comparison is applied to non-EVM tx ids.
- Limit order and Swap history counts drift.

Preserve raw provider status where UI or refresh logic needs it. Use chain-aware tx id comparison.

## Provider-Specific Execution

- Provider field units are guessed on the frontend.
- BTC/UTXO plans are lost during signed rebuild.
- Refund address and receiving address are conflated.
- Provider status mapping is treated as generic Swap status.
- Provider min/max limits are compared against the wrong unit.

Confirm the contract with backend/service code, Jira, or Slack before changing display, validation, analytics, or history behavior.


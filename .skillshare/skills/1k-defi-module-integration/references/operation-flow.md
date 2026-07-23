# Earn / DeFi Operation Contracts

## Define Before Editing

| Area            | Required decisions                                                                            |
| --------------- | --------------------------------------------------------------------------------------------- |
| Identity        | account, network, provider, position/category, token/symbol, vault/market/reserve, action     |
| Amount          | input/output token, decimals, raw vs display units, native/wrapped semantics, max/bps, limits |
| Setup           | approval, permit, wrap, cooldown, quote, risk acknowledgement, or none                        |
| Business action | transaction, provider order, contract call, or cross-module handoff                           |
| Status          | txid, order id, provider id, pending label, terminal mapping, unknown state                   |
| Refresh         | exact account/network position, detail, market/reserve, portfolio, and history owners         |

Do not copy a neighboring operation merely because the UI looks similar. Its
provider, amount units, account type, or status contract may differ.

## Execution Sequence

1. Load current position, action capability, account, and token data.
2. Validate identity, amount, limits, and risk state.
3. Complete approval/permit/wrap or other setup when required.
4. Build and confirm the business action.
5. Broadcast or submit, preserving tx/order identity.
6. Settle status and release submit protection on success, failure, or cancel.
7. Refresh the smallest affected scope and reconcile pending/history.

A provider-managed step still needs a visible loading, unavailable, pending,
failed, success, or unknown state. Do not collapse missing and zero values.

## Order And Error Semantics

When the service returns an order identifier, preserve it through broadcast
and settlement; do not replace it with a tx hash. A visible confirmation layer
may protect against duplicate submission, but every terminal callback must
leave the action usable again.

Report user-actionable failures once at the operation boundary while retaining
diagnostic context. A suppressed lower-level toast must not become an unhandled
rejection or remove operation-level feedback.

## Request And Refresh Safety

Guard asynchronous results with the identity that can change: account,
network, provider, position, token, action, route visibility, and request id.
After a successful position change, refresh the exact owner. Cancel or failure
must not claim a successful refresh. Delays, quotas, and other policy values
must come from current code/config rather than this skill.

## Swap Handoff

DeFi owns source context, risk, prefill, and return refresh. Once Swap starts a
quote, Swap owns review, build, send, pending, and Swap history.

# Provider And Channel Contracts

Use this file before implementing or reviewing a new Swap provider, PrivateSend-like channel, stock/order channel, or Market speed-swap extension.

## Contract Template

Define these fields in writing before UI work:

| Area | Questions |
| --- | --- |
| Capability | Is this swap, bridge, limit, privacy/order, stock/order, funding handoff, or data-only? |
| Asset universe | Are assets tokens, native tokens, wrapped tokens, stock-like assets, or provider-owned synthetic assets? |
| Account roles | Which account signs, which account receives, which address is hidden, and which address settles? |
| Quote identity | What identifies a quote across provider, amount, token, network, and request lifecycle? |
| Amount units | Which fields are base units, parsed units, fiat values, rates, or display strings? |
| Limits | What do min/max fields mean, and are they per token, per route, per provider, or per trading session? |
| Fees | Which fees are network gas, provider fee, protocol fee, service fee, stock commission, or settlement fee? |
| Time | Does ETA mean chain confirmation, provider processing time, trading session state, or order expiry? |
| Build response | Does build return unsigned tx, setup tx, business tx, order payload, or provider-managed action? |
| History identity | Is status keyed by txid, order id, route id, provider id, or a composite key? |
| Channel state | Which listener, local row, replay source, and repair rule own the lifecycle after submit? |

## Quote Result Fields

For every quote field used in UI, decide:

- source of truth: quote payload, build payload, cached provider metadata, or local formatting only
- missing value meaning: unavailable, unknown, zero, hidden, unsupported, or provider error
- display owner: quote list, review, history, or detail page
- invalidation rule: amount, network, token, account, receiver, provider, slippage, or market session change

Never normalize a missing provider field into a display value without preserving whether it was unknown.

## Build Response Variants

Model build responses as one of these variants:

- `normalTx`: one transaction to sign/send.
- `setupThenBusinessTx`: approval, permit, wrap, or setup before the business transaction.
- `providerOrder`: order payload where status comes from provider polling.
- `privacyOrder`: provider-managed flow with special receiver/progress display.
- `stockOrder`: non-token order with session availability, settlement currency, and broker/provider status.
- `dataOnly`: no transaction; do not wire to history/status.

If a new response shape does not fit, add a typed adapter rather than branching throughout UI components.

## Address Roles

Keep these roles distinct:

- signing account address
- source token owner
- target account address
- receiver address
- privacy receiver
- provider settlement address
- order venue account

PrivateSend-like channels often hide or delay receiver display. Stock-like
channels may not have a token receiver at all. Review and history must still
explain what the user is confirming.

## Status Mapping

Map status in two layers:

1. Provider raw status: provider-specific and preserved for diagnostics.
2. App status: pending, processing, success, failed, canceled, expired, partially filled, or unknown.

Order-backed channels must define terminal states before polling is trusted. A pending row without a final-state plan is incomplete.

## Local And Replay Contract

For any channel that can outlive the original submit screen, define:

- which fields are frozen from review into local history
- which fields come only from build/send response
- which fields can be repaired from order detail or account history
- whether status should prefer order detail, normal status polling, or a composite
- which fields are semantic display fields and must not be overwritten by chain
  settlement fields

Missing values must retain their meaning. For example, unknown fee/rate/ETA is
not the same as zero, and unknown finality is not the same as success.

## Provider Examples As Patterns

- Privacy/order channels show why receiver semantics, progress steps, and price fallback belong in the contract.
- Market speed-swap shows why market detail payload and execution payload should be separate.
- Limit/order flows show why order id and txid are not interchangeable.
- Bridge flows show why visible entry consolidation must still preserve
  cross-chain history and status semantics.
- Future stock-trading channels should reuse the order-channel model, not the
  token-swap model, unless the provider contract proves it is a normal swap.

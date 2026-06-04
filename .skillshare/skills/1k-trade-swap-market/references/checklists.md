# Checklists

## Durable Bug-Prevention Checklist

Run this before shipping or approving Trade/Swap/Market work:

1. State owner is named: server config, quote payload, build payload, atom, simpleDb, local component state, or provider adapter.
2. Async identity is guarded: request id, event id, provider key, token key, account, amount mode, and stale response handling.
3. Account/network/token identity is separated: source, target, All Networks, derive type, native/wrapped token, receiver.
4. Provider contract fields are interpreted: fees, rate, ETA, min/max, limits, quote context, order id, txid, and status.
5. Review data is frozen: confirm does not keep reading mutable page state after the user enters review.
6. Approval/setup is explicit: allowance, permit, wrap, setup tx, and business tx are not merged invisibly.
7. Pending history is created after send success with the correct identity before status polling is trusted.
8. Market/K-line data is isolated from quote/build state.
9. Platform ownership is checked: desktop, web, extension, native mobile, tablet, modal, and bottom-sheet differences.
10. Adjacent Wallet/Receive token-list ownership is not assumed to match Swap/Market selector ownership.
11. Import hierarchy is preserved.

## New Channel Readiness Checklist

Use this for PrivateSend-like, stock/order, or unusual provider channels:

1. Entry surface is defined: Swap page, Market detail, Send handoff, Earn handoff, or dedicated modal.
2. Capability is defined: token swap, order, privacy order, stock order, bridge, funding, or data-only.
3. Asset model is defined: token, native, wrapped, stock-like, provider synthetic, or route-only.
4. Quote identity is stable across provider, amount, token, account, receiver, session, and request id.
5. Review explains what the user signs or submits, including hidden receiver or non-token settlement semantics.
6. Build response variant is typed and routed through one adapter.
7. Post-send identity chooses txid, order id, route id, or composite key deliberately.
8. History row, detail page, and status polling use the same identity.
9. Error states include provider unavailable, unsupported route, expired quote, market closed, partial fill, and unknown finality when applicable.
10. Validation covers both happy path and one provider/channel failure.

## PrivateSend-Like Drill

Complete this drill before saying the skill can guide a privacy/order channel:

- Which surface enters the channel, and does it reuse Swap selection or a Send handoff?
- Which receiver/address fields are visible, hidden, delayed, or provider-owned?
- Which quote fields are frozen in review, and which progress fields appear only after send?
- Which id drives pending history: txid, order id, route id, or composite key?
- Which status steps are shown in detail, and which are terminal?
- How does the detail page fetch or preserve token price when normal swap data is unavailable?
- What runtime payload proves the order has been created?

## Stock/Order Channel Drill

Complete this drill before wiring a stock-like protocol:

- Is the asset model token-like, stock-like, or provider synthetic?
- What account signs, and what account or venue settles?
- What happens when the market is closed, partially filled, canceled, or expired?
- Which fields are commission, spread, settlement fee, or network gas?
- Does review need risk, market-hours, or delayed-settlement copy?
- Does history display order lifecycle rather than on-chain confirmation?
- Can token selectors, quote result rows, and history rows handle non-token identity without leaking token assumptions?

## Market And K-Line Checklist

- Token detail enrichment, chart data, fallback chart data, and speed-swap execution payload are separate.
- Chart fallback cannot mutate quote state.
- Token selector live overrides cannot create a stale quote.
- WebView bridge events are scoped to the active chart/token.
- Desktop and native layout constraints are validated separately.

## Review Checklist

- Lead with confirmed behavior risk, not broad process notes.
- For each issue, name the state owner and failing transition.
- Distinguish code blockers from validation gaps.
- Propose the smallest App-side change that preserves the canonical flow.

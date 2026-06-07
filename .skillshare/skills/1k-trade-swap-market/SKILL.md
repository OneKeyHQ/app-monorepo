---
name: 1k-trade-swap-market
description: App-side OneKey Trade/Swap/Market guide for Swap core, Swap Pro, Market speed-swap, K-line/chart, token selectors, quote/build/send flows, history/status, provider channels, PrivateSend-like channels, stock-trading channels, limit/order flows, fees, slippage, ETA, and cross-module funding handoffs.
---

# Trade, Swap, Market

Use this skill when App code touches Trade, Swap, Market swap panels, provider/channel integrations, order-style execution, K-line data, transaction history, or funding handoffs into Swap.

This is an App development skill. Use current repository code, runtime payloads, and visible App behavior as evidence. Do not bake external workflow details into the skill.

## Core Model

The canonical Swap path is:

`selection/account -> quote -> review snapshot -> build/sign/send -> pending history/status`

Treat Swap as the execution spine below visible surfaces. Market speed-swap,
Bridge, Limit, PrivateSend-like flows, stock/order channels, and funding
handoffs can adapt entry, asset, and settlement semantics, but they must still
declare quote, review, execution, history, status, and repair ownership.

## Protocol Channel Model

Before adding or reviewing any provider channel, define this contract:

1. Capability: swap, bridge, limit, privacy/order channel, stock order, funding handoff, or data-only chart.
2. Asset universe: token, native token, wrapped token, stock-like asset, route-only target, or provider-owned synthetic asset.
3. Account roles: source account, target account, receiver, settlement account, and whether address privacy changes the display.
4. Quote contract: amount units, quote identity, provider key, min/max, slippage, fee, ETA, and stale-response guard.
5. Review snapshot: fields frozen for confirm, risk text, fee/rate display, allowance/approval, and receiver semantics.
6. Build/send contract: build payload, unsigned tx or order payload, approval/setup tx, send method, and retry behavior.
7. History/status: pending item, order id vs txid, progress labels, final status mapping, detail-page fallback data.
8. Channel state: listener source, local writeback owner, replay/enrichment source, and correction strategy for stale or incomplete rows.

PrivateSend-like channels and future stock-trading channels should be evaluated with this same contract before UI work starts.

## Default Workflow

1. Classify the surface: Swap, Swap Pro, Market speed-swap, K-line/chart, token selector, review/confirm, history, or new provider channel.
2. Classify the integration style: standard swap provider, order-backed privacy channel, stock/order channel, limit order, or cross-module funding handoff.
3. Read [app-architecture.md](references/app-architecture.md) and [code-map.md](references/code-map.md) before editing.
4. Fill the provider/channel contract in [provider-contracts.md](references/provider-contracts.md).
5. For any non-standard channel, fill [channel-state-model.md](references/channel-state-model.md) before touching history, status polling, or local replay.
6. Run the durable checklist in [checklists.md](references/checklists.md),
   especially async identity, token/account identity, frozen review data, and
   history/status.
7. Validate with [validation.md](references/validation.md), including a readiness drill when the change is a new channel.

## Reference Map

| Need | Reference |
| --- | --- |
| Understand the App flow and extension seams | [app-architecture.md](references/app-architecture.md) |
| Find stable code anchors | [code-map.md](references/code-map.md) |
| Define provider/channel fields | [provider-contracts.md](references/provider-contracts.md) |
| Define channel listening, writeback, replay, and repair | [channel-state-model.md](references/channel-state-model.md) |
| Prevent known failure classes | [checklists.md](references/checklists.md) |
| Prove the change works | [validation.md](references/validation.md) |

## Readiness Drills

Use these drills to judge whether the skill is complete enough for a new requirement:

- PrivateSend-like channel: can you identify entry surface, receiver/address
  semantics, quote identity, order id, review snapshot, progress steps, pending
  row, history detail, and status polling without adding ad hoc rules?
- Stock-trading channel: can you model non-token asset identity, market hours
  or unavailable states, settlement currency, order status, review/risk
  display, and history rows through the same provider/channel contract?
- Bridge/Limit channel merge: can you preserve channel semantics,
  default-token rules, status source, analytics/history identity, and
  pending-row filters while sharing Swap infrastructure?
- Funding handoff: can an Earn/Market/Buy entry land in Swap with the correct network, account, token, amount, preset, and reset behavior?

If a drill cannot be completed from the references, update the abstraction instead of adding another one-off case.

## Hard Stops

- Do not treat missing fee, ETA, rate, or limit fields as zero until the quote/build payload proves that meaning.
- Do not treat a local pending history item as the only source of truth for an
  order-backed channel; define replay/enrichment and repair sources before
  shipping.
- Do not let page atoms drift into review/confirm; confirm must use a frozen quote/build snapshot.
- Do not reuse token-list state from another surface as proof for Swap selection.
- Do not treat Wallet/Receive DeFi-token list regressions as Swap selector bugs unless the failing owner is the Swap/Market selector or handoff state.
- Do not collapse account, network, provider, token, and receiver resets into one path without checking dependents.
- Do not mark transaction behavior validated from static diff alone; inspect the actual App path, payload, pending row, or visible state.
- Do not edit generated locale files directly; use the repository i18n workflow.

## Related Skills

- `/1k-coding-patterns` for TypeScript and React patterns.
- `/1k-state-management` for Jotai state ownership.
- `/1k-cross-platform` for desktop, web, extension, and native differences.
- `/1k-i18n` for translation work.

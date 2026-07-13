---
name: 1k-trade-swap-market
description: App-side OneKey Trade/Swap/Market guide for Swap core, Swap Pro, Wallet Home and Home Token entries, Send/Earn/Market/Buy handoffs, native/mobile host differences, K-line/chart, token selectors, cold-start frame-by-frame validation, quote/build/send flows, history/status, provider channels, PrivateSend-like channels, stock-trading channels, limit/order flows, fees, slippage, ETA, and cross-module funding handoffs.
---

# Trade, Swap, Market

Use this skill when App code touches Trade, Swap, Market swap panels, provider/channel integrations, order-style execution, K-line data, transaction history, token selection, cold-start rendering, or funding handoffs into Swap.

This is an App development skill. Use current repository code, runtime payloads, and visible App behavior as evidence. Do not bake external workflow details into the skill.

## Core Model

The canonical Swap path is:

`selection/account -> quote -> review snapshot -> build/sign/send -> pending history/status`

Treat Swap as the execution spine below visible surfaces. Market speed-swap,
Bridge, Limit, PrivateSend-like flows, stock/order channels, and funding
handoffs can adapt entry, asset, and settlement semantics, but they must still
declare quote, review, execution, history, status, and repair ownership.

When a visible entry is merged into another surface, keep visible tab state
separate from internal execution and channel type. For example, Bridge can
render under the `Swap & Bridge` tab while `BRIDGE` still owns cross-chain
defaults, support checks, history labels, status, analytics, and provider
semantics.

For broad Swap or Trade bugs, analyze in this order before changing code:

1. Framework: entry surface, route/modal host, provider/context boundary, and
   source/target ownership.
2. State machine: tab type, route params, selected-token atoms, cold-start
   cache, quote progress, review snapshot, build/send, history/status, and
   replay/repair transitions.
3. Hooks: business hooks, component hooks, listeners, side effects, and derived
   data owners.

This order applies to Swap page work and to Home Token, Send, Market, Earn, or
Buy entries that launch or prefill Swap.

## Evidence-Driven Intake

When a Trade/Swap/Market task comes from Jira, Slack, a review thread, or a
local todo ledger, treat the title as a routing clue only. Before changing code,
verify the current source-of-truth packet:

- Jira issue text, latest comments, priority/status, and attachments when an
  issue key exists.
- Slack thread or DM context when it contains late corrections, screenshots,
  videos, QA notes, or owner decisions.
- Current client branch and the closest existing implementation in this repo.
- Server branch/ref/commit when provider fields, stock/order status, fees,
  quote/build semantics, or history DTOs are part of the behavior.

If source evidence conflicts, stop and name the conflict before picking a fix
shape.

## Autonomous Implementation Contract

For a sufficiently clear feature or bug request, recover discoverable context,
fill the capability packet, implement, test, and validate without waiting for a
human to map the repository. Read
[autonomous-feature-workflow.md](references/autonomous-feature-workflow.md)
before editing and use [feature-packet.md](templates/feature-packet.md) as the
working artifact.

Run the readiness check first:

```bash
node .skillshare/skills/1k-trade-swap-market/scripts/check-readiness.mjs
```

The check intentionally fails when reviewed domain anchors drift. Refresh the
code map and reviewed ref from current source before continuing; do not bypass
the failure. Use [runtime-boundaries.md](references/runtime-boundaries.md) for
every cross-runtime, persistence, cold-start, background, or restart path and
[test-map.md](references/test-map.md) for exact validation lanes.

Autonomy does not authorize inventing product behavior, resolving conflicting
authoritative sources silently, using unavailable secrets, making irreversible
external writes, or claiming runtime proof from static checks.

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
3. Map framework, state machine, and hooks before editing when the change spans
   route, modal, Home Token, Send, Market, Earn, Buy, or shared Swap state.
4. Identify the closest valid repo pattern before inventing a new hook, atom,
   adapter, modal, or channel abstraction. Reuse the shell only when account,
   network, token, provider, route, and execution semantics match.
5. Run the readiness script, fill the feature packet, and state `main`, `bg`,
   native/web resource, JS-copy, and initialization ownership.
6. Read [app-architecture.md](references/app-architecture.md) and [code-map.md](references/code-map.md) before editing.
7. Fill the provider/channel contract in [provider-contracts.md](references/provider-contracts.md).
8. For any non-standard channel, fill [channel-state-model.md](references/channel-state-model.md) before touching history, status polling, or local replay.
9. Run the durable checklist in [checklists.md](references/checklists.md),
   especially async identity, token/account identity, frozen review data, and
   history/status.
10. Run the exact tests in [test-map.md](references/test-map.md) and validate
    with [validation.md](references/validation.md), including a readiness drill
    when the change is a new channel.
11. For cold start, token selector flicker, default-token bring-in, tab stability,
   or Wallet handoff regressions, run
   [swap-cold-start-frame-checklist.md](references/swap-cold-start-frame-checklist.md).

## Reference Map

| Need | Reference |
| --- | --- |
| Understand the App flow and extension seams | [app-architecture.md](references/app-architecture.md) |
| Execute a feature end to end | [autonomous-feature-workflow.md](references/autonomous-feature-workflow.md) |
| Fill the implementation capability packet | [feature-packet.md](templates/feature-packet.md) |
| Find stable code anchors | [code-map.md](references/code-map.md) |
| Reason about main/bg/persistence/init timing | [runtime-boundaries.md](references/runtime-boundaries.md) |
| Define provider/channel fields | [provider-contracts.md](references/provider-contracts.md) |
| Define channel listening, writeback, replay, and repair | [channel-state-model.md](references/channel-state-model.md) |
| Prevent known failure classes | [checklists.md](references/checklists.md) |
| Prove the change works | [validation.md](references/validation.md) |
| Run exact focused test lanes | [test-map.md](references/test-map.md) |
| Validate Swap cold-start frames, default tokens, tab stability, and Wallet handoffs | [swap-cold-start-frame-checklist.md](references/swap-cold-start-frame-checklist.md) |

## Readiness Drills

Use these drills to judge whether the skill is complete enough for a new requirement:

- PrivateSend-like channel: can you identify entry surface, receiver/address
  semantics, quote identity, order id, review snapshot, progress steps, pending
  row, history detail, and status polling without adding ad hoc rules?
- Stock-trading channel: can you model non-token asset identity, market hours
  or unavailable states, settlement currency, order status, review/risk
  display, and history rows through the same provider/channel contract?
- Bridge/Limit visible-entry merge: can you preserve visible tab
  normalization, channel semantics, default-token rules, status source,
  analytics/history identity, and pending-row filters while sharing Swap
  infrastructure?
- Funding handoff: can an Earn/Market/Buy entry land in Swap with the correct network, account, token, amount, preset, and reset behavior?
- Entry ownership: can you tell whether the bug belongs to Wallet/Home
  handoff params, Swap route initialization, channel-specific state such as
  Stock, native/mobile host behavior, or the quote/review/build spine?

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
- Do not use the visible tab atom as proof of execution type after entry
  consolidation; trace route params, support-check type, quote/review
  execution type, cache context, and history/status separately.
- Do not mark transaction behavior validated from static diff alone; inspect the actual App path, payload, pending row, or visible state.
- Do not validate cold-start or flicker fixes from the final settled screenshot only; inspect the first frames and tab/token transitions.
- Do not edit generated locale files directly; use the repository i18n workflow.
- Do not create a new abstraction, hook, or state owner until the closest
  existing repo pattern and its semantic mismatch have been named.
- Do not continue from a failing readiness drift check. Reconcile current code,
  actual PR scope, anchors, tests, and the reviewed ref first.
- Do not ask the user to supply Jira, Slack, Git, client, or accessible server
  context that current tools can retrieve.
- Do not leave route/provider/listener/quote/history side effects inside one
  oversized render hook. Split stateful business logic by stable responsibility:
  data loading, selection/route sync, quote/review state machine,
  listener/history bridge, and view model.

## Related Skills

- `/1k-coding-patterns` for TypeScript and React patterns.
- `/1k-state-management` for Jotai state ownership.
- `/1k-cross-platform` for desktop, web, extension, and native differences.
- `/1k-i18n` for translation work.

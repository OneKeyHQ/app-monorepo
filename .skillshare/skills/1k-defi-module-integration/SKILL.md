---
name: 1k-defi-module-integration
description: App-side OneKey DeFi guide for Earn, native Discovery-hosted Earn, Borrow, Staking, DeFi Portfolio actions, vaults, lending, protocol integrations, ABI-backed operations, native/provider-backed operations, pending transactions, history, route handoffs, risk display, and DeFi regression review.
---

# DeFi Module Integration

Use this skill when App code touches Earn, Borrow, Staking, vault/lending/yield protocols, operation modals, pending/history, or protocol-specific DeFi flows.

This is an App development skill. It should guide implementation and review from current repository code and App behavior, not from external workflow details.

## Core Model

The canonical DeFi App path is:

`host/route -> home -> list/detail -> operation modal -> transaction sequence -> pending refresh -> history -> cross-surface handoff`

Most requirements are not "add a protocol" only. They are route, data, operation, pending, and platform integration requirements.

For DeFi portfolio one-click actions such as withdraw, claim, claimWithdrawal, or removeLiquidity, read [portfolio-actions-guide.md](references/portfolio-actions-guide.md) before changing action visibility, build-transaction payloads, or post-action refresh.

## Evidence-Driven Intake

When an Earn/DeFi task comes from Jira, Slack, a review thread, or a local todo
ledger, treat the title as a routing clue only. Before changing code, verify the
current source-of-truth packet:

- Jira issue text, latest comments, priority/status, and attachments when an
  issue key exists.
- Slack thread or DM context when it contains late corrections, screenshots,
  videos, QA notes, or owner decisions.
- Current client branch and the closest existing Earn/Borrow/Staking/DeFi flow
  in this repo.
- Server branch/ref/commit when supported-protocols, build-transaction,
  portfolio position, status, or DTO semantics are part of the behavior.

If source evidence conflicts, stop and name the conflict before picking a fix
shape. Use `1k-earn-bugfix` only as historical risk input; this skill remains
the App implementation owner for Earn/DeFi flow changes.

## Autonomous Implementation Contract

For a sufficiently clear feature or bug request, recover the source packet,
fill the operation capability packet, implement, test, and validate without
waiting for a human to map the App. Read
[autonomous-feature-workflow.md](references/autonomous-feature-workflow.md)
before editing and use [feature-packet.md](templates/feature-packet.md).

Run the readiness check first:

```bash
node .skillshare/skills/1k-defi-module-integration/scripts/check-readiness.mjs
```

The check fails when reviewed domain anchors drift. Refresh current client and
server contracts, code maps, tests, and the reviewed ref before implementation;
do not bypass it. Use
[runtime-boundaries.md](references/runtime-boundaries.md) for any background
service, event, persistence, restart, account-switch, native-host, or crash path
and [test-map.md](references/test-map.md) for exact validation lanes.

Autonomy does not authorize inventing product behavior, silently resolving
source conflicts, using unavailable secrets, making irreversible external
writes, or claiming runtime proof from static checks.

## Scenario Router

Classify the change first:

1. Existing Earn protocol or Earn detail/list behavior.
2. Existing Borrow protocol, market, reserve, or health-factor behavior.
3. New DeFi module that does not fit Earn/Borrow.
4. ABI-backed protocol operation where App builds contract calls from typed parameters.
5. Native/provider-backed operation where App delegates protocol details to a provider or chain-specific service.
6. Swap-assisted operation such as funding, wrap, repay-with-collateral, or Trade/Buy handoff.
7. Regression/review of routing, pending refresh, history, or platform layout.
8. DeFi Portfolio one-click action support on existing portfolio positions.

If the scenario is unclear, map its operation contract before choosing UI structure.

## Default Workflow

1. Run the readiness script, fill the feature packet, and state `main`, `bg`,
   native/web resource, JS-copy, and initialization ownership.
2. Read [app-architecture.md](references/app-architecture.md) to place the feature in the App flow.
3. Use [code-map.md](references/code-map.md) to find stable anchors.
4. Define the operation contract in [operation-flow.md](references/operation-flow.md): operation type, parameters, setup tx, business tx, status, risk, and refresh.
5. For DeFi Portfolio actions, read [portfolio-actions-guide.md](references/portfolio-actions-guide.md) and verify the portfolio, supported-action, and build-transaction contracts separately.
6. Define route, state, pending, and platform ownership in [state-and-routing.md](references/state-and-routing.md).
7. Identify the closest valid repo pattern before inventing a new hook, state
   owner, operation adapter, or protocol abstraction. Reuse the shell only when
   provider, network, account, token, route, and operation semantics match.
8. Run [checklists.md](references/checklists.md), including ABI/native readiness drills when adding a protocol integration.
9. Run [test-map.md](references/test-map.md), then validate on the route and
   platform that own the behavior using [validation.md](references/validation.md).

## Reference Map

| Need | Reference |
| --- | --- |
| Understand Earn/Borrow/Staking flow | [app-architecture.md](references/app-architecture.md) |
| Execute a feature end to end | [autonomous-feature-workflow.md](references/autonomous-feature-workflow.md) |
| Fill the implementation capability packet | [feature-packet.md](templates/feature-packet.md) |
| Find current repo anchors | [code-map.md](references/code-map.md) |
| Reason about main/bg/persistence/init timing | [runtime-boundaries.md](references/runtime-boundaries.md) |
| Define operation and transaction contracts | [operation-flow.md](references/operation-flow.md) |
| DeFi Portfolio one-click action contracts | [portfolio-actions-guide.md](references/portfolio-actions-guide.md) |
| Route, state, pending, history, and platform ownership | [state-and-routing.md](references/state-and-routing.md) |
| Prevent common integration failures | [checklists.md](references/checklists.md) |
| Run exact focused test lanes | [test-map.md](references/test-map.md) |
| Prove route/platform/runtime behavior | [validation.md](references/validation.md) |

## Readiness Drills

Use these drills to judge whether the skill can guide fast protocol integration:

- ABI-backed protocol: can you identify network/account, contract address, read params, write params, approval/permit needs, tx labels, pending tags, refresh scope, and history semantics without a one-off template?
- Native/provider-backed protocol: can you identify provider capability, native token handling, setup/business sequence, unsupported states, account derive requirements, and completion polling?
- New L2/protocol module: can you decide whether it belongs under Earn/Borrow, a new DeFi surface, a Discovery-hosted flow, or a Trade handoff based on operation semantics?
- DeFi Portfolio action: can you match the visible position row to `/wallet/v1/portfolio/positions`, `/earn/v1/defi/supported-protocols`, and `/earn/v1/defi/build-transaction` without dropping grouped source metadata?
- Earn entry: can you route Home Earn card, desktop/web Earn tab, native
  Discovery-hosted Earn, share/deep link, AssetDetails DeFi action, and
  Swap-assisted funding to the right owner without treating them as one route?

If a drill cannot be completed from the references, improve the abstraction before implementing.

## Hard Stops

- Do not place native Earn routes as if they are desktop/web Earn tabs; native hosts Earn under Discovery.
- Do not add a protocol until route params, provider identity, operation contract, pending tags, and refresh scope are named.
- Do not mix setup tx, approval, wrap, quote, and business tx into one opaque action.
- Do not rely on optional fields to avoid defining pending/history identity.
- Do not call native crash or freeze bugs fixed from state reasoning alone; capture the Android/iOS log, Sentry event, or JS/native boundary that proves the failing operation path.
- Do not hand-edit generated locale files; use `/1k-i18n`.
- Do not broaden shared Staking/Borrow utilities without existing-protocol regression reasoning.
- Do not hide a DeFi Portfolio position only because its protocol has no supported action.
- Do not create a new abstraction, hook, or state owner until the closest
  existing repo pattern and its semantic mismatch have been named.
- Do not continue from a failing readiness drift check. Reconcile current
  client/server truth, actual PR scope, anchors, tests, and reviewed ref first.
- Do not ask the user to supply Jira, Slack, Git, client, or accessible server
  context that current tools can retrieve.
- Do not let one oversized hook own route sync, data loading, operation state,
  listener refresh, pending/history, and view model. Split stateful business
  logic by stable responsibility when that clarifies ownership.

## Related Skills

- `/1k-i18n` for translation keys and generated locale workflow.
- `/1k-coding-patterns` for React and TypeScript patterns.
- `/1k-state-management` for Jotai and state ownership.
- `/1k-cross-platform` for platform-specific routing and layout.
- `/1k-trade-swap-market` for Swap-assisted funding or repay flows.

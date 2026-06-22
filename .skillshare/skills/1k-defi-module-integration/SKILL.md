---
name: 1k-defi-module-integration
description: App-side OneKey DeFi guide for Earn, Borrow, Staking, vaults, lending, protocol integrations, ABI-backed operations, native/provider-backed operations, pending transactions, history, route handoffs, risk display, and DeFi regression review.
---

# DeFi Module Integration

Use this skill when App code touches Earn, Borrow, Staking, vault/lending/yield protocols, operation modals, pending/history, or protocol-specific DeFi flows.

This is an App development skill. It should guide implementation and review from current repository code and App behavior, not from external workflow details.

## Core Model

The canonical DeFi App path is:

`host/route -> home -> list/detail -> operation modal -> transaction sequence -> pending refresh -> history -> cross-surface handoff`

Most requirements are not "add a protocol" only. They are route, data, operation, pending, and platform integration requirements.

## Scenario Router

Classify the change first:

1. Existing Earn protocol or Earn detail/list behavior.
2. Existing Borrow protocol, market, reserve, or health-factor behavior.
3. New DeFi module that does not fit Earn/Borrow.
4. ABI-backed protocol operation where App builds contract calls from typed parameters.
5. Native/provider-backed operation where App delegates protocol details to a provider or chain-specific service.
6. Swap-assisted operation such as funding, wrap, repay-with-collateral, or Trade/Buy handoff.
7. Regression/review of routing, pending refresh, history, or platform layout.

If the scenario is unclear, map its operation contract before choosing UI structure.

## Default Workflow

1. Read [app-architecture.md](references/app-architecture.md) to place the feature in the App flow.
2. Use [code-map.md](references/code-map.md) to find stable anchors.
3. Define the operation contract in [operation-flow.md](references/operation-flow.md): operation type, parameters, setup tx, business tx, status, risk, and refresh.
4. Define route, state, pending, and platform ownership in [state-and-routing.md](references/state-and-routing.md).
5. Run [checklists.md](references/checklists.md), including ABI/native readiness drills when adding a protocol integration.
6. Validate on the route and platform that own the behavior.

## Reference Map

| Need | Reference |
| --- | --- |
| Understand Earn/Borrow/Staking flow | [app-architecture.md](references/app-architecture.md) |
| Find current repo anchors | [code-map.md](references/code-map.md) |
| Define operation and transaction contracts | [operation-flow.md](references/operation-flow.md) |
| Route, state, pending, history, and platform ownership | [state-and-routing.md](references/state-and-routing.md) |
| Prevent common integration failures | [checklists.md](references/checklists.md) |

## Readiness Drills

Use these drills to judge whether the skill can guide fast protocol integration:

- ABI-backed protocol: can you identify network/account, contract address, read params, write params, approval/permit needs, tx labels, pending tags, refresh scope, and history semantics without a one-off template?
- Native/provider-backed protocol: can you identify provider capability, native token handling, setup/business sequence, unsupported states, account derive requirements, and completion polling?
- New L2/protocol module: can you decide whether it belongs under Earn/Borrow, a new DeFi surface, a Discovery-hosted flow, or a Trade handoff based on operation semantics?

If a drill cannot be completed from the references, improve the abstraction before implementing.

## Hard Stops

- Do not place native Earn routes as if they are desktop/web Earn tabs; native hosts Earn under Discovery.
- Do not add a protocol until route params, provider identity, operation contract, pending tags, and refresh scope are named.
- Do not mix setup tx, approval, wrap, quote, and business tx into one opaque action.
- Do not rely on optional fields to avoid defining pending/history identity.
- Do not call native crash or freeze bugs fixed from state reasoning alone; capture the Android/iOS log, Sentry event, or JS/native boundary that proves the failing operation path.
- Do not hand-edit generated locale files; use `/1k-i18n`.
- Do not broaden shared Staking/Borrow utilities without existing-protocol regression reasoning.

## Related Skills

- `/1k-i18n` for translation keys and generated locale workflow.
- `/1k-coding-patterns` for React and TypeScript patterns.
- `/1k-state-management` for Jotai and state ownership.
- `/1k-cross-platform` for platform-specific routing and layout.
- `/1k-trade-swap-market` for Swap-assisted funding or repay flows.

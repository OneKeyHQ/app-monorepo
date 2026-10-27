---
name: 1k-defi-module-integration
description: Implement and debug OneKey Earn, Borrow, Staking, and DeFi Portfolio flows, including protocol actions, approval, positions, settlement, and refresh.
---

# Earn / DeFi

Use this skill for decisions specific to protocol positions and operations.
The current route, service contract, and chain result determine the behavior;
a similar-looking product is a useful comparison only if those semantics match.

## Start With The Failing Step

Trace the actual entry through:

`position/data -> capability -> setup -> business action -> settlement -> refresh`

Find the first step whose input or result is wrong. Search by the action,
request endpoint, or refresh event and follow its caller and consumer. An Earn
page and a wallet DeFi tab can show the same investment through different data
owners; do not choose an owner from the screen label alone.

Before changing behavior, establish the affected platform, account/product
scope, expected transition, and the evidence that would distinguish the bug
from a slow or unavailable dependency. For a presentation-only change, keep
verification on the affected layout and interaction; do not expand it into a
transaction audit.

## Read Only What The Task Needs

| Question | Reference |
| --- | --- |
| Which surface owns the data, navigation, or loading state? | [Architecture](references/app-architecture.md) |
| How should approval, setup, confirmation, or funding continue? | [Operation flow](references/operation-flow.md) |
| Which position may be displayed or acted on, and how is it refreshed? | [Portfolio actions](references/portfolio-actions-guide.md) |
| Which checks can prove this particular change? | [Validation](references/validation.md) |

Keep domain rules here and follow repository `AGENTS.md` for package boundaries,
runtime topology, and delivery checks. Use `$1k-trade-swap-market` for quoting
and trade execution after a funding handoff; DeFi still owns the return action.

## Handoff

Explain the changed contract, the owner that enforces it, and the observed
result. Separate source tracing, automated tests, and real platform/provider
proof. A submitted transaction or successful request alone does not prove that
the position and available actions have settled.

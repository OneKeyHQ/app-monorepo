---
name: 1k-trade-swap-market
description: Implement and debug OneKey Swap, Bridge, Limit, and Stock/Market trades, including quotes, review, execution, fees, and history. Excludes Perps and chart communication.
---

# Trade / Swap / Market

Use this skill for decisions that distinguish a trade from a generic async UI:
which quote is actionable, what the user confirmed, whether execution can be
retried, and how an order becomes durable history.

## Start From The Real Entry

Trace the affected path:

`selection -> quote -> review -> build/sign/send -> history/settlement`

Confirm the platform and layout, then follow the mounted entry to its current
state and execution owners. Search by the request, action, or status field
involved rather than assuming every trade-looking screen uses the same path.
Market layouts can enter different flows; do not turn a scoped fix into an
unrequested migration.

Find the first incorrect transition and the inputs that define its identity.
Compare the actual payload and state before adding a new effect, fallback,
cache, or loading flag. For a layout-only change, validate the affected host
without expanding the task into a provider integration audit.

## Read Only What The Task Needs

| Question | Reference |
| --- | --- |
| Who owns this entry, initialization, cache, or account transition? | [Architecture](references/app-architecture.md) |
| What must survive quote, confirmation, execution, and settlement? | [Provider contracts](references/provider-contracts.md) |
| Which failure transitions and proof are relevant? | [Validation](references/validation.md) |

Follow repository `AGENTS.md` for package boundaries, runtime topology, and
delivery checks. Receive-only filtering stays with its selector until a real
trade starts. DeFi owns a funding request and its return action; this skill
owns the trade. A bulk flow that reuses Swap services still needs its own
session and cancellation contract checked.

## Handoff

Name the changed state/contract, the current owner, and the evidence that the
reported transition now works. Separate tests, real platform interaction, and
provider/signing proof. A visible quote or pending row alone does not prove a
valid build, a durable history write, or completed settlement.

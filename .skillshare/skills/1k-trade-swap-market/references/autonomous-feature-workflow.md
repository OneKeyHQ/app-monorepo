# Autonomous Feature Workflow

Use this workflow for an implementation request, not just for review or
orientation. The goal is to turn a sufficiently clear feature request into a
tested change without waiting for a human to repeat information that is already
available in Jira, Slack, Git, the client repo, or an accessible server repo.

## Definition Of Ready

Start implementation when all of these are recoverable:

- desired user behavior and owning surface
- current client base branch and actual task/PR diff scope
- account, network, token/asset, provider, and route identity
- quote/review/build/send/history/status contract for the affected channel
- closest current implementation and protected sibling flows
- targeted static/unit checks and a real runtime proof surface

Missing discoverable context is a research task, not a question for the user.
Ask only when there is a genuine product choice, conflicting authoritative
sources, missing permission or secret/access, an irreversible external write,
or unavailable runtime evidence that changes the decision.

## Ordered Implementation Loop

1. Run `node .skillshare/skills/1k-trade-swap-market/scripts/check-readiness.mjs`.
   Resolve anchor drift before relying on the code map.
2. Freeze the source packet:
   - current Jira description, latest comments, status, and attachments
   - relevant Slack thread or DM decisions and late corrections
   - current branch, base ref, branch-only commits, and the actual changed files
   - server branch/ref when quote, build, order, fee, status, or DTO fields matter
3. Fill [feature-packet.md](../templates/feature-packet.md). Keep facts,
   assumptions, and unresolved conflicts separate.
4. Classify the owner chain:
   - entry/handoff owner
   - `main` UI, hooks, route, atoms, and visible state
   - `bg` quote/build/status service and SimpleDB owner
   - shared pure types/predicates
   - native or web persistence/resource boundary
5. Freeze the state machine before editing: identity, readiness, quote event,
   selected quote, review snapshot, build/send, persisted row, status repair,
   and terminal UI.
6. Find the closest current pattern with `rg` and `git log`. Inspect the actual
   PR/file scope; a squash title can hide adjacent Swap, Stock, Market, or DeFi
   changes.
7. Implement the smallest owner-correct change. Add or update a focused test
   for every changed pure transition, stale-response guard, identity rule, or
   persistence mutation.
8. Run the exact lane from [test-map.md](test-map.md), then
   `yarn agent:check --profile commit` before commit.
9. Exercise the real owning surface using the runtime matrix in
   [runtime-boundaries.md](runtime-boundaries.md). Static tests are not runtime
   proof.
10. Re-read the diff against the feature packet. Confirm protected flows,
    runtime ownership, and non-goals before delivery.

## Fast Owner Routes

### Stock Or Broker Channel

Start at `useSwapStockChannel`, `swapStockChannelUtils`,
`useSwapStockTradeInputs`, quote progress selection, Stock alert/trade control,
history identity, `ServiceSwap`, and `SimpleDbEntitySwapHistory`. An early
non-actionable provider error is not terminal while the quote event can still
produce an actionable quote.

### Selector Or Handoff Bug

Trace from the source surface into the target selector. Receive DeFi-token
filtering is owned by Receive/AssetSelector/shared filter logic, not by the Swap
selector. Change Swap only after the failing owner reaches Swap state.

### Disconnect Or Local-History Bug

Treat visibility and retention separately. `main` may hide rows while account
readiness is false; `bg` SimpleDB must retain them unless the requirement
explicitly says delete. Prove disconnect, restart, and reconnect with unchanged
row identity.

### Cold Start Or Background/Restart Bug

Capture first-frame selected tokens, `swapType`, account-selector readiness,
Stock detail freshness, quote-event state, and persisted cache separately. Do
not use the final settled frame as proof.

## Completion Contract

An implementation is ready only when the packet contains:

- authoritative source links/refs and resolved conflicts
- exact owner files and runtime ownership
- frozen contract/state transitions and protected regressions
- implemented diff with no unrelated product changes
- exact tests run and their results
- real runtime scenario, evidence captured, and explicit pass/fail
- remaining gates that truly require external authority or unavailable runtime

Do not label a plan or documentation-only check as an implemented feature.

# Find The DeFi Flow

## Follow The Actual Entry

Start from the user's route and follow the request or action to its state and
service owner. Earn catalog/detail, Borrow positions, wallet DeFi Portfolio,
and AssetDetails can share protocol data without sharing account context,
loading state, or refresh subscriptions.

Use the closest working operation as a comparison, then check its provider,
amount units, setup steps, account type, and settlement source. Copying a modal
because it looks similar can silently select a different business contract.

For an async defect, find both the producer and every consumer of the changed
state. A request finishing, an event being emitted, and a visible position
updating are three different checkpoints. Check who mounts the listener; a
background settlement refresh must not accidentally depend on opening History.

## Earn Providers And Tasks

For protocol-specific behavior, start with `packages/kit/src/views/Earn/protocols/`:
`getEarnProtocol` selects an `EarnProtocol` implementation, whose policies and
plans describe provider differences in assets, deposits, withdrawals, and
presentation. Trace the relevant policy through its actual caller before adding
another provider branch to a shared form. For EtherFi, inspect
`EtherFiEarnProtocol.ts` and its action hooks together with the service response;
the selected entry asset, vault share, and withdrawal output have distinct roles.

Shared task identity and step state live in `Earn/tasks/earnTaskPlan.ts` and
`earnWorkflowTaskState.ts`; `earnWorkflowTaskController.ts` coordinates step
adapters. Deposit adapters live under `Staking/earnDepositTask/`, and individual
protocol withdrawal adapters live alongside the Earn protocols. Borrow has its
own task adapters. Follow the actual action path: a shared task primitive does not
mean every protocol or action has the same setup or settlement contract.

## Loading And Readiness

Keep independent requests independently usable. A missing balance need not
block protocol metadata, and changing a selector need not wait for the new
market request before closing it. Scope the next request before accepting its
result so the old market cannot overwrite the new one.

Distinguish initial loading, a usable cached snapshot, a successful empty
response, and a failed refresh. Keep the same scope's complete snapshot during
refresh, but do not present another account's data as current. Cached data may
remove a skeleton while still requiring a silent refresh. Opening an action
modal should not clear the background page's data owner.

For layout fixes, preserve loading feedback, amount semantics, and independent
sections. Check first and settled frames, row measurement, expansion, and
modal transitions; hiding a skeleton or disabling a placeholder can conceal
the original problem instead of fixing it.

## Hosts And Handoffs

Resolve the host from current navigation. Native Earn entry can come through
Discovery, while desktop/web use an Earn route or tab. Borrow share/deep links
may not have a home page below them; use the existing host-aware return path.
AssetDetails has its own modal stack, so carry required account and indexed
account identity through typed params rather than assuming Home providers.

A Market-to-Earn link carries the server's protocol/product and asset identity,
including native/wrapped mapping. Earn resolves the detail destination. A
protocol website instead belongs to Discovery/browser until its RPC enters
DApp confirmation; opening a website is not an internal DeFi operation.

For cross-runtime changes, apply the target-specific topology in `AGENTS.md`.
Follow the background service's write ownership even where UI and background
share a JavaScript runtime; a UI cache is not a second persistence owner.

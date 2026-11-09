# DeFi Operation Contracts

## Establish The Contract

Before changing an operation, identify:

- the account/address, network, provider, position or reserve, and action;
- input/output assets, raw versus display units, limits, and native/wrapped roles;
- setup steps, business transaction or order, and their separate identifiers;
- the authority for success, failure, pending, and subsequent position refresh.

Preserve server-derived symbols and provider metadata. A provider name or
reward ticker is not enough to reconstruct an execution target. Use the
current protocol preview for risk/health checks; do not replace it with an
approximate client formula copied from another protocol.

## Approval And Setup

Before an approval-sensitive action mounts or reopens, reconcile allowance
for the current account, network, asset, and spender. A seeded allowance is a
hint, not permission to skip authorization.

After approval is broadcast, distinguish its transaction result from allowance
indexing. A successful receipt must not become an approval failure because a
secondary read is delayed. Poll exhaustion is pending or unknown, not a mined
failure. Reconcile the allowance into the actual state owner for that scope;
calling the endpoint without consuming its result is not reconciliation. Let
the next step's current validation decide whether the business action can
proceed, including when the user cancels it and returns to the input page.

Track approval, permit, wrap, lookup-table setup, and the business action as
separate steps when the protocol requires them. Setup success is not business
success. If setup invalidates a quote or route, rebuild it before confirmation
and use that same route for execution. Do not send only the business payload
when the host cannot present required setup.

## Operation Lifetime

Use a request/session identity to reject stale preparation and UI updates after
account, product, or action changes. Invalid or empty amount input should stop
new preparation and clear the old executable result, not leave a stale quote.

An intentional modal-to-confirmation handoff can transfer operation ownership.
Do not turn every unmount into cancellation, or let an unrelated reopened modal
consume the old result. Once a transaction or order has been submitted, retain
its identity and status tracking even when its initiating UI closes.

Prevent duplicate submission and release UI protection on each supported exit.
Keep user cancellation, provider failure, unknown broadcast, and successful
settlement distinct. Surface actionable failures once at the operation boundary;
a silent lower layer still needs a handled rejection and diagnostic evidence.

## Pending, Replacement, And Refresh

Keep provider order IDs and chain transaction IDs in their own roles. A
replacement carries both its linkage and the business metadata needed by
pending guards. SpeedUp may continue the original operation; Cancel must not
be classified or displayed as that original action after remote reconciliation.

Refresh the affected account/network/product after the relevant settlement,
not merely after opening confirmation or submitting. Delayed indexing may need
bounded follow-up reads. Keep submitted operations bound to their original
account/network/product; a UI scope change must neither redirect that refresh
nor let its result overwrite the newly selected scope. Do not report business
success from a refresh request alone.

## Funding Through Swap

DeFi owns the shortfall, prefill, risk, and return action. Swap owns quoting,
execution, and its history. On return, match the funding operation to the
intended account, network, token, and step; an unrelated swap must not unlock it.

A terminal result, disappearance from pending, or bounded failure to appear
can end the wait. None proves the balance is sufficient. Re-read the balance
before continuing, including after failure or cancellation; refreshing to
reconcile state does not claim the business action succeeded.

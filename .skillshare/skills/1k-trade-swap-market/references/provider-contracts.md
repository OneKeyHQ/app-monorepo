# Quote, Execution, And Settlement Contracts

## Establish The Channel Contract

For a new or changed provider, identify the trade capability; source, target,
signer and receiver roles; amount/fee units and numeric encodings; setup
requirements; build format; and transaction/order identifiers. Define missing-value
semantics and terminal states from the current contract. Unknown fee, rate,
limit, or ETA is not zero.

Use typed adapters at the service boundary for payload variants. A data-only
channel does not create transaction history. If the server contract cannot
express a required distinction, name that gap instead of inventing a UI rule.

## Select An Actionable Quote

Accept results only for the active request and trade identity. An early provider
error is not terminal while the same quote event can still produce a usable
result. Preserve manual provider choice until a real identity or capability
change invalidates it.

The first usable result can become selectable before the provider stream ends,
once its identity and safety checks pass. Stream completion and quote usability
must not be one loading flag.

Own cleanup at the same scope as subscription: leaving one ticket must not
cancel another ticket's quote event. Opening a provider picker or confirmation
can temporarily blur the page without ending the trade. Determine whether the
flow is still active before stopping polling or discarding its state.

## Confirmation And Execution Have Different Lifetimes

Freeze the confirmed intent: pair, accounts, receiver, amount, provider, limits,
slippage, risk, and required steps. Do not read a different page selection
halfway through confirmation. Rebuilds belong to the current review generation;
late results and backward phase changes cannot replace a newer review.

Closing a review invalidates its pending preparation and UI updates. An
explicit handoff to signing/confirmation transfers ownership of the confirmed
execution snapshot. Track the resulting transaction or order even if the
original UI closes, and never let its callback mutate a newly opened review.
Close the originating layer before opening a fallback confirmation layer.

Before retrying or falling back, determine what may already have been sent.
Completed approvals can sometimes be retained while retrying the business
step. A sent business transaction, uncertain broadcast, or retry that would
replay a submitted step must stop automatic fallback. Reconcile its identity
and status instead of risking another spend. User rejection is not permission
to retry through a different confirmation path.

## Amounts, Fees, And Final Payload

Compute spendable balance with the actual fee payer and same-asset extra costs.
For percentage presets, subtract the applicable reserve once before applying
the percentage. A quoted fee, chain gas, sponsor coverage, and account-creation
cost can represent different liabilities; do not add them twice or assume one
covers the others. Use the current configuration, final instructions, or owning
service to determine them rather than a remembered constant.

Frozen intent does not make gas, nonce, allowance, or sponsorship permanently
fresh. Respect their build/send-time validity. Provider eligibility is only a
candidate: approval steps, multiple transactions, custom RPC, or changed payer
can invalidate sponsorship. Re-estimate when required and check user-paid gas
when sponsorship is unavailable.

Validate the final executable payload against the selected flow's contract,
including chain, assets, receiver, amount and native value where applicable.
A quote preview is not that validation. Bulk flows need their own value,
partial-success, cancellation, and replay rules even when they reuse a Swap
builder.

## Durable History And Settlement

Keep transaction hash, provider order/route ID, source/target transaction, and
replacement/refund identifiers in their distinct roles. A pending atom is not
a durable write: inspect the service acknowledgement and repair/retry path
before relying on restart, notification, or account-history replay.

Merge richer fields by their meaning and source priority. A later hash or
receiver detail may be useful even when status is unchanged; missing incoming
fields must not erase known data. A metadata-only update need not trigger a
status toast or balance refresh.

Separate chain submission/confirmation from provider settlement. Use the
channel's success, failure, canceling/canceled, expiry, and refund semantics to
decide when polling/replacement stops and which transitions change balances.
Disconnect or account-readiness filtering hides rows; it must not delete them.

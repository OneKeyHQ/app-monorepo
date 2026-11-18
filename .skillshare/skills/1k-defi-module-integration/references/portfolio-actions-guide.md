# Positions, Capabilities, And Portfolio Refresh

## Join Three Contracts

A portfolio action needs three sources to agree:

1. The position supplies the investment and execution metadata.
2. Supported actions describe protocol/network/category/action capability.
3. The builder validates the current request and produces the transaction.

Keep a position visible when no action is executable. Distinguish capability
not yet known, explicitly unsupported, supported but currently unavailable,
and enabled. A server-declared action may be visible but disabled; use the
surface's row and protocol capabilities rather than one convenient Boolean.

Preserve source metadata when grouping positions: pool/vault, claim group,
token or NFT IDs, queue IDs, currency, and provider extras may all be needed at
build time. Normalize serialized transaction, approval, and permit variants at
the service boundary so UI and confirmation code consume typed objects.

## Use The Right Identity

Define identity from the inputs that change this result. Depending on the
contract, that includes account and indexed account, actual derived address,
network, provider, vault/market/reserve, category, and position source. An
unchanged account ID does not prove an unchanged address or derivation type.
Do not merge positions by symbol alone.

Apply the chain's address comparison rules consistently to request matching,
response matching, cache keys, and grouped rows. EVM casing differences can
represent the same address; non-EVM identifiers may be case-sensitive. Reuse
the repository's chain-aware helpers rather than lowercasing every identifier.
An empty native-token address can be valid and is not always missing metadata.

Display identity can differ from execution identity. A reward token may need
the investment's claim/config symbol, and an asset shown as native may resolve
to a wrapped Earn product. Preserve the server's mapping. If several products
match and the execution target is ambiguous, keep the position readable but
stop the action instead of guessing a provider's historical token or vault.

## Reconcile The Requested Scope

Account-scoped detail/portfolio data is a read model, not global protocol
configuration. Invalidate or re-fetch it when the actual account/address scope
changes, and reject late results from the previous scope.

Before changing a batch merge, establish whether the response is complete for
the requested scope and what omitted items mean:

| Result | Reconciliation |
| --- | --- |
| Explicit zero or authoritative empty result | Clear the matching old position/source. |
| Partial result or per-item error | Update successes; retain or mark unavailable only the affected unresolved data. |
| Omitted item with unspecified semantics | Resolve the contract before treating omission as zero. |
| Result for an obsolete scope | Ignore it; it cannot refresh the current account. |

A targeted refresh must reconcile its requested keys without clearing other
networks, products, or sources such as airdrop data. A full refresh may remove
absent positions only under its completeness contract. Retaining every old
item hides an exit-to-zero; clearing every old item hides partial failures.

Keep balance, reward, pending, and distributed stages consistent with the
surface's server read model. After settlement, verify the matching position
and action availability change together. A cache hit should preserve usable
display while allowing the current owner to refresh it.

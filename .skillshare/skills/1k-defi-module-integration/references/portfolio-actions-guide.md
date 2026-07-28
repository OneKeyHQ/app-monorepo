# DeFi Portfolio Actions

Use this for claim, withdraw, repay, claim-withdrawal, remove-liquidity, or a
missing action on an existing portfolio position.

## Three Separate Sources

1. Portfolio positions own the visible position and execution metadata.
2. Supported actions own protocol/network/category/action capability.
3. The transaction builder owns final validation and transaction payloads.

An action is renderable only when these contracts can be joined without
guessing. A position remains visible when no action is executable.

## Identity And Grouping

Match on the full stable identity required by the current contract, such as
network, provider, vault/market/reserve, category, and source position. Do not
collapse positions by symbol alone.

Grouped rows must retain their original source metadata. Pool addresses,
claim group identifiers, token/NFT ids, queue ids, currency data, and provider
extras cannot be reconstructed reliably after grouping.

Reward display identity and investment/config identity may differ. Preserve a
server-derived claim/config symbol through normalization and action building;
do not map a provider name to a hardcoded token or historical vault. If current
data is ambiguous, fail closed for the action rather than guessing.

## Route And Build Boundaries

AssetDetails modal pages do not automatically inherit Home account context.
Carry `accountId` and `indexedAccountId` through typed params or the protocol
payload when the action requires them.

Normalize transport variants such as serialized transaction, approval, or
permit fields at the background/service boundary. UI and confirmation code
should consume typed objects. If setup is required but the surface cannot
confirm it, fail clearly instead of sending only the business transaction.

## Proof

Inspect one representative position, supported-action row, and build request.
Exercise both the executable path and the missing/ambiguous-metadata path.
For a position-changing success, prove matching account/network refresh;
cancel and failure must not be reported as a changed position.

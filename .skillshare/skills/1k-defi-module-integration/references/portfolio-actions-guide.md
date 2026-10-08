# DeFi Portfolio Actions

Use this for claim, withdraw, repay, claim-withdrawal, remove-liquidity, or a
missing action on an existing portfolio position.

## Three Separate Sources

1. Portfolio positions own the visible position and execution metadata.
2. Supported actions own protocol/network/category/action capability.
3. The transaction builder owns final validation and transaction payloads.

An action is renderable only when these contracts can be joined without
guessing. A position remains visible when no action is executable.

On Earn protocol detail, treat account-scoped portfolio data as a read model,
not global persisted truth. Scope it by account, indexed account, network,
provider, symbol, and vault; re-fetch when a derived address or account scope
changes. Server-declared action rows may remain visible but disabled when a
capability is unavailable; do not hide them solely because one optional
capability flag is false.

Keep capability states distinct: unsupported (`false`), supported-but-not
currently actionable (for example zero balance or pending setup), and enabled
must not be coerced into one Boolean or filtered into the same empty state.
Scope collateral capability and pending locks by provider, network, market,
reserve, and account; a native reserve may legitimately use an empty address.

On mobile, treat the server-defined portfolio/reward read model as the owner of
claimable, pending, and distributed stages. Preserve account and product scope
when opening shared history or an action, and require both the row-level and
protocol-level capability before rendering a redeem/action control. Keep this
contract separate from any wider-layout portfolio projection.

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

For a Market asset that links into Earn, pass the protocol/product identity and
server-derived symbol through the existing route helper. Preserve native versus
wrapped mapping (for example an asset may display as native while the Earn
product resolves to its wrapped symbol); never infer a vault or claim token
from the provider name alone.

Normalize transport variants such as serialized transaction, approval, or
permit fields at the background/service boundary. UI and confirmation code
should consume typed objects. If setup is required but the surface cannot
confirm it, fail clearly instead of sending only the business transaction.

## Proof

Inspect one representative position, supported-action row, and build request.
Exercise both the executable path and the missing/ambiguous-metadata path.
For a position-changing success, prove matching account/network refresh;
cancel and failure must not be reported as a changed position.

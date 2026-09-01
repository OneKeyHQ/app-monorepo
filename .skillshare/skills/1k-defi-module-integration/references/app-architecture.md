# Earn / DeFi Architecture

## Flow And Surface Ownership

Trace the affected path without assuming one component owns the whole flow:

`entry/route -> data owner -> detail/position -> operation -> status -> refresh`

| Surface                       | Primary responsibility                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| Earn home/list/detail         | Catalog, portfolio, provider/network/vault identity, detail navigation        |
| Staking operation             | Stake, withdraw, claim, redeem, quote, approval, permit, cooldown             |
| Borrow                        | Market/reserve, collateral, debt, health factor, supply/withdraw/borrow/repay |
| DeFi Portfolio / AssetDetails | Position display, supported action resolution, modal route params             |
| Background services           | Transaction building, order/status sync, account-scoped refresh, persistence  |
| Discovery                     | Native Earn host and external protocol websites                               |
| Swap                          | Quote/review/build/send/history after a DeFi funding handoff starts quoting   |

Entry surfaces own navigation params and analytics source, not the downstream
data or execution state. Preserve provider, network, token/symbol, vault or
market, account, indexed account, action, and return target across handoffs.

## Platform Hosts

- Native Earn lives under the Discovery host. Validate a fresh open, repeated
  entry, detail push, modal/bottom-sheet behavior, and return to Earn home.
- Desktop and web use the Earn route/tab. Extension, desktop, and web can use
  dialog hosts where the current surface supports them.
- AssetDetails is its own modal stack. Pass required account identity through
  typed route params or the protocol payload; do not depend on Home-only
  providers unless that stack proves it mounts the matching mirror.

## Runtime Ownership

On iOS, Android, and browser extension, `main` and `bg` are isolated JavaScript
runtimes. They initialize independently and exchange serialized copies.
Native storage or other native singletons may be process-shared, but the
background service/entity remains the sole writer for its data.

Desktop and web run App `main` and `bg` code in one JavaScript runtime/thread.
Service and persistence ownership still matters, but do not invent split-heap
deserialization or independent-JS-runtime races there.

For a cross-runtime or persisted change, name:

1. target platform and runtime scope
2. native/process resource owner
3. data copied across proxy or events
4. independent readiness/order where applicable
5. identity used to reject stale results

## External DApp Boundary

Opening a protocol website is a Discovery/browser action. Until the website
sends a chain RPC that enters the DApp confirmation path, do not create an
internal DeFi action, build request, pending row, order, or portfolio refresh.
On split-runtime targets, Discovery/WebView and confirmation routing stay in
`main`; the DApp service runs in `bg`, and only a serialized RPC crosses the
boundary.

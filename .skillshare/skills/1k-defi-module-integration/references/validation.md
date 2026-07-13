# DeFi Validation

Run the exact relevant lane in [test-map.md](test-map.md) and use
[runtime-boundaries.md](runtime-boundaries.md) to define the runtime pass. The
readiness/eval scripts prove skill structure and anchor freshness only; they do
not prove feature behavior.

## Static And Unit Gates

For skill-only edits:

```bash
git diff --check
node .skillshare/skills/1k-defi-module-integration/scripts/check-readiness.mjs
```

For product code, run the exact focused Jest lane and then:

```bash
yarn agent:check --profile commit
```

Add focused tests when the touched lifecycle, event, persistence, or route-host
transition lacks coverage. Do not declare the feature safe because adjacent
utility tests pass.

## Action Payload Chain

For a position-changing action, capture or inspect:

1. route params and stable account/indexed-account/network identity
2. source position and grouped metadata
3. supported-protocol action row
4. build request, including action, native token/address, amount/decimals or bps,
   and extra params
5. normalized `tx`, `approvalTx`, `permit`, and `orderId`
6. approval/permit confirmation when required
7. business signature confirmation and broadcast result
8. order tx-hash update and final settle result
9. immediate and delayed refresh requests/events
10. visible position/history plus persisted overview after restart

If any link is missing, state which one and do not claim the full action passed.

## Platform Matrix

- native iOS/Android: AssetDetails modal route/page host, keyboard, safe area,
  scrolling, confirm layering, hardware/account constraints
- extension/sidebar: in-page dialog sizing, focus, close behavior, DApp/route
  coexistence
- desktop/web: dialog/page behavior, responsive layout, real Discovery WebView
  content when the flow is external
- native Discovery-hosted Earn: fresh open, repeated entry, tab switch, pushed
  detail route, and pop-to-home

Validate the platform that owns the change. Desktop success is not native proof.

## Action Runtime Pass

A pass requires:

- one submit produces the intended approval/business sequence
- cancel/failure/success all leave the submit guard usable
- `orderId`, tx hash, pending/final status, and displayed operation agree
- no duplicate modal or submit is possible while confirmation is active
- success refreshes only the matching account/network scope
- cancel/failure does not claim a position change
- existing protected protocols and action types still open and settle correctly

## All Networks And Persistence Pass

Run the full matrix from [runtime-boundaries.md](runtime-boundaries.md): cold
restart for Account A, A -> B switch during an in-flight A refresh, successful
action refresh, matching event delivery, updated persistence, restart, and
cancel/failure behavior.

Capture all relevant evidence:

- main owner key and visible state
- request/account/network identity
- bg refresh log and schedule
- `DeFiPositionRefreshed` payload
- persisted per-account/per-network record
- post-restart state

An updated screen alone does not prove the right account was persisted.

## External DApp Pass

For a Discovery-only protocol flow, prove the actual URL, title, and content are
ready. Website-only interaction must not open an internal DeFi modal or create
internal pending/order/refresh state. If the website later sends a chain RPC,
validate the DApp signature-confirm path as a separate owner.

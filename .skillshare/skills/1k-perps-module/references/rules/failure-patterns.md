# Perps Failure Patterns

Use this as a checklist for debugging and PR review.

## Order semantics

- Treating TWAP as a normal open order: wrong list, wrong cancel, wrong lifecycle.
- Adding TIF controls to unsupported modes: market/trigger/TWAP bugs.
- Treating scale as a native group: wrong history/status expectations.
- Validating only total scale amount: child leg can fail min notional or precision.
- Ignoring partial child-order failure: UI reports success while some legs failed.
- Reusing stale positions for reduce-only validation after account/symbol switch.

## State races

- UI active asset changes before BG subscription target; old L2/BBO arrives into new UI.
- Stale subscription create overwrites a newer active subscription map.
- Account switch clears positions but not TWAP/orders/balances for the old account.
- A selector/ticker surface updates quickly while orderbook/chart remains stale.
- Cached L2 displays without proving target/freshness.

## Performance

- L2 tick writes a broad atom consumed by page-level components.
- Orderbook rows format strings/BN values on every render.
- Token selector re-sorts/re-filters every tick instead of using stable derived data.
- Adding logs or debug state to hot websocket paths causes visible latency.
- Fixing a performance issue with only `memo` while atom write granularity remains broad.

## TradingView/K-line

- Assuming `chartReady` means Perps iframe is ready.
- Reloading already-ready chart on every reconnect.
- Not remounting native WebView after initial offline failure when reload is insufficient.
- Keeping old chart lines after symbol/account switch.
- Treating ticker/orderbook recovery as proof K-line recovered.

## Relay deposit

- Matching terminal status by depositAddress only.
- Reusing old request status for a new quote/request.
- Falling back to generic `to` field as deposit address.
- Hiding pending tracking when modal closes.
- Enabling origin chains without refund UX.

## Cross-platform

- Fixing a `.web.tsx` path while native mobile uses a different file.
- Assuming desktop web layout behavior applies to extension surface.
- Changing WebView recovery without verifying native iOS/Android behavior.
- Using platform-generic styles for a Perps layout bug that is platform-specific.

## Security/logging

- Logging signed payloads, private account identifiers beyond allowed diagnostic scope, or raw API payloads containing sensitive data.
- Adding debug logs in order payload/signing paths without redaction.
- Bypassing enable-trading, account bind, or risk validation to make UI submit succeed.

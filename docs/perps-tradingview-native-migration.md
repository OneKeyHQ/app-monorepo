# Perps TradingView Native migration

## First-stage scope

`packages/kit/src/views/Perp/components/PerpCandles.tsx` keeps the existing
TradingView Web chart (`TradingViewPerpsV2`) as the default and offers the same
`TradingViewNative` component used by Market through the chart selector.
The shared entry covers the desktop workspace and the mobile market-detail chart.
The compact mobile trading-panel chart in
`PerpMobileChartPanel.tsx` already used TradingViewNative.

- Reuse Market's Original/TradingView selector. The desktop workspace puts it on
  the right side of the Chart / Info / Funding header. Mobile uses the native
  chart's existing controls/settings switch or the same selector above the legacy
  WebView. Only the selected renderer is mounted. Like Market, selection
  is local to the page and survives instrument changes, but is not persisted.
- Collapse fullscreen and release the parent interaction lock when changing
  renderers. The legacy chart remounts with its own collapsed internal state.
- Feed the active instrument's raw coin into the existing Hyperliquid mainnet
  provider. Preserve identifiers such as `xyz:NVDA` and spot pair IDs; display
  names must not become API identifiers.
- Reuse native history loading, realtime candles, intervals, indicators, drawing
  tools, chart settings and multi-chart controls.
- Key the chart by its data-source identity so switching instruments releases
  the previous chart and its subscriptions.
- Connect desktop expand/collapse to the existing Perps layout state, including
  collapse when switching to Info or Funding. Native mobile fullscreen uses the
  shared chart presentation. Mobile web opts into a full-window portal whose
  DOM container moves between its inline host and the window while retaining
  the canvas and viewport. The portal container uses column flex layout so the
  chart grid fills its height even when all panels are absolutely positioned.
  The collapse control and Escape exit web fullscreen;
  the Android back button exits native fullscreen.
- Use the existing parent interaction lock during native multi-chart resizing,
  and release it on instrument change or unmount.
- Mount the native chart when a coin is available; its readiness does not depend
  on the old WebView reload counter. The legacy branch retains its reload gate.

The existing `TradingViewPerpsV2` implementation and its trading integrations
remain the default. Select Original to use the native renderer. The deferred list
below concerns the native renderer only.

## Trading assistance lines

Both renderers now obtain their line data from
`packages/kit/src/views/Perp/hooks/usePerpsChartLines.ts`. It preserves the existing
account-scoped position/order selectors, spot pair aliases, raw dex/coin IDs and
the `showChartLines` setting. Line prices, quantities, PnL and TP/SL trigger rules
continue to come from the existing `TradingViewPerpsV2/utils/lineBuilder.ts`.

`usePerpsNativeChartLines.ts` converts those lines into the native chart's
reference lines:

| Line | Anchor and label | Presentation |
| --- | --- | --- |
| Position | Entry price, unrealized PnL and absolute position size | Dashed; green/red follows PnL. |
| Liquidation | Liquidation price and `Liq. Price` label | Dashed red. |
| Limit order | `Limit` price and remaining order size | Dotted; green for buys, red for sells. |
| Take profit | Trigger price, trigger condition, order direction and size | Dashed green. |
| Stop loss | Trigger price, trigger condition, order direction and size | Dashed red. |

Trading labels sit toward the left of the plot with a solid color border, a
theme-aware description background and a contrasting quantity segment. The
liquidation label is inset further along its line. Position and liquidation labels
use semibold text, while the price axis retains separate color-filled price badges.
Order cancel buttons sit at the end of the label, and drag/cancel hit areas follow
its layout.
Web Canvas and native Skia consume the same label scene commands. Other reference
lines, including Market's previous close, retain their existing label styles.

Limit labels use regular text in the order color, a solid order-colored quantity
segment with white text, and a lightly tinted cancel button. A dotted grip appears
when the order is draggable; it shares the label's drag region. Narrow plots give
the full title priority. Cancellation is available only when the full title and
button fit together; quantity appears only when its complete value also fits.

Price-axis labels share `getTradingViewNativePriceLabelPositions` in
`utils/chartLayout.ts`. Previous close, the current price and every visible
reference line participate in one price-ordered layout. Colliding labels form
groups that keep the current-price label anchored when space permits and remain
inside the price pane. Off-screen lines and disabled price-axis labels reserve no
space. When the pane cannot physically fit every label, spacing compresses evenly,
preserving the previous-close behavior for very short charts. Only price labels
and their attached right-side titles move; line prices and left-side trading
labels stay anchored to their actual prices. Both linear and logarithmic scales
use the same layout after price-to-coordinate projection.

Full-position TP/SL orders with zero order size reuse the current position size,
as in the old chart. Invalid prices are not rendered. Lines follow the existing
visible price range; they do not widen candle autoscaling. Theme changes update
the colors, and all native chart panels receive the same active instrument's
lines. Account/line subscriptions for the native renderer are mounted only while
that renderer is selected. Closing positions, removing orders, account changes,
logout and disabling the setting update the declarative line list directly.

On desktop layouts, limit and TP/SL lines now expose a cancel button and can be
dragged to amend the limit or trigger price. Position and liquidation lines remain
informational. The interaction works in single-chart and multi-chart layouts;
mobile layouts continue to display the lines without trading actions, matching
the legacy trading-UI gate.

`usePerpsChartLineActions.ts` reuses the existing trading-enabled flow and
cancel/amend actions. It binds each action to the account, coin, order and
original price, checks them again after authorization, and passes the expected
account to the background service. Spot actions preserve the order's raw coin.
Amendments retain side, remaining size, TIF and trigger semantics, including
zero-size full-position TP/SL orders.

Dragging previews the price while holding the price scale steady. Pointer release
keeps that preview until the owner commits its pending state. Successful amendments
retain the submitted price until the scoped order stream updates or removes the
order, with a ten-second synchronization timeout. Request identity prevents a late
response from clearing a newer action after an account or instrument switch. Escape,
pointer cancellation, changed source data and account changes discard the
preview. The pending line disables duplicate actions; failures restore the
authoritative price and use the existing error feedback. The interaction is
separate from chart panning and drawing gestures. Legacy line synchronization,
revision ordering and PnL throttling remain in the WebView adapter.

## Historical and realtime fill marks

`usePerpsNativeChartMarks.ts` loads the active account's Hyperliquid trade history
and merges account-matched `USER_FILLS` events before mapping them to native B/S
marks. Subscriptions start before history loading so new fills survive an
in-flight request. Marks are deduplicated, scoped to the current instrument
(including spot aliases), and capped at the latest 2,000 entries. Account or
instrument changes hide the previous scope immediately.

The native chart's existing mark renderer aligns fills with candles and displays
fill direction, size and price in its tooltip. The `showTradeMarks` setting
controls display and subscriptions. History refresh, network restoration and
Perps WebSocket recovery trigger reloads. Refresh signals received while marks are
hidden remain pending until history is loaded after showing the marks again.
These marks are supported wherever the
shared `PerpCandles` native renderer is used; the separate compact mobile trading
panel is unchanged.

## Chart order entry, display metadata and mobile interaction

Desktop Native charts expose a price-level plus control and a context menu.
`usePerpsChartOrderMenu.ts` formats the selected price and opens the existing
limit-order dialog, or the position TP/SL dialog when the account has a position
in that coin. The dialogs retain their existing confirmation, account binding,
trading enablement and order validation. Menu actions recheck the account/coin
scope after the menu closes; switching scope or unmounting closes owned menus
and dialogs. Merely selecting a price never submits an order.

`usePerpsNativeChartMetadata.ts` supplies the instrument's display name and
explicit price precision to the shared renderer. Spot titles use the existing
base/quote display mapping while candle API identifiers remain unchanged.
Precision uses the instrument's size decimals and Hyperliquid's decimal limit
(six for perps, eight for spot). A newer close with fewer decimals cannot reduce
the precision of historical candles or orders. Axis ticks,
OHLC, latest price, crosshair, extrema and reference-line prices use the same
format, with axis width measured from that precision. Other chart consumers
retain their default formatting.

Native crosshair, pan, zoom, price-axis and drawing interactions report their
active state to the Perps page so header/page scrolling pauses during chart
interaction and resumes afterward. Web chart pointers and drawing tools use
the same page lock. Perps canvas and time-axis gestures disable browser touch
scrolling; pointer release, cancellation, lost capture, window blur and unmount
release the lock. Other chart consumers retain `pan-y` when they do not request
interaction tracking. Multi-chart panels aggregate their locks, and fullscreen, gestures
and panel resizing have separate owners. Closing the chart or changing the
instrument releases the locks. The compact mobile trading-panel chart keeps
its existing presentation; these Perps entry integrations target `PerpCandles`.

## Independent Perps preferences

Both `PerpCandles` and the compact `PerpMobileChartPanel` use
`storageNamespace="perps"`. Chart appearance/type, indicator selection/settings
and multi-chart layout use separate Perps persistent atoms. Additional panels
read and write their settings inside the Perps layout snapshot. Desktop dialogs,
mobile quick settings and mobile settings routes retain the originating namespace.

Intervals use a dedicated Perps storage key, including independent panel entries.
Drawing keys include a `perps:` prefix before the existing source and panel ID;
indicator-pane heights and ordering use that same isolated key.
Market and Swap keep their existing storage keys and settings. Perps starts with
the standard defaults when its new keys are absent; no Market or legacy WebView
settings or drawings are copied, read as a fallback, removed or migrated.

These are serialized preferences in the existing persistence layer, with no
Realm/IndexedDB schema change or new native storage instance. Web/desktop remain
single-runtime. On native/extension, global atoms retain the existing background
persistence and asynchronous UI proxy; each runtime owns its JS state copy.
UI chart-local interval/drawing writes retain their existing storage backend and
initialization order rather than introducing a shared JS cache across runtimes.

## Perps-specific functionality deferred

Paths in this table are relative to
`packages/kit/src/components/TradingView/TradingViewPerpsV2/` unless stated otherwise.

| Feature found in the old chart | Existing implementation | Follow-up |
| --- | --- | --- |
| WebView readiness, Android symbol reloads, theme injection, developer reload controls and recovery messages | `TradingViewPerpsV2.tsx`; WebView mounted/reload atoms | These remain active in the legacy branch. Native history/subscriptions own their lifecycle; verify cold start and offline recovery on each target. |

## Verification

Primary target: Web at `http://localhost:3000/perps?token=xyz%3ANVDA`.
Web and desktop use one JS runtime; this migration does not introduce a native
resource or change background trading/signing ownership.

The native/extension chart and its Hyperliquid transport live in the UI (`main`)
runtime. Background state is delivered through the existing atom proxy. Chart
data is held in the UI heap; it is not a shared JS object with `bg`, and mounting
the chart does not assume background or WebView readiness.

Manual pass conditions:

1. `xyz:NVDA` candles visibly render and update; a container or loading mask alone
   is not evidence of readiness.
2. Switch between instruments (including a spot pair) and change intervals;
   confirm candles belong to the active source and old subscriptions are released.
3. Expand/collapse the desktop chart, then switch to Info/Funding and back.
4. Check indicator/drawing controls, mobile parent scrolling and fullscreen,
   and subscription recovery after reconnecting.
5. Confirm TradingView is initially selected, then switch TradingView → Original
   → TradingView. On desktop, confirm the selector stays on the right of the
   workspace header without a duplicate inside either chart. Confirm the
   selection, visible candles for the current coin, and that the previous
   renderer is unmounted.
   Repeat after expanding the chart and after switching instruments.
6. With existing positions/orders, check entry, liquidation, limit and TP/SL
   lines, their prices/quantities/PnL, the display setting, and account/instrument
   switching. Check that removed orders and closed positions leave no stale lines.
7. With account trade history, check historical B/S marks and tooltip details,
   realtime fills, the display setting, account/coin switching and reconnects.
8. On desktop layouts, check order-line drag previews, Escape cancellation and
   single/multi-chart interaction. Any submission checks must use a separately
   authorized test environment: verify cancellation, limit/trigger amendments,
   error rollback and rejection after account/order changes.

9. On desktop, use the price plus control and right-click menu to open limit
   and position TP/SL dialogs. Check the preset price and labels, then change
   account/coin and confirm stale dialogs/menu actions cannot be used.
10. Compare OHLC, current price, crosshair and order labels at small-price and
    high-price instruments, including a spot pair; check the readable pair title.
11. On mobile web, verify nonzero rendered grid/canvas height and visible candles
    in the inline view, in fullscreen and after exiting fullscreen. Check viewport
    retention and restored page scrolling. On native, check long-press crosshair,
    horizontal pan, pinch, price scale and drawing gestures against the parent
    scroll.
12. Change Perps intervals, chart appearance, indicators, drawings and panel layout;
    confirm Market retains its own values, then verify the reverse direction.
    Reopen the page to check persistence, and check main/sub-panel desktop dialogs,
    mobile settings routes and the compact mobile chart use the Perps settings.
    With no Perps preference saved, verify defaults without copying old values.

Validation on 2026-10-08:

- `yarn agent:check --profile commit`: passed, including lint and TypeScript.
- Targeted Jest suites for the native data provider, Hyperliquid gateway, K-line
  state machine and Perps desktop layout: 4 suites, 150 tests passed. Jest also
  reported a duplicate `@onekeyhq/desktop` package name in the existing desktop
  manifests; it did not fail the suites.
- The existing shared `TradingViewChartControls.test.tsx` suite passed (7 tests).
- The existing account-scoped data and native chart component scene suites
  passed (2 suites, 33 tests) after adding trading assistance lines. No new test
  files were added.
- After adding marks and order-line actions, 6 existing suites passed (61 tests):
  account guards, order amendments, native reference-line scenes, fill-mark
  scenes, pointer interactions and account-scoped data. These suites cover
  existing underlying behavior, not browser integration of the new hooks.
- After adding chart order entry, display metadata and mobile interaction,
  11 existing suites passed (209 tests): chart formatting/scenes, native gestures,
  price scaling, chart containers, multi-chart layout, canvas sizing and mobile
  scroll state. No tests were added or modified. These checks do not replace
  browser or device verification of the new integrations.
- The local route returned HTTP 200. Browser automation could not connect due to
  a tooling initialization error, so actual candle rendering and UI interactions
  remain unverified. The HTTP response is not a visual pass.
- Native and extension runtime behavior has not been manually verified.

Follow-up on 2026-10-09:

- Reviewed the mobile fixed-height host, portal, flex grid and fullscreen exit
  path after fixing the portal's missing column flex layout. No further changes
  to those components were needed. The post-fix repository gate passed on
  2026-10-08; it was not rerun for this documentation-only follow-up.
- Browser initialization still fails before opening the page. Actual rendered
  dimensions, candle visibility and fullscreen interactions remain unverified.
- Perps preference isolation uses new storage without migration. Eight existing
  settings, interval, multi-chart, container and compact-chart suites passed
  (106 tests). No tests were added or changed; browser verification of the new
  namespace remains outstanding.
- After preference isolation, `yarn agent:check --profile commit` passed,
  including lint and TypeScript.

No live orders were placed, amended or canceled during implementation.

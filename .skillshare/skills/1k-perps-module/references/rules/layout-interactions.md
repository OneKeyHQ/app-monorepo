# Perps Layout and Interaction

Use for copy, spacing, responsive layout, rows, scroll, chart placement, keyboard and safe-area work. Start at the visible surface. A local presentation change can stay in its component; it does not require reading SDK contracts or changing service ownership.

## Find the surface

Paths below are relative to `packages/kit/src/views/Perp/` unless fully qualified.

| Surface | Starting files |
| --- | --- |
| Page and responsive route | `pages/Perp.tsx`, `pages/MobilePerpMarket.tsx`, `pages/ExtPerp.tsx`, `layouts/` |
| Desktop resize and saved layout | `layouts/PerpDesktopLayout.web.tsx`, `layouts/perpLayoutUtils.ts`, `components/PerpLayoutSettings.tsx` |
| Mobile top chart | `components/PerpMobileTopChartProvider.tsx`, `components/PerpMobileChartPanel.tsx` |
| Orderbook layout and clicks | `components/OrderBook/index.tsx`, `components/PerpOrderBookMobileVerticalShell.tsx`, `components/PerpOrderBook.tsx` |
| Table rows, funding history and empty state | `components/OrderInfoPanel/List/CommonTableListView.tsx`, `components/OrderInfoPanel/List/PerpFundingHistoryList.tsx`, `components/OrderInfoPanel/Components/`, `components/OrderInfoPanel/utils/tableLayout.ts` |
| Inputs and dialogs | `components/TradingPanel/inputs/`, `components/OrderInfoPanel/` dialogs, `components/PerpDialogLayout.ts` |

Confirm the working branch's path and the actual responsive predicate. A narrow web layout can use mobile presentation; native platform flags and layout breakpoints are not interchangeable.

## Follow the state that owns the behavior

Distinguish saved user layout, measured container dimensions and transient drag/overlay state. Preserve each lifecycle when changing sizing or chart placement. Check how much height the header/footer leave for rows; loading, empty and populated views should agree on that space. Prefer an affected-platform fix when the cause is platform-specific.

For a row-formatting change, inspect the row and shared table contract before moving calculations. A filtered list count and the account's total holdings can serve different UI meanings; choose the intended one from the actual feature instead of enforcing one globally.

For orderbook clicks, inspect the visual snapshot/interaction bridge and parent callback if the symptom survives after data recovers. [Market data](state-subscriptions.md) explains the target and freshness gates; visible prices do not by themselves establish click eligibility. For chart overlays that interfere with page scrolling, trace the overlay message through `MobilePerpMarket` and [the chart bridge](tradingview-bridge.md).

For keyboard and safe-area bugs, inspect the active dialog/input and affected platform. A chart resize or layout bug does not automatically require resetting global subscriptions or remounting the page.

## Select validation

A copy/spacing edit needs the affected layout checked with existing repo validation. Choose additional state cases when the changed behavior needs them: relevant breakpoint/resize, empty versus populated rows, top-chart expand/collapse, overlay release, keyboard open/close, or safe-area alignment. Check another platform when shared behavior is affected; do not make every UI edit run every Perps flow.

Existing test candidates include tests beside `perpLayoutUtils`, `PerpDesktopLayout.web`, `PerpMobileTopChartProvider`, `PerpMobileChartPanel`, `OrderBook.empty`, `tableLayout`, and `utils/mobilePerpMarketScrollState`. They are navigation hints, not a mandatory test list. For visual/interaction fixes, establish the repro and pass condition before editing, and verify the actual rendered state and interaction.

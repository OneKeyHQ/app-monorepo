# Chart interactions

The chart keeps market data, persisted preferences, and transient pointer state
under separate owners:

- `TradingViewNativeContainer` owns a single chart's data and preferences.
  `TradingViewNativePresentation` handles inline/fullscreen presentation while
  the data controller and native viewport remain alive.
- `useTradingViewNativeSettings` isolates indicator/chart settings by Market,
  Perps, or Swap namespace through the existing persisted atom transport.
- `multiChart` is the split view for several tokens (web, extension and
  desktop). `TradingViewNativeMultiChart` lays out a grid and tracks the
  selected panel: the host persists the layout, supplies the selected panel's
  source and renders each panel, normally as a `TradingViewNative`. A primary
  press anywhere in another panel selects it and asks the host to switch to its
  token; every chart keeps its place, token and mount, the previously selected
  panel goes on showing the token it showed, and a switch the host turns down
  returns the selection. The selection shows at once, before the saved layout
  or the host's source catch up, and is saved only once the host has followed,
  from the host's answer, so it also lands after the grid is unmounted; the
  host can show the token before its switch has landed. Until
  the saved layout has it, the grid keeps the tokens of the panels selected
  before and writes them all with every selection: a split runtime evaluates a
  write against the snapshot bg sent last, which can miss the selection before.
  For the same reason every write of the grid (a selection, a panel's token or
  indicators, the preset, sync options, sizes) carries the next `revision` and
  a `writeId` of its own, and starts from the layout the grid wrote last until
  the saved layout is that write or has a newer revision, so it cannot undo
  another write that has not come back yet; a newer layout another window
  saved meanwhile also has it. Another window can save the same revision
  without the write, e.g. when both wrote over one layout, so that one does
  not count.
  Grids of one `layoutKey`, e.g. one unmounted and the next mounted, share
  those writes, their selections and the switches they asked for: a late
  write of a grid that is gone, e.g. a selection the host answers then, builds
  on the writes still on their way and on those of a grid mounted since, a
  newer selection in either outdates the answer the other waits for, and a
  selection in either of a token the other asked for waits for that switch.
  Without a key it starts from the latest saved layout.
  A host whose saved layout other pages share, e.g. extension tabs with a
  source each, keeps the panel selected on its page beside that source
  (`selectedPanelId`, `onSelectedPanelIdChange`): the grid takes it from the
  saved layout once and moves it with the selections it saves, so a selection
  another page saves never puts this page's token in that page's panel.
  Without it the selection is the saved layout's. The panels the grid gives
  a default token are the ones that need one on this page, so also the panel
  another page selected, which stores none there; that fill leaves the saved
  selection as it is.
  Selecting the panel of the token the host already shows asks the host for it
  again while an earlier switch is on its way, which drops that switch. A
  selection of the token the host is switching to, which it may show before
  the switch lands, waits for that switch's answer instead; a switch the host
  has left for another token is turned down, so its token is asked for anew.
  A turned-down switch leaves the host on the source it showed before the
  switches on their way, also one asked for while another was still on its
  way, and the selection returns there.
  A newer selection does not always cut the switch before it short: a host
  can take a moment before a switch begins, e.g. to look a token up, or turn
  it down before it does. Each switch on its way therefore keeps the
  selection it decides. One that lands after a newer selection replaced its
  own is saved all the same, and the newer selection goes on from it: the
  token is that panel's, and the place a turned-down switch returns to. A
  selection the host turns down while the switch before it is still on its
  way, with the host on that switch's token or where it started from, goes
  back to the selection of that switch, which its answer then decides.
  Presses in overlays a panel rendered outside itself, e.g. a chart's menu, do
  not select. A token picked in a panel, e.g. from the picker Perps puts in
  each header, selects the panel with that token (`selectSource`): the host
  is asked for it once, that answer decides the selection like a press, and
  it drops a switch the press on the picker started. The host is asked also
  for the token it already shows, which it can show without what it takes to
  use it, e.g. a market another page holds.
  Enter or Space on a panel's focused chart canvas selects it the same way;
  on the panel's other controls these keys keep their own meaning. While a preset hides the selected panel the first panel
  shows the host's source in its place; the source still belongs to the hidden
  panel (`getTradingViewNativeMultiChartSourceOwnerPanelId`), so a selection
  made then saves it there and never over the first panel's own token. A
  selection whose panel the preset hides before the host has followed is
  saved all the same and returns with the preset. If the host turns the switch
  down for another token, e.g. from the host's picker while the first panel
  stands in for a hidden one, the selected panel takes it only if it was on
  screen when the host went there; a hidden one keeps its own token, and the
  new one belongs to the panel it belonged to before, also for a selection
  made before the answer comes. A host back on its own source returns the
  selection, and the selection returned to follows the host from then on. The
  grid shows one controls row above all
  panels, the selected panel's, through
  `TradingViewNativeMultiChartControlsContext`; the other charts render none,
  and the layout picker sits in that row. The same context gives the selected
  chart one drawing tools column at the left of the grid (`drawingTools`).
  The chart keeps the properties of its selected drawing, its hints and its
  object panels on itself, and the column's menus reach over the panels. The
  grid keeps one collapse state for the column. Collapsing it widens every
  panel by its share of the column; a chart's price scale counts that share
  in, as a single chart counts its own tools in, so the candles it reveals
  never rescale the plot. A chart whose tools go off screen drops its tool,
  unfinished drawing and selected drawings, which nothing would show any more,
  and takes no drawing shortcuts until they are back. The first panel keeps the host's own
  interval and indicators wherever the selection is. Every extra panel is
  wrapped in
  `TradingViewNativeMultiChartPanelContext`, so a chart mounted inside keeps its
  own token, interval, indicator settings and pane heights; chart appearance
  stays shared with the namespace and drawings stay with the token. Presets are grids of cells (`1`, `2h`, `2v`,
  `3`, `4`); track sizes are saved per preset and a divider only spans the cells
  it separates. In a split a panel can fill the grid: the button in its chart's
  bottom right corner, where the price axis meets the time axis, or a double
  click on its plot maximizes it, selecting it as a press would, and the same
  again brings the split back. A double click on an axis, a drawing, an order
  line or a pane's legend, or one that drew, keeps its own meaning, and a
  single chart has neither. The maximized panel is a view of the grid, never
  saved: a reload, another preset or a selection that goes back elsewhere,
  e.g. from a switch the host turned down, ends it. The other panels stay
  mounted at their size behind it, unseen and taking no press, so the split
  comes back without a chart resizing; the dividers and the selection outline
  are gone meanwhile. iOS and Android resolve the `.native` pass-through and
  keep a single chart.
- The split view's layout picker also holds its sync options (`sync` in the
  saved layout): symbol, interval, crosshair, time and date range. All are
  off until the user turns them on. Every panel gets a
  `TradingViewNativeMultiChartSyncContext` with what it shares; a part that is
  off is null there, and the provider stays mounted, so changing an option
  never remounts a chart.
  - Symbol: the grid renders the selected panel's source, the host's, in
    every panel and sets `isSymbolSynced` on the panels. Only a picker, the
    host's or one in a panel, changes that source, and selecting another
    panel changes neither the host's source nor any saved token. A panel
    keeps its saved token for when the option is turned off; turning the
    option on saves the selected panel's, which it showed without storing,
    and a selection still on its way then keeps no older token for that
    panel to write back.
  - Interval: `multiChart/intervalSync` holds the shared interval. The first
    panel sets it when syncing starts, a pick in any panel changes it, and
    every other chart takes it through `useMultiChartIntervalSync`; a chart
    that cannot show the interval keeps its own. The chart that made the pick
    is not told about it, so whatever came with the pick, such as a calendar
    jump, goes on undisturbed.
  - Crosshair: `multiChart/crosshairSync` carries one crosshair. A chart
    publishes the time and price under its own crosshair after each draw, and
    withdraws them when the pointer leaves, a drag starts or it unmounts. The
    other charts redraw in the same frame and resolve the time against their
    own candles in the scene, so the crosshair stays on that time through
    their data updates and viewport changes, and is left out while the time is
    out of view. A price is drawn only by charts of the same instrument and
    only inside their price range. The position lives in the channel, never
    in a chart's runtime state: a chart's own crosshair always wins, and
    trade-mark tooltips keep following the pointer only.
  - Time and date range: `multiChart/viewportSync` lets the charts follow the
    one the user moved last; until then they follow the first panel. The
    leading chart reports, after each draw, the times of the newest and
    oldest candles in view and where they sit (`utils/syncedViewport`). A
    following chart lines itself up before each of its own draws: its candle
    holding the newest time goes to the same place at the right, and with date
    range on its zoom changes so the oldest time lands at the same place at
    the left, within the zoom limits. A time it has not loaded goes to its
    nearest loaded candle, from where its history loads as usual. A following
    chart never reports back, so charts cannot move each other in circles.
    Panning, zooming, the navigation buttons and a picked date make a chart
    the leading one, but only when they move it in time: a drag that changes
    just its prices leaves the lead where it is. When the leading chart
    unmounts, as on an interval change, the first panel or else another one
    carries on, and the panel's next chart lines up with it.
- `drawings/model` and `drawings/geometry` are shared time/price calculations. The
  browser Canvas renderer and native Skia renderer consume the same geometry.
- `drawings/useChartDrawings` owns editing and selection. Browser
  pointer/keyboard events and native gestures are thin adapters. Pointer
  movement redraws previews without refreshing the React chart tree; completed
  edits update controls and history.
- `drawings/drawingDocument` owns a token's drawings, their undo history and
  serialization. Charts mounted with the same drawing key, such as one token in
  several split-view panels, join one live document: an edit, undo or failed
  save in one shows in all of them, while tool, selection, hide and lock stay
  per chart. A drag ends when another chart changes a drawing it is moving, so
  its release cannot undo that change. On web a key press goes to the chart
  under the pointer, otherwise to the focused one, so one shortcut never runs
  in two charts; a chart's tools column outside it, as in a split view,
  counts as part of the chart, and a chart whose tools are off screen takes
  none. A tool menu takes arrow keys only while focus is in its own
  toolbar and closes when focus moves to another toolbar.
- `indicatorPanes` owns the order and preferred heights of the indicator panes.
  They are kept per namespace and per split-view panel, not per token, so they
  survive a token switch like the indicator settings they arrange. Web/desktop
  resize handles use the same layout calculation as the rendered panes, legends,
  and price-axis hit tests. The boundary under the price chart resizes the whole
  stack and every pane keeps its share; any other boundary trades height between
  its two panes; a double click restores the defaults. Saved heights record the
  chart height they were set at and scale with it, so they hold their share in a
  smaller chart such as a split-view panel. A stack with less room than its
  panes prefer, e.g. after panes are added beside one dragged over the whole
  stack, shrinks them by their shares, but a pane stops at the minimum height
  and the taller ones give up the rest, so every boundary stays draggable. The
  boundary under the price chart shrinks the stack the same way, until every
  pane is at the minimum. Only a chart too short for every minimum splits the
  stack equally and locks the boundaries. A drag that leaves its boundary where
  it started, e.g. one held by a minimum height, saves nothing: the heights on
  show can differ from the saved ones, such as a height taller than the stack.
  A drag undoes only a preview of its own: one that resizes nothing leaves
  alone what something else changed meanwhile, e.g. a reset from a second
  pointer. A drag saves the heights the chart shows for it, so a pane dragged
  past the tallest a pane is shown at is saved at that height. Saved heights
  are shares of the chart: rebasing them for another chart height does not
  hold them to the limits a pane is shown at. The layout applies those, and a
  hidden pane keeps its share through a resize in a smaller chart. Native
  charts do not expose pane-height drag handles.
- Indicator Y axes pin their visible ranges independently by instance ID. Web
  pointer handlers and native gestures use the main axis scaling calculation;
  double-click/tap clears only the target pane's manual range. These transient
  ranges override render metadata without changing settings or copying series.
  Each axis has independent A/L controls. Resetting Auto preserves its scale mode;
  logarithmic plots, ticks, and crosshair values share the main axis projection
  and require a positive range.
- `chartLocalStorage` serializes writes by key and waits for pending writes before
  restoring a chart. Completed queue entries are removed. Existing drawing keys
  remain compatible with drawings saved before the shared/native implementation.

## Runtime ownership

Web/desktop use one JavaScript runtime for app main and background code. Browser
event listeners and resize observers belong to the mounted chart and are removed
on unmount.

On iOS/Android, main and bg initialize independently and have separate JavaScript
heaps. The drawing controller, live drawing documents, local write queue, and
indicator-pane preferences belong to main. Native storage may share its underlying resource across runtimes;
the queue is not a cross-runtime lock. These chart-local keys have no bg writer.
Persisted settings atoms use the existing main/bg transport rather than sharing JS
objects. Native gestures and Skia use a separate worklet runtime with serialized
render snapshots; the worklet never opens storage. Skia drawing paths, paints,
and dash effects are released after each render.

## Verification

Cover persistence ordering/failure, restored editing, hidden/locked objects,
freehand previews, resized pane geometry, namespace-specific settings, fullscreen
ownership, split-view panel state (token, interval, indicators, sizes,
selection) across preset changes and reloads, selecting a panel without a chart
remount, maximizing every panel and back by its corner button and by a double
click anywhere on its plot, drawing in every split-view panel with live sync
between panels showing one token, every sync option on and off across a
reload (symbol and interval changed from the first and from another panel; the
crosshair between panels of different tokens and intervals, with its price
line for the same token only; panning and zooming one chart with time and with
date range synced, between different intervals), and unmount cleanup. UI acceptance must include actual candle pixels,
editing a restored object, and restarting the page/app.
Verify pane resizing on web/desktop; native pane heights must stay unchanged when
dragging pane boundaries. For native, distinguish process memory
(main + bg + worklets + native resources)
from each JS heap, and
record both UI FPS and JS FPS. Development simulator measurements do not replace
release-device profiling.

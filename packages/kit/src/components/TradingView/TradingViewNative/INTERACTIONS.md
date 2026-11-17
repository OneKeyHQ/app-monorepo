# Chart interactions

The chart keeps market data, persisted preferences, and transient pointer state
under separate owners:

- `TradingViewNativeContainer` owns a single chart's data and preferences.
  `TradingViewNativePresentation` handles inline/fullscreen presentation while
  the data controller and native viewport remain alive.
- `useTradingViewNativeSettings` isolates indicator/chart settings by Market,
  Perps, or Swap namespace through the existing persisted atom transport.
- `multiChart` is the split view for several tokens (web, extension and
  desktop). `TradingViewNativeMultiChart` only lays out a grid: the host
  persists the layout, supplies the first panel's source and renders each panel,
  normally as a `TradingViewNative`. The first panel is the host's own chart,
  unchanged. Every extra panel is wrapped in
  `TradingViewNativeMultiChartPanelContext`, so a chart mounted inside keeps its
  own token, interval, indicator settings and pane heights; chart appearance
  stays shared with the namespace and drawings stay with the token. Presets are grids of cells (`1`, `2h`, `2v`,
  `3`, `4`); track sizes are saved per preset and a divider only spans the cells
  it separates. iOS and Android resolve the `.native` pass-through and keep a
  single chart.
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
  in two charts; a tool menu takes arrow keys only while focus is in its own
  toolbar and closes when focus moves to another toolbar.
- `indicatorPanes` owns the order and preferred heights of the indicator panes.
  They are kept per namespace and per split-view panel, not per token, so they
  survive a token switch like the indicator settings they arrange. Web/desktop
  resize handles use the same layout calculation as the rendered panes, legends,
  and price-axis hit tests. The boundary under the price chart resizes the whole
  stack and every pane keeps its share; any other boundary trades height between
  its two panes; a double click restores the defaults. Saved heights record the
  chart height they were set at and scale with it, so they hold their share in a
  smaller chart such as a split-view panel. Native charts do not expose
  pane-height drag handles.
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
ownership, split-view panel state (token, interval, indicators, sizes) across
preset changes and reloads, drawing in every split-view panel with live sync
between panels showing one token, and unmount cleanup. UI acceptance must include actual candle pixels,
editing a restored object, and restarting the page/app.
Verify pane resizing on web/desktop; native pane heights must stay unchanged when
dragging pane boundaries. For native, distinguish process memory
(main + bg + worklets + native resources)
from each JS heap, and
record both UI FPS and JS FPS. Development simulator measurements do not replace
release-device profiling.

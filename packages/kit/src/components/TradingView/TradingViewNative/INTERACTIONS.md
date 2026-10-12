# Chart interactions

The chart keeps market data, persisted preferences, and transient pointer state
under separate owners:

- `TradingViewNativeContainer` owns a single chart's data and preferences.
  `TradingViewNativePresentation` handles inline/fullscreen presentation while
  the data controller and native viewport remain alive.
- `useTradingViewNativeSettings` isolates indicator/chart settings by Market,
  Perps, or Swap namespace through the existing persisted atom transport.
  Built-in multi-chart layouts and per-panel preferences are no longer used.
- `drawings/model` and `drawings/geometry` are shared time/price calculations. The
  browser Canvas renderer and native Skia renderer consume the same geometry.
- `drawings/useChartDrawings` owns editing, history, serialization, and selection.
  Browser pointer/keyboard events and native gestures are thin adapters. Pointer
  movement redraws previews without refreshing the React chart tree; completed
  edits update controls and history.
- `indicatorPanes` owns per-chart order and preferred heights. Its handles use the
  same layout calculation as the rendered panes, legends, and price-axis hit tests.
- `chartLocalStorage` serializes writes by key and waits for pending writes before
  restoring a chart. Completed queue entries are removed. Existing drawing keys
  remain compatible with drawings saved before the shared/native implementation.

## Runtime ownership

Web/desktop use one JavaScript runtime for app main and background code. Browser
event listeners and resize observers belong to the mounted chart and are removed
on unmount.

On iOS/Android, main and bg initialize independently and have separate JavaScript
heaps. The drawing controller, local write queue, and indicator-pane preferences
belong to main. Native storage may share its underlying resource across runtimes;
the queue is not a cross-runtime lock. These chart-local keys have no bg writer.
Persisted settings atoms use the existing main/bg transport rather than sharing JS
objects. Native gestures and Skia use a separate worklet runtime with serialized
render snapshots; the worklet never opens storage. Skia drawing paths, paints,
and dash effects are released after each render.

## Verification

Cover persistence ordering/failure, restored editing, hidden/locked objects,
freehand previews, resized pane geometry, namespace-specific settings, fullscreen
ownership, and unmount cleanup. UI acceptance must include actual candle pixels,
resizing an indicator pane, editing a restored object, and restarting the page/app.
For native, distinguish process memory (main + bg + worklets + native resources)
from each JS heap, and
record both UI FPS and JS FPS. Development simulator measurements do not replace
release-device profiling.

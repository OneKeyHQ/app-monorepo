import { useEffect, useRef, useState } from 'react';

// REACT-NATIVE-1JZ governance:
// The L2 order-book WebSocket pushes ticks at 100+Hz. Each tick re-renders the
// OrderBook and hands a *newly built* array to the native `DepthBarColumn`
// (`@onekeyfe/react-native-perp-depth-bar`) prop. Every new array reference is
// a fresh JSI prop write into the Nitro JSICache, and at tick rate that turns
// the JSICache lock into a hot spot → JS thread saturates → main-thread ANR.
//
// `useRafCoalesced` collapses bursts of upstream updates into at most one
// emission per animation frame: the returned reference is held stable across
// every render that lands inside the same frame, so the native depth-bar prop
// is written ~once per displayed frame instead of once per tick. The eye can
// only perceive frame-rate changes anyway, so there is zero visible UX cost.
//
// IMPORTANT: only feed this the *visual* depth-bar data (percents / native
// ladder text drawn by the Nitro view). Trading-critical numbers the user
// reads (best bid/ask, mid, mark price) must keep their original, un-coalesced
// data source so they stay maximally fresh.

// Master switch for the frame-coalescing behavior. requestAnimationFrame
// already aligns emissions to the display refresh, so no millisecond constant
// is needed; kept as a named flag so the optimization is easy to toggle/audit
// for REACT-NATIVE-1JZ.
const RAF_COALESCE_ENABLED = true;

/**
 * Returns a frame-coalesced view of `value`.
 *
 * Multiple upstream updates that arrive within a single animation frame are
 * merged: the hook keeps returning the previously-emitted reference until the
 * next frame boundary, at which point it emits the latest value. This keeps the
 * reference stable for memo/JSI-prop purposes between frames while still
 * tracking the freshest value at frame rate.
 *
 * `flushKey` (optional) bypasses coalescing for "must not lag" transitions: when
 * it changes, the latest value is emitted synchronously within the same render.
 * The order book passes its depth epoch (coin / tick-size / empty<->full switch)
 * so the native view never snaps to a stale previous-frame array.
 */
export function useRafCoalesced<T>(value: T, flushKey?: unknown): T {
  const [emitted, setEmitted] = useState<T>(value);
  const latestRef = useRef<T>(value);
  const frameRef = useRef<number | null>(null);
  const prevFlushKeyRef = useRef<unknown>(flushKey);

  latestRef.current = value;

  // Resolve the value this render returns. Default to whatever was last emitted.
  let resolved = emitted;

  if (!RAF_COALESCE_ENABLED) {
    resolved = value;
  } else if (prevFlushKeyRef.current !== flushKey) {
    // flushKey changed (coin / tick / empty switch): emit the latest value
    // synchronously this render so the bars never lag the un-coalesced epoch.
    prevFlushKeyRef.current = flushKey;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    resolved = value;
  }

  // "Adjust state during render" pattern: when the resolved value diverges from
  // committed state, request a re-render so the committed value catches up.
  // React re-runs this component immediately without painting the stale state.
  if (resolved !== emitted) {
    setEmitted(resolved);
  }

  useEffect(() => {
    if (!RAF_COALESCE_ENABLED) {
      return undefined;
    }

    // Already committed this exact value — nothing to schedule.
    if (emitted === value) {
      return undefined;
    }

    // A frame is already pending; it will pick up `latestRef.current`.
    if (frameRef.current !== null) {
      return undefined;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setEmitted(latestRef.current);
    });

    return undefined;
  }, [emitted, value]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    },
    [],
  );

  return resolved;
}

import type { ITradingViewNativeSyncedViewport } from '../utils/syncedViewport';

export interface ITradingViewNativeViewportSyncMember {
  /**
   * What the leading chart shows, for this chart to line up with. Null for the
   * leading chart itself and until that chart has drawn.
   */
  getViewport: () => ITradingViewNativeSyncedViewport | null;
  /** Makes this chart the one the others follow, as the user moves it. */
  lead: () => void;
  /** Reports what this chart shows. Only the leading chart is heard. */
  publish: (viewport: ITradingViewNativeSyncedViewport) => void;
  leave: () => void;
}

export interface ITradingViewNativeViewportSyncChannel {
  hasLeader: () => boolean;
  join: (chart: {
    /** Called when the viewport this chart should line up with has changed. */
    onChange: () => void;
  }) => ITradingViewNativeViewportSyncMember;
}

/**
 * Lets the charts of a split view follow the one the user moved last. A chart
 * that lines itself up never reports back, so the charts cannot move each
 * other in circles.
 */
export function createTradingViewNativeViewportSyncChannel(): ITradingViewNativeViewportSyncChannel {
  interface IChart {
    onChange: () => void;
  }
  const charts = new Set<IChart>();
  let leader: IChart | null = null;
  let viewport: ITradingViewNativeSyncedViewport | null = null;
  return {
    hasLeader: () => leader !== null,
    join: (chart) => {
      charts.add(chart);
      return {
        getViewport: () => (leader === chart ? null : viewport),
        lead: () => {
          if (leader === chart || !charts.has(chart)) return;
          leader = chart;
          // The previous leader's viewport is not this chart's to pass on.
          viewport = null;
        },
        publish: (next) => {
          if (
            leader !== chart ||
            (viewport &&
              viewport.toTime === next.toTime &&
              viewport.rightGap === next.rightGap &&
              viewport.fromTime === next.fromTime &&
              viewport.span === next.span)
          ) {
            return;
          }
          viewport = next;
          for (const other of charts) {
            if (other !== chart) other.onChange();
          }
        },
        leave: () => {
          charts.delete(chart);
          if (leader !== chart) return;
          // The others stay where they are until one of them is moved.
          leader = null;
          viewport = null;
        },
      };
    },
  };
}

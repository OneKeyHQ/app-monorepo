import type { ITradingViewNativeSyncedViewport } from '../utils/syncedViewport';

export interface ITradingViewNativeViewportSyncMember {
  /**
   * What the leading chart shows, for this chart to line up with. Null for the
   * leading chart itself and until a chart has reported.
   */
  getViewport: () => ITradingViewNativeSyncedViewport | null;
  /** Makes this chart the one the others follow, as the user moves it. */
  lead: () => void;
  /** Reports what this chart shows. Only the leading chart is heard. */
  publish: (viewport: ITradingViewNativeSyncedViewport) => void;
  leave: () => void;
}

interface IViewportSyncChart {
  /** The first panel: it leads until the user moves a chart. */
  isMain: boolean;
  /** Called when this chart has a viewport to line up with, or to report. */
  onChange: () => void;
}

export interface ITradingViewNativeViewportSyncChannel {
  join: (chart: IViewportSyncChart) => ITradingViewNativeViewportSyncMember;
}

/**
 * Lets the charts of a split view follow the one the user moved last. A chart
 * that lines itself up never reports back, so the charts cannot move each
 * other in circles.
 */
export function createTradingViewNativeViewportSyncChannel(): ITradingViewNativeViewportSyncChannel {
  const charts = new Set<IViewportSyncChart>();
  let leader: IViewportSyncChart | null = null;
  let viewport: ITradingViewNativeSyncedViewport | null = null;
  return {
    join: (chart) => {
      charts.add(chart);
      if (!leader && chart.isMain) leader = chart;
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
          // A chart that followed it shows the same time and carries on, the
          // first panel if it is there. The viewport last reported stays, so a
          // chart that mounts meanwhile, such as this panel's next one after
          // an interval change, lines up with the others instead of leaving
          // them behind.
          leader = null;
          for (const other of charts) {
            if (other.isMain || !leader) leader = other;
          }
          if (leader) leader.onChange();
          else viewport = null;
        },
      };
    },
  };
}

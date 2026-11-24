import type { ITradingViewNativeCrosshairPosition } from '../utils/chartRuntime';

export interface ITradingViewNativeCrosshairSyncMember {
  /**
   * The crosshair of another chart for this one to follow. Its price is kept
   * only when both charts show the same instrument.
   */
  getPosition: () => ITradingViewNativeCrosshairPosition | null;
  /**
   * Shares this chart's own crosshair. Null withdraws it, which leaves a
   * crosshair another chart has shared since untouched.
   */
  publish: (position: ITradingViewNativeCrosshairPosition | null) => void;
  leave: () => void;
}

interface ICrosshairSyncChart {
  instrumentKey: string;
  /** Called when the crosshair this chart should follow has changed. */
  onChange: () => void;
}

export interface ITradingViewNativeCrosshairSyncChannel {
  join: (chart: ICrosshairSyncChart) => ITradingViewNativeCrosshairSyncMember;
}

/**
 * Carries one crosshair between the charts of a split view. Charts read the
 * current position when told it changed instead of receiving it, so a chart
 * that publishes while another is being told cannot leave any on a stale one.
 */
export function createTradingViewNativeCrosshairSyncChannel(): ITradingViewNativeCrosshairSyncChannel {
  interface IActiveCrosshair {
    chart: ICrosshairSyncChart;
    position: ITradingViewNativeCrosshairPosition;
  }
  const charts = new Set<ICrosshairSyncChart>();
  let active: IActiveCrosshair | null = null;
  const getFollowed = (
    chart: ICrosshairSyncChart,
    from: IActiveCrosshair | null,
  ): ITradingViewNativeCrosshairPosition | null =>
    from && from.chart !== chart
      ? {
          time: from.position.time,
          price:
            from.chart.instrumentKey === chart.instrumentKey
              ? from.position.price
              : null,
        }
      : null;
  const setActive = (next: IActiveCrosshair | null) => {
    const previous = active;
    active = next;
    for (const chart of charts) {
      const before = getFollowed(chart, previous);
      const after = getFollowed(chart, next);
      // A chart of another instrument has nothing to redraw for a new price.
      if (before?.time !== after?.time || before?.price !== after?.price) {
        chart.onChange();
      }
    }
  };
  return {
    join: (chart) => {
      charts.add(chart);
      return {
        getPosition: () => getFollowed(chart, active),
        publish: (position) => {
          if (!charts.has(chart)) return;
          if (!position) {
            if (active?.chart === chart) setActive(null);
            return;
          }
          if (
            active?.chart !== chart ||
            active.position.time !== position.time ||
            active.position.price !== position.price
          ) {
            setActive({ chart, position });
          }
        },
        leave: () => {
          charts.delete(chart);
          if (active?.chart === chart) setActive(null);
        },
      };
    },
  };
}

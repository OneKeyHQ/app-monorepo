import { Platform } from 'react-native';

import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export const INDICATOR_PANE_MIN_HEIGHT = 36;
const INDICATOR_PANE_MAX_HEIGHT = 2000;

export type IIndicatorPanePreferences = {
  order: string[];
  heights: Record<string, number>;
  /**
   * Chart height the saved heights were measured at. Heights are a share of
   * the chart: they grow and shrink with it, so a tall pane does not swallow a
   * smaller chart such as a split-view panel.
   */
  referenceHeight?: number;
};

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function parseIndicatorPanePreferences(
  value: string | null,
): IIndicatorPanePreferences {
  const empty = { order: [], heights: {} };
  if (!value) return empty;
  try {
    const data: unknown = JSON.parse(value);
    if (
      !data ||
      typeof data !== 'object' ||
      !('order' in data) ||
      !('heights' in data)
    )
      return empty;
    const order = Array.isArray(data.order)
      ? [
          ...new Set(
            data.order.filter(
              (id): id is string => typeof id === 'string' && id.length < 200,
            ),
          ),
        ].slice(0, 100)
      : [];
    const heights: Record<string, number> = {};
    if (data.heights && typeof data.heights === 'object') {
      for (const [id, height] of Object.entries(data.heights).slice(0, 100)) {
        if (
          typeof height === 'number' &&
          Number.isFinite(height) &&
          height >= INDICATOR_PANE_MIN_HEIGHT &&
          height <= INDICATOR_PANE_MAX_HEIGHT
        )
          heights[id] = height;
      }
    }
    const referenceHeight =
      'referenceHeight' in data &&
      isPositive(data.referenceHeight) &&
      data.referenceHeight <= 100_000
        ? data.referenceHeight
        : undefined;
    return referenceHeight === undefined
      ? { order, heights }
      : { order, heights, referenceHeight };
  } catch {
    return empty;
  }
}

/** How much saved heights stretch to fit the chart they are shown in. */
export function getIndicatorPaneHeightScale(
  referenceHeight: number | undefined,
  chartHeight: number | undefined,
) {
  return isPositive(referenceHeight) && isPositive(chartHeight)
    ? chartHeight / referenceHeight
    : 1;
}

export function arrangeIndicatorPanes(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
  preferences: IIndicatorPanePreferences,
  chartHeight?: number,
) {
  const order = [...preferences.order, ...panes.map((pane) => pane.instanceId)];
  const scale = getIndicatorPaneHeightScale(
    preferences.referenceHeight,
    chartHeight,
  );
  return panes
    .map((pane) => {
      const height = preferences.heights[pane.instanceId];
      return {
        ...pane,
        preferredHeight: Platform.select({
          ios: undefined,
          android: undefined,
          default: height === undefined ? undefined : height * scale,
        }),
      };
    })
    .toSorted(
      (a, b) => order.indexOf(a.instanceId) - order.indexOf(b.instanceId),
    );
}

/**
 * Re-measures every saved height against a new chart height, then applies the
 * heights the user just set there.
 */
export function setIndicatorPaneHeights(
  preferences: IIndicatorPanePreferences,
  heights: Record<string, number>,
  chartHeight: number | undefined,
): IIndicatorPanePreferences {
  if (!isPositive(chartHeight)) {
    return {
      ...preferences,
      heights: { ...preferences.heights, ...heights },
    };
  }
  const scale = getIndicatorPaneHeightScale(
    preferences.referenceHeight,
    chartHeight,
  );
  const rescaled: Record<string, number> = {};
  for (const [id, height] of Object.entries(preferences.heights)) {
    rescaled[id] = height * scale;
  }
  return {
    ...preferences,
    heights: { ...rescaled, ...heights },
    referenceHeight: chartHeight,
  };
}

export interface IIndicatorPaneResizeItem {
  id: string;
  top: number;
  bottom: number;
  height: number;
}

/**
 * Pane heights after dragging the boundary above pane `index` by `delta`.
 *
 * The first boundary separates the price chart from the indicators, so it
 * resizes the whole stack and every pane keeps its share. Any other boundary
 * only trades height between the two panes it separates.
 */
export function getIndicatorPaneResizeHeights({
  delta,
  index,
  minimumTop,
  panes,
}: {
  delta: number;
  index: number;
  /** Highest the first boundary may go; keeps the price chart usable. */
  minimumTop: number;
  panes: readonly IIndicatorPaneResizeItem[];
}): Record<string, number> | undefined {
  const item = panes[index];
  // A stack already squeezed below the minimum has no room to redistribute.
  if (
    !item ||
    panes.some((pane) => pane.height < INDICATOR_PANE_MIN_HEIGHT) ||
    !Number.isFinite(delta)
  ) {
    return undefined;
  }
  const heights = Object.fromEntries(
    panes.map((pane) => [pane.id, pane.height]),
  );
  if (index === 0) {
    const stackBottom = panes[panes.length - 1].bottom;
    const total = stackBottom - item.top;
    const smallest = Math.min(...panes.map((pane) => pane.height));
    // The smallest pane reaches its minimum first.
    const minimumTotal = (total * INDICATOR_PANE_MIN_HEIGHT) / smallest;
    const boundary = Math.max(
      Math.min(minimumTop, item.top),
      Math.min(stackBottom - minimumTotal, item.top + delta),
    );
    const scale = (stackBottom - boundary) / total;
    for (const pane of panes) {
      heights[pane.id] = pane.height * scale;
    }
    return heights;
  }
  const above = panes[index - 1];
  const boundary = Math.max(
    above.top + INDICATOR_PANE_MIN_HEIGHT,
    Math.min(item.bottom - INDICATOR_PANE_MIN_HEIGHT, item.top + delta),
  );
  heights[item.id] = item.bottom - boundary;
  heights[above.id] = boundary - above.top;
  return heights;
}

export function moveIndicatorPane(order: string[], id: string, target: string) {
  const sourceIndex = order.indexOf(id);
  const targetIndex = order.indexOf(target);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
    return order;
  const next = order.filter((item) => item !== id);
  next.splice(targetIndex, 0, id);
  return next;
}

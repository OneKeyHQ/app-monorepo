import { Platform } from 'react-native';

import {
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MAX_HEIGHT as INDICATOR_PANE_MAX_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MIN_HEIGHT as INDICATOR_PANE_MIN_HEIGHT,
} from '../chartConstants';
import { getTradingViewNativeSubIndicatorPaneHeights } from '../utils/subIndicatorRender/layout';

import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

// Pane heights are differences of layout offsets, so a pane at the minimum can
// measure a hair under it.
const INDICATOR_PANE_HEIGHT_TOLERANCE = 0.001;
// Larger saved sizes are not ones a chart could have produced.
const SAVED_SIZE_LIMIT = 100_000;

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
        // A height is a share of `referenceHeight`. Rebasing one saved for a
        // pane that is hidden now can take it outside the limits a pane is
        // shown at, which the layout applies.
        if (isPositive(height) && height <= SAVED_SIZE_LIMIT)
          heights[id] = height;
      }
    }
    const referenceHeight =
      'referenceHeight' in data &&
      isPositive(data.referenceHeight) &&
      data.referenceHeight <= SAVED_SIZE_LIMIT
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
 * Pane heights to save after dragging the boundary above pane `index` by
 * `delta`.
 *
 * The first boundary separates the price chart from the indicators, so it
 * resizes the whole stack the way the chart lays it out: every pane keeps its
 * share until it reaches the minimum height, and the stack stops shrinking
 * once all of them have. Any other boundary only trades height between the
 * two panes it separates.
 *
 * The heights are the ones the chart shows for them, so a pane dragged past
 * the tallest a pane is shown at is saved at that height.
 *
 * Returns nothing when the drag resizes nothing: the boundary is held where
 * it started, e.g. by the price chart's minimum height or by panes already at
 * a limit. Saving what is on show then would overwrite saved heights that only
 * look the same in this chart, e.g. one taller than the stack.
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
  if (!item || !Number.isFinite(delta)) {
    return undefined;
  }
  // Panes only go below the minimum, all of them together, in a chart too
  // short to give each one the minimum. None of them has room to give up.
  if (
    panes.some(
      (pane) =>
        pane.height <
        INDICATOR_PANE_MIN_HEIGHT - INDICATOR_PANE_HEIGHT_TOLERANCE,
    )
  ) {
    return undefined;
  }
  const stackBottom = panes[panes.length - 1].bottom;
  const above = index === 0 ? undefined : panes[index - 1];
  // The boundary stops where a pane it resizes reaches the shortest or the
  // tallest a pane is shown at, so the panes it trades between keep their
  // total and the panes of a growing stack keep their shares.
  let highest: number;
  let lowest: number;
  if (above) {
    highest = Math.max(
      above.top + INDICATOR_PANE_MIN_HEIGHT,
      item.bottom - INDICATOR_PANE_MAX_HEIGHT,
    );
    lowest = Math.min(
      item.bottom - INDICATOR_PANE_MIN_HEIGHT,
      above.top + INDICATOR_PANE_MAX_HEIGHT,
    );
  } else {
    const tallest = Math.max(...panes.map((pane) => pane.height));
    highest = Math.max(
      Math.min(minimumTop, item.top),
      stackBottom -
        ((stackBottom - item.top) * INDICATOR_PANE_MAX_HEIGHT) / tallest,
    );
    lowest = stackBottom - panes.length * INDICATOR_PANE_MIN_HEIGHT;
  }
  const boundary = Math.max(highest, Math.min(lowest, item.top + delta));
  const resized = above
    ? panes.map((pane) => {
        if (pane === item) return item.bottom - boundary;
        return pane === above ? boundary - above.top : pane.height;
      })
    : getTradingViewNativeSubIndicatorPaneHeights(
        panes.map((pane) => pane.height),
        stackBottom - boundary,
      );
  // Only rounds: the boundary already keeps every pane within these limits.
  const shown = resized.map((height) =>
    Math.min(
      INDICATOR_PANE_MAX_HEIGHT,
      Math.max(INDICATOR_PANE_MIN_HEIGHT, height),
    ),
  );
  if (
    panes.every(
      (pane, paneIndex) =>
        Math.abs(shown[paneIndex] - pane.height) <
        INDICATOR_PANE_HEIGHT_TOLERANCE,
    )
  ) {
    return undefined;
  }
  return Object.fromEntries(
    panes.map((pane, paneIndex) => [pane.id, shown[paneIndex]]),
  );
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  readChartLocalStorage,
  writeChartLocalStorage,
} from '../chartLocalStorage';

import {
  arrangeIndicatorPanes,
  moveIndicatorPane,
  parseIndicatorPanePreferences,
  setIndicatorPaneHeights,
} from './model';

import type { IIndicatorPanePreferences } from './model';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export function useIndicatorPanes(
  input: readonly ITradingViewNativeSubIndicatorRenderPane[],
  storageKey?: string,
  /** Measured chart height; saved pane heights scale with it. */
  chartHeight?: number,
) {
  const key = `trading-view-indicator-panes:v1:${storageKey ?? 'default'}`;
  const [preferences, setPreferences] = useState<IIndicatorPanePreferences>(
    () => parseIndicatorPanePreferences(null),
  );
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const current = useRef(preferences);
  current.current = preferences;
  const latestChartHeight = useRef(chartHeight);
  latestChartHeight.current = chartHeight;
  useEffect(() => {
    let active = true;
    setReadyKey(null);
    void (async () => {
      const saved = await readChartLocalStorage(key);
      if (active) {
        setPreferences(parseIndicatorPanePreferences(saved));
        setReadyKey(key);
      }
    })().catch(() => {
      if (active) {
        setPreferences(parseIndicatorPanePreferences(null));
        setReadyKey(key);
      }
    });
    return () => {
      active = false;
    };
  }, [key]);
  const commit = useCallback(
    (next: IIndicatorPanePreferences) => {
      if (readyKey !== key) return;
      current.current = next;
      setPreferences(next);
      void writeChartLocalStorage(key, JSON.stringify(next)).catch(
        () => undefined,
      );
    },
    [key, readyKey],
  );
  const panes = useMemo(
    () => arrangeIndicatorPanes(input, preferences, chartHeight),
    [chartHeight, input, preferences],
  );
  const resize = useCallback(
    (heights: Record<string, number>, finished: boolean) => {
      if (readyKey !== key) return;
      const next = setIndicatorPaneHeights(
        current.current,
        heights,
        latestChartHeight.current,
      );
      current.current = next;
      setPreferences(next);
      if (finished) commit(next);
    },
    [commit, key, readyKey],
  );
  /** The preferences before a drag, to put back if it is abandoned. */
  const snapshot = useCallback(() => current.current, []);
  const restore = useCallback((previous: IIndicatorPanePreferences) => {
    current.current = previous;
    setPreferences(previous);
  }, []);
  /** Back to the default pane heights. */
  const resetHeights = useCallback(() => {
    if (!Object.keys(current.current.heights).length) return;
    commit({ order: current.current.order, heights: {} });
  }, [commit]);
  const move = useCallback(
    (id: string, target: string) => {
      const order = moveIndicatorPane(
        panes.map((pane) => pane.instanceId),
        id,
        target,
      );
      commit({ ...current.current, order });
    },
    [commit, panes],
  );
  return {
    panes,
    resize,
    snapshot,
    restore,
    resetHeights,
    move,
    ready: readyKey === key,
  };
}

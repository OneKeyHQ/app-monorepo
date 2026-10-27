import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  readChartLocalStorage,
  writeChartLocalStorage,
} from '../chartLocalStorage';

import {
  arrangeIndicatorPanes,
  moveIndicatorPane,
  parseIndicatorPanePreferences,
} from './model';

import type { IIndicatorPanePreferences } from './model';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export function useIndicatorPanes(
  input: readonly ITradingViewNativeSubIndicatorRenderPane[],
  storageKey?: string,
) {
  const key = `trading-view-indicator-panes:v1:${storageKey ?? 'default'}`;
  const [preferences, setPreferences] = useState<IIndicatorPanePreferences>(
    () => parseIndicatorPanePreferences(null),
  );
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const current = useRef(preferences);
  current.current = preferences;
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
    () => arrangeIndicatorPanes(input, preferences),
    [input, preferences],
  );
  const resize = useCallback(
    (heights: Record<string, number>, finished: boolean) => {
      if (readyKey !== key) return;
      const next = {
        ...current.current,
        heights: { ...current.current.heights, ...heights },
      };
      current.current = next;
      setPreferences(next);
      if (finished) commit(next);
    },
    [commit, key, readyKey],
  );
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
  return { panes, resize, move, ready: readyKey === key };
}

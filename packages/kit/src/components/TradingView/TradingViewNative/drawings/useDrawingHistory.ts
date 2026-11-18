import { useEffect, useRef } from 'react';

import { indexAtTime, timeAtIndex } from './model';
import { getVolumeProfile } from './projectionGeometry';

import type { IDrawingHistoryLoader } from './drawingHistory';
import type { IDrawing, IDrawingProjection } from './model';

const HISTORY_RETRY_DELAYS_MS = [1000, 3000, 10_000];

type IHistoryEntry = {
  key: string;
  profile: NonNullable<IDrawing['volumeProfile']>;
};

type IHistoryContext = Pick<IDrawingProjection, 'points' | 'interval'>;

function getDrawingProfileRange(drawing: IDrawing, context?: IHistoryContext) {
  const start = Math.min(
    drawing.points[0].time,
    drawing.points[1]?.time ?? drawing.points[0].time,
  );
  const end = Math.max(
    drawing.points[0].time,
    drawing.points[1]?.time ?? drawing.points[0].time,
  );
  if (!context?.points.length) return { from: start, to: end };
  return {
    from: timeAtIndex(Math.round(indexAtTime(start, context)), context),
    to: timeAtIndex(Math.round(indexAtTime(end, context)) + 1, context) - 1,
  };
}

export function getDrawingProfileKey(
  drawing: IDrawing,
  context?: IHistoryContext,
) {
  if (drawing.tool !== 'volumeProfile' || drawing.points.length < 2) return '';
  const { from, to } = getDrawingProfileRange(drawing, context);
  return `${from}:${to}:${drawing.profileRows ?? 24}`;
}

export function useDrawingHistory({
  drawings,
  storageKey,
  loadHistory,
  enabled,
  redraw,
  context,
}: {
  drawings: IDrawing[];
  storageKey?: string;
  loadHistory?: IDrawingHistoryLoader;
  enabled: boolean;
  redraw: () => void;
  context?: IHistoryContext;
}) {
  const entries = useRef(new Map<string, IHistoryEntry>());
  const ranges = drawings
    .filter(
      (drawing) =>
        drawing.tool === 'volumeProfile' && drawing.points.length >= 2,
    )
    .map((drawing) => ({
      id: drawing.id,
      key: getDrawingProfileKey(drawing, context),
      ...getDrawingProfileRange(drawing, context),
      rows: drawing.profileRows ?? 24,
    }));
  const signature = JSON.stringify(ranges);
  useEffect(() => {
    entries.current.clear();
  }, [storageKey, loadHistory]);
  useEffect(() => {
    if (!enabled || !loadHistory) return undefined;
    const abort = new AbortController();
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const requested = JSON.parse(signature) as typeof ranges;
    const activeIds = new Set(requested.map((range) => range.id));
    for (const id of entries.current.keys())
      if (!activeIds.has(id)) entries.current.delete(id);
    const load = async () => {
      let hasPending = false;
      // Fetch sequentially and cache compact bins instead of copying historical candles to the UI runtime.
      for (const range of requested) {
        if (abort.signal.aborted) break;
        if (entries.current.get(range.id)?.key !== range.key) {
          let profile: IDrawing['volumeProfile'];
          try {
            const data = await loadHistory(range.from, range.to, abort.signal);
            const bins = data
              ? getVolumeProfile(data.points, range.rows)
              : null;
            if (data && bins?.length)
              profile = { bins, interval: data.interval };
          } catch {
            // Keep the chart-interval fallback when finer history is unavailable.
          }
          if (abort.signal.aborted) break;
          if (profile) {
            entries.current.set(range.id, { key: range.key, profile });
            redraw();
          } else {
            hasPending = true;
          }
        }
      }
      const retryDelay = HISTORY_RETRY_DELAYS_MS[retryAttempt];
      if (hasPending && retryDelay !== undefined && !abort.signal.aborted) {
        retryAttempt += 1;
        retryTimer = setTimeout(() => {
          void load();
        }, retryDelay);
      }
    };
    void load();
    return () => {
      abort.abort();
      clearTimeout(retryTimer);
    };
  }, [signature, storageKey, loadHistory, enabled, redraw]);
  return entries;
}

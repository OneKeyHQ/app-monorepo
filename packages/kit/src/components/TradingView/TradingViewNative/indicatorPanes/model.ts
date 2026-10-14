import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export type IIndicatorPanePreferences = {
  order: string[];
  heights: Record<string, number>;
};

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
          height >= 36 &&
          height <= 2000
        )
          heights[id] = height;
      }
    }
    return { order, heights };
  } catch {
    return empty;
  }
}

export function arrangeIndicatorPanes(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
  preferences: IIndicatorPanePreferences,
) {
  const order = [...preferences.order, ...panes.map((pane) => pane.instanceId)];
  return panes
    .map((pane) => ({
      ...pane,
      preferredHeight: preferences.heights[pane.instanceId],
    }))
    .toSorted(
      (a, b) => order.indexOf(a.instanceId) - order.indexOf(b.instanceId),
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

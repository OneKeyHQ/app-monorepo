import type {
  IMarketTradingViewLayout,
  IMarketTradingViewPanelSettings,
  IMarketTradingViewPanelSizes,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

export const TRADING_VIEW_PANEL_IDS = ['main', 'panel-2', 'panel-3', 'panel-4'];

export function normalizeTradingViewMultiChartLayout(
  layout: IMarketTradingViewLayout,
): IMarketTradingViewLayout {
  const order = Array.from(new Set(layout.panelOrder)).filter((id) =>
    TRADING_VIEW_PANEL_IDS.includes(id),
  );
  return {
    panelCount: [1, 2, 3, 4].includes(layout.panelCount)
      ? layout.panelCount
      : 1,
    panelOrder: [
      ...order,
      ...TRADING_VIEW_PANEL_IDS.filter((id) => !order.includes(id)),
    ],
    panelSettings: layout.panelSettings ?? {},
    panelSizes: layout.panelSizes,
  };
}

export function resizeTradingViewMultiChartLayout(
  layout: IMarketTradingViewLayout,
  panelCount: IMarketTradingViewLayout['panelCount'],
  defaults: IMarketTradingViewPanelSettings,
): IMarketTradingViewLayout {
  const normalized = normalizeTradingViewMultiChartLayout(layout);
  const panelSettings = { ...normalized.panelSettings };
  normalized.panelOrder.slice(0, panelCount).forEach((id) => {
    if (id !== 'main' && !panelSettings[id]) {
      panelSettings[id] = defaults;
    }
  });
  return { ...normalized, panelCount, panelSettings };
}

export function closeTradingViewPanel(
  layout: IMarketTradingViewLayout,
  panelId: string,
): IMarketTradingViewLayout {
  const normalized = normalizeTradingViewMultiChartLayout(layout);
  if (
    normalized.panelCount === 1 ||
    !normalized.panelOrder.slice(0, normalized.panelCount).includes(panelId)
  ) {
    return layout;
  }
  return {
    ...normalized,
    panelCount: (normalized.panelCount - 1) as 1 | 2 | 3,
    panelOrder: [
      ...normalized.panelOrder.filter((id) => id !== panelId),
      panelId,
    ],
  };
}

export function moveTradingViewPanel(
  layout: IMarketTradingViewLayout,
  panelId: string,
  offset: -1 | 1,
): IMarketTradingViewLayout {
  const normalized = normalizeTradingViewMultiChartLayout(layout);
  const index = normalized.panelOrder.indexOf(panelId);
  const destination = index + offset;
  if (
    index < 0 ||
    index >= normalized.panelCount ||
    destination < 0 ||
    destination >= normalized.panelCount
  ) {
    return layout;
  }
  const panelOrder = [...normalized.panelOrder];
  [panelOrder[index], panelOrder[destination]] = [
    panelOrder[destination],
    panelOrder[index],
  ];
  return { ...normalized, panelOrder };
}

export function getTradingViewPanelSizes(
  saved: IMarketTradingViewPanelSizes | undefined,
  columns: number,
  rows: number,
  availableSize?: { width: number; height: number },
): IMarketTradingViewPanelSizes {
  const normalizeSizes = (
    sizes: number[] | undefined,
    count: number,
    minimumSize: number,
    available: number,
  ) => {
    if (
      sizes?.length !== count ||
      sizes.some((size) => !Number.isFinite(size) || size <= 0)
    ) {
      return Array.from({ length: count }, () => 1 / count);
    }
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const normalized = sizes.map((size) => size / total);
    const minimum =
      available > 0 ? Math.min(minimumSize / available, 1 / count) : 0;
    if (normalized.every((size) => size >= minimum)) return normalized;
    const excess = normalized.reduce(
      (sum, size) => sum + Math.max(0, size - minimum),
      0,
    );
    return normalized.map(
      (size) =>
        minimum +
        (excess > 0
          ? (Math.max(0, size - minimum) / excess) * (1 - minimum * count)
          : 0),
    );
  };
  return {
    columns: normalizeSizes(
      saved?.columns,
      columns,
      180,
      availableSize?.width ?? 0,
    ),
    rows: normalizeSizes(saved?.rows, rows, 140, availableSize?.height ?? 0),
  };
}

export function resizeTradingViewPanelSizes({
  sizes,
  dividerIndex,
  delta,
  availableSize,
  minimumSize,
}: {
  sizes: number[];
  dividerIndex: number;
  delta: number;
  availableSize: number;
  minimumSize: number;
}): number[] {
  if (
    availableSize <= 0 ||
    dividerIndex < 0 ||
    dividerIndex >= sizes.length - 1
  ) {
    return sizes;
  }
  const total = sizes[dividerIndex] + sizes[dividerIndex + 1];
  const minimum = Math.min(minimumSize / availableSize, total / 2);
  const leading = Math.min(
    total - minimum,
    Math.max(minimum, sizes[dividerIndex] + delta / availableSize),
  );
  return sizes.map((size, index) => {
    if (index === dividerIndex) return leading;
    if (index === dividerIndex + 1) return total - leading;
    return size;
  });
}

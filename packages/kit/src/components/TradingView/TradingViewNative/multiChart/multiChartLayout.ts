import {
  TRADING_VIEW_NATIVE_MULTI_CHART_PRESETS,
  TRADING_VIEW_NATIVE_MULTI_CHART_SYNC_OPTIONS,
} from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeIndicatorSettings,
  ITradingViewNativeMultiChartLayout,
  ITradingViewNativeMultiChartPanelState,
  ITradingViewNativeMultiChartPreset,
  ITradingViewNativeMultiChartSizes,
  ITradingViewNativeMultiChartSync,
  ITradingViewNativeMultiChartSyncOption,
  ITradingViewNativeSource,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeSourceKey } from '../data/getTradingViewNativeSource';

export const TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID = 'main';

// Panel identity is positional and stable, so a panel keeps its token,
// interval and indicators when the user moves between presets.
const PANEL_IDS = [
  TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID,
  'panel-2',
  'panel-3',
  'panel-4',
] as const;

export const TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_WIDTH = 240;
export const TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_HEIGHT = 160;

export type ITradingViewNativeMultiChartAxis = 'columns' | 'rows';

interface IMultiChartCell {
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

interface IMultiChartPresetDefinition {
  columns: number;
  rows: number;
  cells: readonly IMultiChartCell[];
}

function cell(
  column: number,
  row: number,
  columnSpan = 1,
  rowSpan = 1,
): IMultiChartCell {
  return { column, row, columnSpan, rowSpan };
}

const PRESET_DEFINITIONS: Record<
  ITradingViewNativeMultiChartPreset,
  IMultiChartPresetDefinition
> = {
  '1': { columns: 1, rows: 1, cells: [cell(0, 0)] },
  '2h': { columns: 2, rows: 1, cells: [cell(0, 0), cell(1, 0)] },
  '2v': { columns: 1, rows: 2, cells: [cell(0, 0), cell(0, 1)] },
  // The first panel keeps the full height; the other two stack beside it.
  '3': {
    columns: 2,
    rows: 2,
    cells: [cell(0, 0, 1, 2), cell(1, 0), cell(1, 1)],
  },
  '4': {
    columns: 2,
    rows: 2,
    cells: [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)],
  },
};

export interface ITradingViewNativeMultiChartRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ITradingViewNativeMultiChartDivider {
  axis: ITradingViewNativeMultiChartAxis;
  /** Index of the track before the divider. */
  index: number;
  /** Fraction along the divider's own axis. */
  position: number;
  /** Fractions along the cross axis; a divider only spans the cells it splits. */
  start: number;
  end: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isTradingViewNativeMultiChartPreset(
  value: unknown,
): value is ITradingViewNativeMultiChartPreset {
  return TRADING_VIEW_NATIVE_MULTI_CHART_PRESETS.some(
    (preset) => preset === value,
  );
}

function normalizeSource(value: unknown): ITradingViewNativeSource | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'hyperliquid') {
    return isNonEmptyString(value.coin) &&
      (value.environment === 'mainnet' || value.environment === 'testnet')
      ? {
          kind: 'hyperliquid',
          coin: value.coin,
          environment: value.environment,
        }
      : undefined;
  }
  if (value.kind === 'asset') {
    return isNonEmptyString(value.assetId)
      ? { kind: 'asset', assetId: value.assetId }
      : undefined;
  }
  if (value.kind === 'stock') {
    return isNonEmptyString(value.stockId)
      ? { kind: 'stock', stockId: value.stockId }
      : undefined;
  }
  if (value.kind === 'market') {
    if (
      !isNonEmptyString(value.networkId) ||
      typeof value.tokenAddress !== 'string' ||
      typeof value.symbol !== 'string' ||
      (value.realtime !== 'disabled' && value.realtime !== 'websocket')
    ) {
      return undefined;
    }
    return {
      kind: 'market',
      networkId: value.networkId,
      tokenAddress: value.tokenAddress,
      symbol: value.symbol,
      realtime: value.realtime,
      ...(value.isNative === true ? { isNative: true } : {}),
      ...(isNonEmptyString(value.fallbackCoinGeckoId)
        ? { fallbackCoinGeckoId: value.fallbackCoinGeckoId }
        : {}),
    };
  }
  return undefined;
}

function normalizeTracks(value: unknown, count: number): number[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== count ||
    !value.every(
      (size): size is number =>
        typeof size === 'number' && Number.isFinite(size) && size > 0,
    )
  ) {
    return undefined;
  }
  const total = value.reduce((sum, size) => sum + size, 0);
  return value.map((size) => size / total);
}

function getEqualTracks(count: number) {
  return Array.from({ length: count }, () => 1 / count);
}

/** Persisted layouts are untrusted: older builds and other runtimes write them. */
export function normalizeTradingViewNativeMultiChartLayout(
  value: unknown,
): ITradingViewNativeMultiChartLayout {
  const input = isRecord(value) ? value : {};
  const panels: ITradingViewNativeMultiChartLayout['panels'] = {};
  if (isRecord(input.panels)) {
    for (const id of PANEL_IDS.slice(1)) {
      const panel = input.panels[id];
      if (isRecord(panel)) {
        const source = normalizeSource(panel.source);
        const next: ITradingViewNativeMultiChartPanelState = {};
        if (source) next.source = source;
        if (isRecord(panel.indicatorSettings)) {
          // The chart normalizes the schema itself; only the container shape
          // matters here.
          next.indicatorSettings =
            panel.indicatorSettings as ITradingViewNativeIndicatorSettings;
        }
        panels[id] = next;
      }
    }
  }
  const sizes: NonNullable<ITradingViewNativeMultiChartLayout['sizes']> = {};
  if (isRecord(input.sizes)) {
    for (const preset of TRADING_VIEW_NATIVE_MULTI_CHART_PRESETS) {
      const saved = input.sizes[preset];
      if (isRecord(saved)) {
        const definition = PRESET_DEFINITIONS[preset];
        const columns = normalizeTracks(saved.columns, definition.columns);
        const rows = normalizeTracks(saved.rows, definition.rows);
        if (columns && rows) sizes[preset] = { columns, rows };
      }
    }
  }
  const sync: ITradingViewNativeMultiChartSync = {};
  if (isRecord(input.sync)) {
    for (const option of TRADING_VIEW_NATIVE_MULTI_CHART_SYNC_OPTIONS) {
      const isSynced = input.sync[option];
      if (typeof isSynced === 'boolean') sync[option] = isSynced;
    }
  }
  return {
    preset: isTradingViewNativeMultiChartPreset(input.preset)
      ? input.preset
      : '1',
    panels,
    ...(Object.keys(sizes).length ? { sizes } : {}),
    ...(Object.keys(sync).length ? { sync } : {}),
  };
}

const NOTHING_SYNCED: Record<ITradingViewNativeMultiChartSyncOption, boolean> =
  {
    symbol: false,
    interval: false,
    crosshair: false,
    time: false,
    dateRange: false,
  };

/** Every sync option; one the user has not turned on is off. */
export function getTradingViewNativeMultiChartSync(
  layout: ITradingViewNativeMultiChartLayout,
): Record<ITradingViewNativeMultiChartSyncOption, boolean> {
  return { ...NOTHING_SYNCED, ...layout.sync };
}

export function setTradingViewNativeMultiChartSync(
  layout: ITradingViewNativeMultiChartLayout,
  option: ITradingViewNativeMultiChartSyncOption,
  isSynced: boolean,
): ITradingViewNativeMultiChartLayout {
  return getTradingViewNativeMultiChartSync(layout)[option] === isSynced
    ? layout
    : { ...layout, sync: { ...layout.sync, [option]: isSynced } };
}

export function getTradingViewNativeMultiChartPanelIds(
  preset: ITradingViewNativeMultiChartPreset,
): string[] {
  return PANEL_IDS.slice(0, PRESET_DEFINITIONS[preset].cells.length);
}

function clampTracks(tracks: number[], minimumSize: number, available: number) {
  const count = tracks.length;
  // Without a measured size there is nothing to clamp against yet.
  const minimum =
    available > 0 ? Math.min(minimumSize / available, 1 / count) : 0;
  if (tracks.every((size) => size >= minimum)) return tracks;
  const excess = tracks.reduce(
    (sum, size) => sum + Math.max(0, size - minimum),
    0,
  );
  return tracks.map(
    (size) =>
      minimum +
      (excess > 0
        ? (Math.max(0, size - minimum) / excess) * (1 - minimum * count)
        : 0),
  );
}

/** Saved track fractions, kept above the minimum panel size when it fits. */
export function getTradingViewNativeMultiChartSizes({
  availableSize,
  layout,
}: {
  availableSize?: { width: number; height: number };
  layout: ITradingViewNativeMultiChartLayout;
}): ITradingViewNativeMultiChartSizes {
  const definition = PRESET_DEFINITIONS[layout.preset];
  const saved = layout.sizes?.[layout.preset];
  return {
    columns: clampTracks(
      normalizeTracks(saved?.columns, definition.columns) ??
        getEqualTracks(definition.columns),
      TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_WIDTH,
      availableSize?.width ?? 0,
    ),
    rows: clampTracks(
      normalizeTracks(saved?.rows, definition.rows) ??
        getEqualTracks(definition.rows),
      TRADING_VIEW_NATIVE_MULTI_CHART_MIN_PANEL_HEIGHT,
      availableSize?.height ?? 0,
    ),
  };
}

function sumTracks(tracks: readonly number[], start: number, end: number) {
  let total = 0;
  for (let index = start; index < end; index += 1) {
    total += tracks[index] ?? 0;
  }
  return total;
}

function getCellRect(
  { column, row, columnSpan, rowSpan }: IMultiChartCell,
  sizes: ITradingViewNativeMultiChartSizes,
): ITradingViewNativeMultiChartRect {
  return {
    left: sumTracks(sizes.columns, 0, column),
    top: sumTracks(sizes.rows, 0, row),
    width: sumTracks(sizes.columns, column, column + columnSpan),
    height: sumTracks(sizes.rows, row, row + rowSpan),
  };
}

/** Panel rectangles as fractions of the grid, in panel order. */
export function getTradingViewNativeMultiChartRects(
  preset: ITradingViewNativeMultiChartPreset,
  sizes: ITradingViewNativeMultiChartSizes,
): ITradingViewNativeMultiChartRect[] {
  return PRESET_DEFINITIONS[preset].cells.map((item) =>
    getCellRect(item, sizes),
  );
}

export function getTradingViewNativeMultiChartEqualRects(
  preset: ITradingViewNativeMultiChartPreset,
) {
  const definition = PRESET_DEFINITIONS[preset];
  return getTradingViewNativeMultiChartRects(preset, {
    columns: getEqualTracks(definition.columns),
    rows: getEqualTracks(definition.rows),
  });
}

export function getTradingViewNativeMultiChartDividers(
  preset: ITradingViewNativeMultiChartPreset,
  sizes: ITradingViewNativeMultiChartSizes,
): ITradingViewNativeMultiChartDivider[] {
  const { cells, columns, rows } = PRESET_DEFINITIONS[preset];
  const dividers: ITradingViewNativeMultiChartDivider[] = [];
  const addDividers = (axis: ITradingViewNativeMultiChartAxis) => {
    const trackCount = axis === 'columns' ? columns : rows;
    for (let index = 0; index < trackCount - 1; index += 1) {
      // A spanning cell crosses the boundary, so the divider stops beside it.
      const rects = cells
        .filter((item) =>
          axis === 'columns'
            ? item.column + item.columnSpan - 1 === index
            : item.row + item.rowSpan - 1 === index,
        )
        .map((item) => getCellRect(item, sizes));
      if (rects.length) {
        dividers.push({
          axis,
          index,
          position: sumTracks(sizes[axis], 0, index + 1),
          start: Math.min(
            ...rects.map((rect) => (axis === 'columns' ? rect.top : rect.left)),
          ),
          end: Math.max(
            ...rects.map((rect) =>
              axis === 'columns'
                ? rect.top + rect.height
                : rect.left + rect.width,
            ),
          ),
        });
      }
    }
  };
  addDividers('columns');
  addDividers('rows');
  return dividers;
}

/** Moves one divider; only the two tracks beside it change. */
export function resizeTradingViewNativeMultiChartTracks({
  availableSize,
  delta,
  dividerIndex,
  minimumSize,
  tracks,
}: {
  availableSize: number;
  delta: number;
  dividerIndex: number;
  minimumSize: number;
  tracks: number[];
}): number[] {
  if (
    availableSize <= 0 ||
    dividerIndex < 0 ||
    dividerIndex >= tracks.length - 1
  ) {
    return tracks;
  }
  const total = tracks[dividerIndex] + tracks[dividerIndex + 1];
  const minimum = Math.min(minimumSize / availableSize, total / 2);
  const leading = Math.min(
    total - minimum,
    Math.max(minimum, tracks[dividerIndex] + delta / availableSize),
  );
  return tracks.map((size, index) => {
    if (index === dividerIndex) return leading;
    if (index === dividerIndex + 1) return total - leading;
    return size;
  });
}

export function setTradingViewNativeMultiChartSizes(
  layout: ITradingViewNativeMultiChartLayout,
  preset: ITradingViewNativeMultiChartPreset,
  sizes: ITradingViewNativeMultiChartSizes,
): ITradingViewNativeMultiChartLayout {
  return { ...layout, sizes: { ...layout.sizes, [preset]: sizes } };
}

export interface ITradingViewNativeMultiChartPanelDefaults {
  mainSource: ITradingViewNativeSource;
  indicatorSettings: ITradingViewNativeIndicatorSettings;
  getDefaultPanelSource: (params: {
    usedSources: readonly ITradingViewNativeSource[];
  }) => ITradingViewNativeSource;
}

function isPanelFilled(
  panel: ITradingViewNativeMultiChartPanelState | undefined,
) {
  return Boolean(panel?.source && panel.indicatorSettings);
}

/**
 * Whether a visible extra panel still lacks its token or its own indicator
 * settings, e.g. in a layout saved by another build.
 */
export function hasUnfilledTradingViewNativeMultiChartPanel(
  layout: ITradingViewNativeMultiChartLayout,
) {
  return getTradingViewNativeMultiChartPanelIds(layout.preset)
    .slice(1)
    .some((id) => !isPanelFilled(layout.panels[id]));
}

/**
 * Gives every visible extra panel a token and its own indicator settings. A new
 * panel starts from the main chart's indicators and then diverges; values a
 * panel already has are left alone, so re-opening a panel restores it.
 */
export function fillTradingViewNativeMultiChartPanels(
  layout: ITradingViewNativeMultiChartLayout,
  {
    getDefaultPanelSource,
    indicatorSettings,
    mainSource,
  }: ITradingViewNativeMultiChartPanelDefaults,
): ITradingViewNativeMultiChartLayout {
  const panelIds = getTradingViewNativeMultiChartPanelIds(layout.preset).slice(
    1,
  );
  const usedSources = [mainSource];
  for (const id of panelIds) {
    const source = layout.panels[id]?.source;
    if (source) usedSources.push(source);
  }
  let panels = layout.panels;
  for (const id of panelIds) {
    const panel = layout.panels[id];
    if (!isPanelFilled(panel)) {
      let source = panel?.source;
      if (!source) {
        source = getDefaultPanelSource({ usedSources });
        usedSources.push(source);
      }
      panels = {
        ...panels,
        [id]: {
          source,
          indicatorSettings: panel?.indicatorSettings ?? indicatorSettings,
        },
      };
    }
  }
  return panels === layout.panels ? layout : { ...layout, panels };
}

export function updateTradingViewNativeMultiChartPanel(
  layout: ITradingViewNativeMultiChartLayout,
  panelId: string,
  patch: ITradingViewNativeMultiChartPanelState,
): ITradingViewNativeMultiChartLayout {
  if (
    panelId === TRADING_VIEW_NATIVE_MULTI_CHART_MAIN_PANEL_ID ||
    !PANEL_IDS.some((id) => id === panelId)
  ) {
    return layout;
  }
  return {
    ...layout,
    panels: {
      ...layout.panels,
      [panelId]: { ...layout.panels[panelId], ...patch },
    },
  };
}

/**
 * Changes an extra panel's token. With `replacing`, only while the panel still
 * shows that token, so a change that lands late cannot undo a newer pick.
 */
export function setTradingViewNativeMultiChartPanelSource(
  layout: ITradingViewNativeMultiChartLayout,
  panelId: string,
  source: ITradingViewNativeSource,
  replacing?: ITradingViewNativeSource,
): ITradingViewNativeMultiChartLayout {
  const current = layout.panels[panelId]?.source;
  if (
    replacing &&
    (!current ||
      getTradingViewNativeSourceKey(current) !==
        getTradingViewNativeSourceKey(replacing))
  ) {
    return layout;
  }
  return updateTradingViewNativeMultiChartPanel(layout, panelId, { source });
}

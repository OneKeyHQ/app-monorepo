import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import type { IDeFiOverviewCell } from './hooks/useDeFiOverviewTopN';
import type { IOverviewCols } from './overviewColsResolver';

export const OVERVIEW_MORE_PREVIEW_COUNT = 3;
export const OVERVIEW_MORE_CELL_SPAN = 2 as const;

// The wallet's collapsed grid is three rows deep and its More cell two
// cells wide. A page that only needs the largest protocols at a glance asks
// for fewer rows and a More cell the size of a tile (My portfolio: one row)
export const OVERVIEW_COLLAPSED_ROWS = 3;
export type IOverviewMoreSpan = 1 | 2;

/**
 * The collapsed-state cap is `rows × cols` (3 rows unless asked otherwise),
 * leaving the trailing cells for the More button (span=2 unless asked
 * otherwise). When the protocol list overflows that cap the grid renders
 * `(rows × cols − moreSpan)` protocol tiles + 1 More cell, filling the rows
 * cleanly.
 */
export function getOverviewCellsLimit(
  cols: IOverviewCols,
  rows = OVERVIEW_COLLAPSED_ROWS,
): number {
  return rows * cols;
}

export function getOverviewVisibleCollapsed(
  cols: IOverviewCols,
  rows = OVERVIEW_COLLAPSED_ROWS,
  moreSpan: IOverviewMoreSpan = OVERVIEW_MORE_CELL_SPAN,
): number {
  return getOverviewCellsLimit(cols, rows) - moreSpan;
}

export function getOverviewCollapsedProtocolLimit({
  cols,
  protocolCount,
  rows = OVERVIEW_COLLAPSED_ROWS,
  moreSpan = OVERVIEW_MORE_CELL_SPAN,
}: {
  cols: IOverviewCols;
  protocolCount: number;
  rows?: number;
  moreSpan?: IOverviewMoreSpan;
}): number {
  const cellsLimit = getOverviewCellsLimit(cols, rows);
  return protocolCount <= cellsLimit
    ? protocolCount
    : getOverviewVisibleCollapsed(cols, rows, moreSpan);
}

export type IDeFiOverviewProtocolRenderCell = {
  kind: 'protocol';
  key: string;
  span: 1;
  protocol: IDeFiProtocol;
  protocolInfo: IProtocolSummary | undefined;
  netWorth: number;
};

export type IDeFiOverviewMoreRenderCell = {
  kind: 'more';
  key: 'more';
  span: IOverviewMoreSpan;
  extraProtocols: IDeFiProtocol[];
  extraCount: number;
};

export type IDeFiOverviewLessRenderCell = {
  kind: 'less';
  key: 'less';
  span: 1;
};

export type IDeFiOverviewRenderCell =
  | IDeFiOverviewProtocolRenderCell
  | IDeFiOverviewMoreRenderCell
  | IDeFiOverviewLessRenderCell;

function toProtocolCell(
  cell: IDeFiOverviewCell,
  protocolMap: Record<string, IProtocolSummary>,
): IDeFiOverviewProtocolRenderCell {
  const key = defiUtils.buildProtocolMapKey({
    protocol: cell.protocol.protocol,
    networkId: cell.protocol.networkId,
  });
  return {
    kind: 'protocol',
    key,
    span: 1,
    protocol: cell.protocol,
    protocolInfo: protocolMap[key],
    netWorth: cell.netWorth,
  };
}

export function buildDeFiOverviewRenderCells({
  rankedProtocols,
  protocolMap,
  isExpanded,
  cols,
  collapsedRows = OVERVIEW_COLLAPSED_ROWS,
  moreSpan = OVERVIEW_MORE_CELL_SPAN,
}: {
  rankedProtocols: IDeFiOverviewCell[];
  protocolMap: Record<string, IProtocolSummary>;
  isExpanded: boolean;
  cols: IOverviewCols;
  /** how many rows the collapsed grid keeps; the wallet's three without it */
  collapsedRows?: number;
  /** the More cell's width in cells; the wallet's two without it */
  moreSpan?: IOverviewMoreSpan;
}): IDeFiOverviewRenderCell[] {
  const toCell = (c: IDeFiOverviewCell) => toProtocolCell(c, protocolMap);

  const cellsLimit = getOverviewCellsLimit(cols, collapsedRows);
  const visibleCollapsed = getOverviewCollapsedProtocolLimit({
    cols,
    protocolCount: rankedProtocols.length,
    rows: collapsedRows,
    moreSpan,
  });

  if (rankedProtocols.length <= cellsLimit) {
    return rankedProtocols.map(toCell);
  }

  if (isExpanded) {
    return [
      ...rankedProtocols.map(toCell),
      { kind: 'less', key: 'less', span: 1 },
    ];
  }

  const visible = rankedProtocols.slice(0, visibleCollapsed);
  const hidden = rankedProtocols.slice(visibleCollapsed);

  return [
    ...visible.map(toCell),
    {
      kind: 'more',
      key: 'more',
      span: moreSpan,
      extraProtocols: hidden
        .slice(0, OVERVIEW_MORE_PREVIEW_COUNT)
        .map((c) => c.protocol),
      extraCount: hidden.length,
    },
  ];
}

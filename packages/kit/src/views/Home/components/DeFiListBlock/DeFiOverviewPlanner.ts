import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import type { IDeFiOverviewCell } from './hooks/useDeFiOverviewTopN';
import type { IOverviewCols } from './overviewColsResolver';

export const OVERVIEW_MORE_PREVIEW_COUNT = 3;
export const OVERVIEW_MORE_CELL_SPAN = 2;

/**
 * The collapsed-state cap is `3 × cols`, leaving exactly two trailing
 * cells for the More button (span=2). When the protocol list overflows
 * that cap the grid renders `(3 × cols − OVERVIEW_MORE_CELL_SPAN)`
 * protocol tiles + 1 More cell, filling 3 rows cleanly.
 */
export function getOverviewCellsLimit(cols: IOverviewCols): number {
  return 3 * cols;
}

export function getOverviewVisibleCollapsed(cols: IOverviewCols): number {
  return getOverviewCellsLimit(cols) - OVERVIEW_MORE_CELL_SPAN;
}

export function getOverviewCollapsedProtocolLimit({
  cols,
  protocolCount,
}: {
  cols: IOverviewCols;
  protocolCount: number;
}): number {
  const cellsLimit = getOverviewCellsLimit(cols);
  return protocolCount <= cellsLimit
    ? protocolCount
    : getOverviewVisibleCollapsed(cols);
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
  span: 2;
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
}: {
  rankedProtocols: IDeFiOverviewCell[];
  protocolMap: Record<string, IProtocolSummary>;
  isExpanded: boolean;
  cols: IOverviewCols;
}): IDeFiOverviewRenderCell[] {
  const toCell = (c: IDeFiOverviewCell) => toProtocolCell(c, protocolMap);

  const cellsLimit = getOverviewCellsLimit(cols);
  const visibleCollapsed = getOverviewCollapsedProtocolLimit({
    cols,
    protocolCount: rankedProtocols.length,
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
      span: 2,
      extraProtocols: hidden
        .slice(0, OVERVIEW_MORE_PREVIEW_COUNT)
        .map((c) => c.protocol),
      extraCount: hidden.length,
    },
  ];
}

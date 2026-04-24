import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { roundToOneDecimal } from './DeFiPortfolioStats';

import type { IDeFiOverviewCell } from './hooks/useDeFiOverviewTopN';

export const OVERVIEW_COLLAPSED_PROTOCOL_COUNT = 10;
export const OVERVIEW_MORE_PREVIEW_COUNT = 3;

export type IDeFiOverviewProtocolRenderCell = {
  kind: 'protocol';
  key: string;
  span: 1;
  protocol: IDeFiProtocol;
  protocolInfo: IProtocolSummary | undefined;
  netWorth: number;
  percent: number | undefined;
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
  exposureTotal: number,
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
    percent:
      exposureTotal > 0
        ? roundToOneDecimal((Math.abs(cell.netWorth) / exposureTotal) * 100)
        : undefined,
  };
}

export function buildDeFiOverviewRenderCells({
  rankedProtocols,
  protocolMap,
  isExpanded,
  exposureTotal,
}: {
  rankedProtocols: IDeFiOverviewCell[];
  protocolMap: Record<string, IProtocolSummary>;
  isExpanded: boolean;
  exposureTotal: number;
}): IDeFiOverviewRenderCell[] {
  const toCell = (c: IDeFiOverviewCell) =>
    toProtocolCell(c, protocolMap, exposureTotal);

  if (rankedProtocols.length <= OVERVIEW_COLLAPSED_PROTOCOL_COUNT) {
    return rankedProtocols.map(toCell);
  }

  if (isExpanded) {
    return [
      ...rankedProtocols.map(toCell),
      { kind: 'less', key: 'less', span: 1 },
    ];
  }

  const visible = rankedProtocols.slice(0, OVERVIEW_COLLAPSED_PROTOCOL_COUNT);
  const hidden = rankedProtocols.slice(OVERVIEW_COLLAPSED_PROTOCOL_COUNT);

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

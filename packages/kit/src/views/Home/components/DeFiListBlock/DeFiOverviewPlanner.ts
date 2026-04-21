import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

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
}: {
  rankedProtocols: IDeFiOverviewCell[];
  protocolMap: Record<string, IProtocolSummary>;
  isExpanded: boolean;
}): IDeFiOverviewRenderCell[] {
  const toCell = (c: IDeFiOverviewCell) => toProtocolCell(c, protocolMap);

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

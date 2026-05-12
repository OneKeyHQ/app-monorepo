import { XStack } from '@onekeyhq/components';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { buildOverviewGridStyle } from './DeFiOverviewLayout';
import { DeFiOverviewLessTile } from './DeFiOverviewLessTile';
import { DeFiOverviewMoreTile } from './DeFiOverviewMoreTile';
import { DeFiOverviewTile } from './DeFiOverviewTile';

import type { IDeFiOverviewRenderCell } from './DeFiOverviewPlanner';
import type { IOverviewCols } from './overviewColsResolver';

const SPAN_1: React.CSSProperties = { gridColumnEnd: 'span 1' };
const SPAN_2: React.CSSProperties = { gridColumnEnd: 'span 2' };

export type IDeFiOverviewDesktopGridProps = {
  cells: IDeFiOverviewRenderCell[];
  cols: IOverviewCols;
  protocolMap: Record<string, IProtocolSummary>;
  onPressProtocol: (protocol: IDeFiProtocol) => void;
  onPressMore: () => void;
  onPressLess: () => void;
  isAllNetworks?: boolean;
};

function DeFiOverviewDesktopGrid({
  cells,
  cols,
  protocolMap,
  onPressProtocol,
  onPressMore,
  onPressLess,
  isAllNetworks,
}: IDeFiOverviewDesktopGridProps) {
  return (
    <XStack width="100%" gap="$2" style={buildOverviewGridStyle(cols)}>
      {cells.map((cell) => (
        <XStack
          key={cell.key}
          minWidth={0}
          style={cell.span === 2 ? SPAN_2 : SPAN_1}
        >
          {cell.kind === 'protocol' ? (
            <DeFiOverviewTile
              protocol={cell.protocol}
              protocolInfo={cell.protocolInfo}
              netWorth={cell.netWorth}
              onPress={() => onPressProtocol(cell.protocol)}
              isAllNetworks={isAllNetworks}
            />
          ) : null}
          {cell.kind === 'more' ? (
            <DeFiOverviewMoreTile
              extraProtocols={cell.extraProtocols}
              protocolMap={protocolMap}
              extraCount={cell.extraCount}
              onPress={onPressMore}
            />
          ) : null}
          {cell.kind === 'less' ? (
            <DeFiOverviewLessTile onPress={onPressLess} />
          ) : null}
        </XStack>
      ))}
    </XStack>
  );
}

DeFiOverviewDesktopGrid.displayName = 'DeFiOverviewDesktopGrid';

export { DeFiOverviewDesktopGrid };

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
import type { IDeFiOverviewTileSurface } from './DeFiOverviewTile';
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
  /** see IDeFiOverviewTileSurface; the wallet's look without it */
  tileSurface?: IDeFiOverviewTileSurface;
  /** beside a tile's name, what tells it from another of the same name */
  renderNameAccessory?: (protocol: IDeFiProtocol) => React.ReactNode;
};

function DeFiOverviewDesktopGrid({
  cells,
  cols,
  protocolMap,
  onPressProtocol,
  onPressMore,
  onPressLess,
  isAllNetworks,
  tileSurface,
  renderNameAccessory,
}: IDeFiOverviewDesktopGridProps) {
  return (
    <XStack
      width="100%"
      gap="$4"
      rowGap="$5"
      style={buildOverviewGridStyle(cols)}
    >
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
              surface={tileSurface}
              nameAccessory={renderNameAccessory?.(cell.protocol)}
            />
          ) : null}
          {cell.kind === 'more' ? (
            <DeFiOverviewMoreTile
              extraProtocols={cell.extraProtocols}
              protocolMap={protocolMap}
              extraCount={cell.extraCount}
              onPress={onPressMore}
              surface={tileSurface}
              compact={cell.span === 1}
            />
          ) : null}
          {cell.kind === 'less' ? (
            <DeFiOverviewLessTile onPress={onPressLess} surface={tileSurface} />
          ) : null}
        </XStack>
      ))}
    </XStack>
  );
}

DeFiOverviewDesktopGrid.displayName = 'DeFiOverviewDesktopGrid';

export { DeFiOverviewDesktopGrid };

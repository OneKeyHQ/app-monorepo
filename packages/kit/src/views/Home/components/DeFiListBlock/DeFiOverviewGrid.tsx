import { memo, useCallback, useMemo, useRef } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';
import { useDeFiListSlicedAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { DeFiOverviewDesktopGrid } from './DeFiOverviewDesktopGrid';
import { buildOverviewGridStyle } from './DeFiOverviewLayout';
import { buildDeFiOverviewRenderCells } from './DeFiOverviewPlanner';
import { useDeFiOverviewTopN } from './hooks/useDeFiOverviewTopN';

import type { IOverviewCols } from './overviewColsResolver';

/**
 * Approximates the rendered DeFiOverviewTile height: 36 px logo +
 * py="$3.5" (= 14 px each side) + a 2-line text stack (name + value
 * with a $1 gap). Kept ~2 px under the natural height so it never
 * looks taller than reality on load — undershoot is invisible,
 * overshoot causes layout reflow.
 */
const SKELETON_TILE_HEIGHT = 68;
/**
 * Skeleton row count is a hedge, not a prediction: we don't know how
 * many protocols are coming until the fetch lands. Two rows reads as
 * "the typical wallet is loading" without claiming more cells than
 * exist — most users have 4 to 8 protocols, well under the 3*cols
 * ceiling the bento grid can grow to. Real data drives the eventual
 * grid; the skeleton merely warms up the area.
 */
const SKELETON_ROWS = 2;

const OVERVIEW_TOGGLE_PRESS_LOCK_MS = 600;

export type IDeFiOverviewGridProps = {
  cols: IOverviewCols;
  protocols: IDeFiProtocol[] | undefined;
  protocolMap: Record<string, IProtocolSummary>;
  isLoading?: boolean;
  isAllNetworks?: boolean;
  getNetWorth: (p: IDeFiProtocol) => number;
  onPressProtocol: (p: IDeFiProtocol) => void;
};

function DeFiOverviewGrid({
  cols,
  protocols,
  protocolMap,
  isLoading,
  isAllNetworks,
  getNetWorth,
  onPressProtocol,
}: IDeFiOverviewGridProps) {
  const [isSliced, setIsSliced] = useDeFiListSlicedAtom();
  const isExpanded = !isSliced;

  const rankedProtocols = useDeFiOverviewTopN(protocols, getNetWorth);

  const cells = useMemo(
    () =>
      buildDeFiOverviewRenderCells({
        rankedProtocols,
        protocolMap,
        isExpanded,
        cols,
      }),
    [rankedProtocols, protocolMap, isExpanded, cols],
  );

  const pressLockUntilRef = useRef(0);
  const isPressLocked = useCallback(
    () => pressLockUntilRef.current > Date.now(),
    [],
  );
  const lockPress = useCallback(() => {
    pressLockUntilRef.current = Date.now() + OVERVIEW_TOGGLE_PRESS_LOCK_MS;
  }, []);
  const handleMore = useCallback(() => {
    if (isPressLocked()) return;
    setIsSliced(false);
    lockPress();
  }, [setIsSliced, lockPress, isPressLocked]);
  const handleLess = useCallback(() => {
    if (isPressLocked()) return;
    setIsSliced(true);
    lockPress();
  }, [setIsSliced, lockPress, isPressLocked]);
  const handleProtocolPress = useCallback(
    (p: IDeFiProtocol) => {
      if (isPressLocked()) return;
      onPressProtocol(p);
    },
    [onPressProtocol, isPressLocked],
  );

  if (isLoading) {
    const skeletonCount = cols * SKELETON_ROWS;
    // Tamagui's $gtMd prop is typed against StackStyle (which doesn't allow
    // `display: 'grid'`). Cast through `unknown` so we can pass a CSS-grid
    // template object without spreading `any` into the call site.
    const gridStyle = buildOverviewGridStyle(cols) as unknown as Record<
      string,
      unknown
    >;
    return (
      <XStack width="100%" flexWrap="wrap" gap="$2" $gtMd={gridStyle}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <XStack
            // eslint-disable-next-line react/no-array-index-key
            key={`defi-overview-skeleton-${i}`}
            minWidth={0}
            flex={1}
          >
            <Skeleton height={SKELETON_TILE_HEIGHT} radius={12} flex={1} />
          </XStack>
        ))}
      </XStack>
    );
  }

  if (!protocols || rankedProtocols.length < 2) {
    return null;
  }

  return (
    <DeFiOverviewDesktopGrid
      cells={cells}
      cols={cols}
      protocolMap={protocolMap}
      onPressProtocol={handleProtocolPress}
      onPressMore={handleMore}
      onPressLess={handleLess}
      isAllNetworks={isAllNetworks}
    />
  );
}

DeFiOverviewGrid.displayName = 'DeFiOverviewGrid';

const MemoDeFiOverviewGrid = memo(DeFiOverviewGrid);
MemoDeFiOverviewGrid.displayName = 'DeFiOverviewGrid';

export { MemoDeFiOverviewGrid as DeFiOverviewGrid };

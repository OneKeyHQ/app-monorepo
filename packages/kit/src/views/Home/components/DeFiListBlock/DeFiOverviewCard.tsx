import { memo, useCallback, useMemo, useRef } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';
import { useDeFiListSlicedAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { OVERVIEW_TOP_N } from '../../types';

import {
  DeFiOverviewDesktopGrid,
  OVERVIEW_GRID_STYLE,
} from './DeFiOverviewDesktopGrid';
import { buildDeFiOverviewRenderCells } from './DeFiOverviewPlanner';
import { useDeFiOverviewTopN } from './hooks/useDeFiOverviewTopN';

// Window after any tile tap during which further taps are ignored. Prevents
// a second quick click from landing on a newly-revealed tile during the
// More/Less layout shift (deep-linking into a protocol accidentally) and
// also kills rapid More↔Less double-toggle.
const OVERVIEW_TOGGLE_PRESS_LOCK_MS = 600;

export type IDeFiOverviewCardProps = {
  protocols: IDeFiProtocol[] | undefined;
  protocolMap: Record<string, IProtocolSummary>;
  isLoading?: boolean;
  isAllNetworks?: boolean;
  getNetWorth: (p: IDeFiProtocol) => number;
  onPressProtocol: (p: IDeFiProtocol) => void;
};

const SKELETON_TILE_HEIGHT = 60;

function DeFiOverviewCard({
  protocols,
  protocolMap,
  isLoading,
  isAllNetworks,
  getNetWorth,
  onPressProtocol,
}: IDeFiOverviewCardProps) {
  const [isSliced, setIsSliced] = useDeFiListSlicedAtom();
  const isExpanded = !isSliced;

  const rankedProtocols = useDeFiOverviewTopN(protocols, getNetWorth);
  const overviewExposureTotal = useMemo(
    () =>
      rankedProtocols.reduce((acc, cell) => acc + Math.abs(cell.netWorth), 0),
    [rankedProtocols],
  );

  const cells = useMemo(
    () =>
      buildDeFiOverviewRenderCells({
        rankedProtocols,
        protocolMap,
        isExpanded,
        exposureTotal: overviewExposureTotal,
      }),
    [rankedProtocols, protocolMap, isExpanded, overviewExposureTotal],
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
    return (
      <XStack width="100%" flexWrap="wrap" gap="$2" $gtMd={OVERVIEW_GRID_STYLE}>
        {Array.from({ length: OVERVIEW_TOP_N }).map((_, i) => (
          <XStack
            // eslint-disable-next-line react/no-array-index-key
            key={`defi-overview-skeleton-${i}`}
            minWidth={0}
            flex={1}
          >
            <Skeleton
              height={SKELETON_TILE_HEIGHT}
              borderRadius="$3"
              flex={1}
            />
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
      protocolMap={protocolMap}
      onPressProtocol={handleProtocolPress}
      onPressMore={handleMore}
      onPressLess={handleLess}
      isAllNetworks={isAllNetworks}
    />
  );
}

// Memoized: same reason as DeFiPortfolioCard — sticky scroll updates in
// DeFiContainer re-render this tree every rAF frame otherwise. 10+ tile
// children skip re-render when props haven't changed.
const MemoDeFiOverviewCard = memo(DeFiOverviewCard);
MemoDeFiOverviewCard.displayName = 'DeFiOverviewCard';

export { MemoDeFiOverviewCard as DeFiOverviewCard };

import { useCallback, useMemo, useRef } from 'react';

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

import type { IPortfolioStats } from './DeFiPortfolioStats';

// Window after a More/Less toggle during which protocol-tile taps are
// ignored. Prevents a second quick click from landing on a newly-revealed
// tile during the layout shift and accidentally deep-linking into its
// protocol detail page.
const OVERVIEW_TOGGLE_PRESS_LOCK_MS = 400;

export type IDeFiOverviewCardProps = {
  stats: IPortfolioStats;
  protocols: IDeFiProtocol[] | undefined;
  protocolMap: Record<string, IProtocolSummary>;
  isLoading?: boolean;
  isAllNetworks?: boolean;
  getNetWorth: (p: IDeFiProtocol) => number;
  onPressProtocol: (p: IDeFiProtocol) => void;
};

const SKELETON_TILE_HEIGHT = 60;

function DeFiOverviewCard({
  stats,
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

  const cells = useMemo(
    () =>
      buildDeFiOverviewRenderCells({
        rankedProtocols,
        protocolMap,
        isExpanded,
        total: stats.total,
      }),
    [rankedProtocols, protocolMap, isExpanded, stats.total],
  );

  const pressLockUntilRef = useRef(0);
  const lockPress = useCallback(() => {
    pressLockUntilRef.current = Date.now() + OVERVIEW_TOGGLE_PRESS_LOCK_MS;
  }, []);
  const handleMore = useCallback(() => {
    setIsSliced(false);
    lockPress();
  }, [setIsSliced, lockPress]);
  const handleLess = useCallback(() => {
    setIsSliced(true);
    lockPress();
  }, [setIsSliced, lockPress]);
  const handleProtocolPress = useCallback(
    (p: IDeFiProtocol) => {
      if (pressLockUntilRef.current > Date.now()) return;
      onPressProtocol(p);
    },
    [onPressProtocol],
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

export { DeFiOverviewCard };

import { useMemo } from 'react';

import { Skeleton, XStack } from '@onekeyhq/components';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { useDeFiListSlicedAtom } from '../../../../states/jotai/contexts/deFiList';
import { OVERVIEW_TOP_N } from '../../types';

import {
  DeFiOverviewDesktopGrid,
  OVERVIEW_GRID_STYLE,
} from './DeFiOverviewDesktopGrid';
import { buildDeFiOverviewRenderCells } from './DeFiOverviewPlanner';
import { useDeFiOverviewTopN } from './hooks/useDeFiOverviewTopN';

export type IDeFiOverviewCardProps = {
  protocols: IDeFiProtocol[] | undefined;
  protocolMap: Record<string, IProtocolSummary>;
  isLoading?: boolean;
  getNetWorth: (p: IDeFiProtocol) => number;
  onPressProtocol: (p: IDeFiProtocol) => void;
};

const SKELETON_TILE_HEIGHT = 60;

function DeFiOverviewCard({
  protocols,
  protocolMap,
  isLoading,
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
      }),
    [rankedProtocols, protocolMap, isExpanded],
  );

  const handleMore = () => setIsSliced(false);
  const handleLess = () => setIsSliced(true);

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
      onPressProtocol={onPressProtocol}
      onPressMore={handleMore}
      onPressLess={handleLess}
    />
  );
}

export { DeFiOverviewCard };

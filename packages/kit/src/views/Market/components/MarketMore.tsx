import { memo, useCallback, useMemo } from 'react';

import { ActionList, IconButton } from '@onekeyhq/components';

import { useWatchListAction } from './wachListHooks';

function BasicMarketMore({ coingeckoId }: { coingeckoId: string }) {
  const actions = useWatchListAction();
  const handleRemove = useCallback(async () => {
    await actions.removeFormWatchList(coingeckoId);
  }, [actions, coingeckoId]);
  const MoveToTop = useCallback(async () => {
    await actions.MoveToTop(coingeckoId);
  }, [actions, coingeckoId]);
  const sections = useMemo(
    () => [
      {
        items: [
          {
            destructive: true,
            icon: 'DeleteOutline',
            label: 'Remove from Favorites',
            onPress: handleRemove,
          },
          {
            icon: 'ChevronTopSmallOutline',
            label: 'Move to Top',
            onPress: MoveToTop,
          },
        ],
      },
    ],
    [MoveToTop, handleRemove],
  );
  return (
    <ActionList
      title=""
      renderTrigger={
        <IconButton
          icon="DotHorOutline"
          variant="tertiary"
          mx="$3"
          iconSize="$5"
        />
      }
      sections={sections}
    />
  );
}

export const MarketMore = memo(BasicMarketMore);

import { memo, useCallback, useMemo } from 'react';

import type { IActionListItemProps, IStackProps } from '@onekeyhq/components';
import { ActionList, IconButton } from '@onekeyhq/components';

import { useWatchListAction } from './wachListHooks';

function BasicMarketMore({
  coingeckoId,
  ...props
}: { coingeckoId: string } & IStackProps) {
  const actions = useWatchListAction();
  const handleRemove = useCallback(() => {
    actions.removeFormWatchList(coingeckoId);
  }, [actions, coingeckoId]);
  const MoveToTop = useCallback(() => {
    actions.MoveToTop(coingeckoId);
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
            icon: 'ArrowTopOutline',
            label: 'Move to Top',
            onPress: MoveToTop,
          },
        ] as IActionListItemProps[],
      },
    ],
    [MoveToTop, handleRemove],
  );
  return (
    <ActionList
      title=""
      renderTrigger={
        <IconButton
          icon="DotVerSolid"
          variant="tertiary"
          iconSize="$5"
          {...props}
        />
      }
      sections={sections}
    />
  );
}

export const MarketMore = memo(BasicMarketMore);

import { memo, useCallback, useMemo } from 'react';

import { IconButton } from '@onekeyhq/components';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { useWatchListAction } from './wachListHooks';

function BasicMarketStar({ coingeckoId }: { coingeckoId: string }) {
  const actions = useWatchListAction();

  const { result: isChecked } = usePromiseResult(
    () => actions.isInWatchList(coingeckoId),
    [actions, coingeckoId],
  );

  const handlePress = useCallback(() => {
    if (isChecked) {
      actions.removeFormWatchList(coingeckoId);
    } else {
      actions.addIntoWatchList(coingeckoId);
    }
  }, [actions, coingeckoId, isChecked]);

  return (
    <IconButton
      icon={isChecked ? 'StarSolid' : 'StarOutline'}
      color="red"
      variant="tertiary"
      iconSize="$5"
      mx="$3"
      onPress={handlePress}
    />
  );
}

export const MarketStar = memo(BasicMarketStar);

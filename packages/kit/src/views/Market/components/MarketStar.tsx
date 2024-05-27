import { memo, useCallback, useState } from 'react';

import { IconButton } from '@onekeyhq/components';

import { useWatchListAction } from './wachListHooks';

function BasicMarketStar({ coingeckoId }: { coingeckoId: string }) {
  const actions = useWatchListAction();

  const [checked, setIsChecked] = useState(() =>
    actions.isInWatchList(coingeckoId),
  );

  const handlePress = useCallback(() => {
    if (checked) {
      actions.removeFormWatchList(coingeckoId);
    } else {
      actions.addIntoWatchList(coingeckoId);
    }
    setIsChecked(!checked);
  }, [actions, coingeckoId, checked]);

  return (
    <IconButton
      icon={checked ? 'StarSolid' : 'StarOutline'}
      color="red"
      variant="tertiary"
      iconSize="$5"
      mx="$3"
      onPress={handlePress}
    />
  );
}

export const MarketStar = memo(BasicMarketStar);

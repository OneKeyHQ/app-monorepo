import { memo, useCallback, useMemo } from 'react';

import { IconButton } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useMarketWatchListPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function BasicMarketStar({ coingeckoId }: { coingeckoId: string }) {
  const [{ items: coingeckoIds }] = useMarketWatchListPersistAtom();

  const isChecked = useMemo(
    () => !!coingeckoIds.find((i) => i.coingeckoId === coingeckoId),
    [coingeckoId, coingeckoIds],
  );
  const handlePress = useCallback(() => {
    const item = {
      coingeckoId,
    };
    if (isChecked) {
      void backgroundApiProxy.serviceMarket.removeFormWatchList(item);
    } else {
      void backgroundApiProxy.serviceMarket.addIntoWatchList(item);
    }
  }, [coingeckoId, isChecked]);

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

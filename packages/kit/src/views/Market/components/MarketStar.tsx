import { memo, useCallback, useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import type { IStackProps } from '@onekeyhq/components';
import { IconButton } from '@onekeyhq/components';

import { useWatchListAction } from './wachListHooks';

function BasicMarketStar({
  coingeckoId,
  ...props
}: {
  coingeckoId: string;
} & IStackProps) {
  const actions = useWatchListAction();

  const [checked, setIsChecked] = useState(() =>
    actions.isInWatchList(coingeckoId),
  );

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      setIsChecked(actions.isInWatchList(coingeckoId));
    }
  }, [actions, coingeckoId, isFocused]);

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
      onPress={handlePress}
      {...props}
    />
  );
}

export const MarketStar = memo(BasicMarketStar);

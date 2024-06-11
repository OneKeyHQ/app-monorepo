import { memo, useCallback, useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';

import type { IIconButtonProps, IStackProps } from '@onekeyhq/components';
import { IconButton } from '@onekeyhq/components';

import { useWatchListAction } from './wachListHooks';

function BasicMarketStar({
  coingeckoId,
  size,
  ...props
}: {
  coingeckoId: string;
} & IStackProps & {
    size?: IIconButtonProps['size'];
  }) {
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
      variant="tertiary"
      size={size}
      iconSize={size ? undefined : '$5'}
      iconProps={{
        color: checked ? '$iconActive' : '$iconDisabled',
      }}
      onPress={handlePress}
      {...props}
    />
  );
}

export const MarketStar = memo(BasicMarketStar);

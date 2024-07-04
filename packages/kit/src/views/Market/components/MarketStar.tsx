import { memo, useCallback, useEffect, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IIconButtonProps, IStackProps } from '@onekeyhq/components';
import { IconButton, useMedia } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useWatchListAction } from './wachListHooks';

function BasicMarketStar({
  coingeckoId,
  size,
  tabIndex,
  ...props
}: {
  tabIndex?: number;
  size?: IIconButtonProps['size'];
  coingeckoId: string;
} & IStackProps) {
  const intl = useIntl();
  const actions = useWatchListAction();

  const [checked, setIsChecked] = useState(() =>
    actions.isInWatchList(coingeckoId),
  );

  const isFocused = useIsFocused();

  const { gtMd } = useMedia();

  const onSwitchMarketHomeTabCallback = useCallback(
    ({ tabIndex: currentTabIndex }: { tabIndex: number }) => {
      if (currentTabIndex === tabIndex) {
        setIsChecked(actions.isInWatchList(coingeckoId));
      }
    },
    [actions, coingeckoId, tabIndex],
  );

  useEffect(() => {
    if (gtMd && tabIndex) {
      appEventBus.on(
        EAppEventBusNames.SwitchMarketHomeTab,
        onSwitchMarketHomeTabCallback,
      );
      return () => {
        appEventBus.off(
          EAppEventBusNames.SwitchMarketHomeTab,
          onSwitchMarketHomeTabCallback,
        );
      };
    }
  }, [gtMd, onSwitchMarketHomeTabCallback, tabIndex]);

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
      title={intl.formatMessage({
        id: checked
          ? ETranslations.market_remove_from_watchlist
          : ETranslations.market_add_to_watchlist,
      })}
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

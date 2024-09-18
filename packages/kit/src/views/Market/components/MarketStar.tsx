import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IIconButtonProps, IStackProps } from '@onekeyhq/components';
import { IconButton, useMedia } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';

import { useWatchListAction } from './wachListHooks';

function BasicMarketStar({
  coingeckoId,
  size,
  tabIndex,
  from,
  ...props
}: {
  tabIndex?: number;
  size?: IIconButtonProps['size'];
  coingeckoId: string;
  from: EWatchlistFrom;
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
      defaultLogger.market.token.removeFromWatchlist({
        tokenSymbol: coingeckoId,
        removeWatchlistFrom: from,
      });
    } else {
      actions.addIntoWatchList(coingeckoId);
      defaultLogger.market.token.addToWatchList({
        tokenSymbol: coingeckoId,
        addWatchlistFrom: from,
      });
    }
    setIsChecked(!checked);
  }, [checked, actions, coingeckoId, from]);

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

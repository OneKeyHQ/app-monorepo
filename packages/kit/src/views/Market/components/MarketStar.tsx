import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconButtonProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import { IconButton, useMedia } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';

import { useWatchListAction } from './watchListHooks';

export const useStarChecked = ({
  coingeckoId,
  tabIndex,
  from,
}: {
  coingeckoId: string;
  tabIndex?: number;
  from: EWatchlistFrom;
}) => {
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

  const handlePress = useCallback(async () => {
    if (checked) {
      actions.removeFormWatchList(coingeckoId);
      defaultLogger.market.token.removeFromWatchlist({
        tokenSymbol: coingeckoId,
        removeWatchlistFrom: from,
      });
    } else {
      await actions.addIntoWatchList(coingeckoId);
      defaultLogger.market.token.addToWatchList({
        tokenSymbol: coingeckoId,
        addWatchlistFrom: from,
      });
    }
    setIsChecked(!checked);
  }, [checked, actions, coingeckoId, from]);
  return useMemo(
    () => ({
      checked,
      setIsChecked,
      onPress: handlePress,
    }),
    [checked, handlePress],
  );
};

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
  const { onPress, checked } = useStarChecked({
    tabIndex,
    coingeckoId,
    from,
  });

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
      onPress={onPress}
      {...(props as IXStackProps)}
    />
  );
}

export const MarketStar = memo(BasicMarketStar);

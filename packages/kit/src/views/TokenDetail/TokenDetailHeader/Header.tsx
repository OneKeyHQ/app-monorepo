import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ButtonSize, ButtonType } from '@onekeyhq/components/src/Button';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useMarketTokenItem } from '../../Market/hooks/useMarketToken';

export const FavoritedButton: FC<{
  coingeckoId?: string;
  size?: ButtonSize;
  type?: ButtonType;
  circle?: boolean;
}> = ({ coingeckoId, size, type, circle }) => {
  const intl = useIntl();

  const marketTokenItem = useMarketTokenItem({
    coingeckoId,
  });

  const isDisabled = typeof marketTokenItem === 'undefined';
  // if (isDisabled && isVerticalLayout) {
  //   return null;
  // }
  let iconColor: ThemeToken = marketTokenItem?.favorited
    ? 'icon-warning'
    : 'icon-default';
  if (isDisabled) {
    iconColor = 'icon-disabled';
  }
  return (
    <IconButton
      isDisabled={isDisabled}
      name={marketTokenItem?.favorited ? 'StarSolid' : 'StarOutline'}
      circle={circle}
      iconColor={iconColor}
      onPress={() => {
        if (marketTokenItem) {
          if (marketTokenItem.favorited) {
            backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
              marketTokenItem.coingeckoId,
            );
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__removed' }),
            });
          } else {
            backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
              {
                coingeckoId: marketTokenItem.coingeckoId,
                symbol: marketTokenItem.symbol,
              },
            ]);
            ToastManager.show({
              title: intl.formatMessage({ id: 'msg__added_to_favorites' }),
            });
          }
        }
      }}
      size={size}
      type={type}
    />
  );
};

export const TokenDetailHeader = () => {
  const isVertical = useIsVerticalLayout();

  if (isVertical) {
    return <FavoritedButton />;
  }
  return null;
};

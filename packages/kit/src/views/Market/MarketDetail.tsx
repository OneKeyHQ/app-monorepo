/* eslint-disable react/no-unstable-nested-components */
import type { FC, ReactElement } from 'react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  ToastManager,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useTokenSupportStakedAssets } from '../../hooks/useTokens';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes, TabRoutes } from '../../routes/types';
import { StakingRoutes } from '../Staking/typing';

import MarketDetailContent from './Components/MarketDetail/MarketDetailContent';
import { useMarketDetail } from './hooks/useMarketDetail';
import { useMarketTokenItem } from './hooks/useMarketToken';

import type { FiatPayModalRoutesParams } from '../../routes/Modal/FiatPay';
import type {
  HomeRoutes,
  HomeRoutesParams,
  ModalScreenProps,
  TabRoutesParams,
} from '../../routes/types';
import type { MarketTokenItem } from '../../store/reducers/market';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.MarketDetail>;

type NavigationProps = NativeStackNavigationProp<TabRoutesParams> &
  ModalScreenProps<FiatPayModalRoutesParams>;

const FavoritButton = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();

  const intl = useIntl();
  return (
    <Box>
      <IconButton
        ml={4}
        mr={2}
        type={isVertical ? 'plain' : 'basic'}
        name={tokenItem?.favorited ? 'StarSolid' : 'StarOutline'}
        size={isVertical ? 'xl' : 'base'}
        circle
        iconColor={tokenItem?.favorited ? 'icon-warning' : 'icon-default'}
        onPress={() => {
          if (tokenItem) {
            if (tokenItem.favorited) {
              backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
                tokenItem.coingeckoId,
              );
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__removed' }),
              });
            } else {
              backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
                {
                  coingeckoId: tokenItem.coingeckoId,
                  symbol: tokenItem.symbol,
                },
              ]);
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__added_to_favorites' }),
              });
            }
          }
        }}
      />
    </Box>
  );
};

const SwapButton = ({ onPress }: { onPress: () => void }) => (
  <Box>
    <IconButton
      ml={4}
      type="basic"
      name="ArrowsRightLeftMini"
      size="base"
      circle
      iconColor="icon-default"
      onPress={onPress}
    />
  </Box>
);

const StakeButton = ({ onPress }: { onPress: () => void }) => (
  <Box>
    <IconButton
      ml={4}
      type="basic"
      name="InboxArrowDownMini"
      size="base"
      circle
      iconColor="icon-default"
      onPress={onPress}
    />
  </Box>
);

const PurchaseButton = ({ onPress }: { onPress: () => void }) => (
  <Box>
    <IconButton
      ml={4}
      type="basic"
      name="PlusMini"
      size="base"
      circle
      iconColor="icon-default"
      onPress={onPress}
    />
  </Box>
);

const HeaderTitle = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box flexDirection="row" alignItems="center">
      <Token
        size={isVertical ? 6 : 8}
        token={{
          logoURI: tokenItem?.logoURI,
          symbol: tokenItem?.symbol,
          name: tokenItem?.name,
        }}
      />
      <Typography.Heading ml="2">{tokenItem?.symbol}</Typography.Heading>
    </Box>
  );
};

type MarketDetailLayoutProps = {
  marketTokenId: string;
  children: ReactElement<any, any>;
};
const MarketDetailLayout: FC<MarketDetailLayoutProps> = ({
  marketTokenId,
  children,
}) => {
  const navigation = useNavigation<
    NavigationProps & NavigationProps['navigation']
  >();
  const isVertical = useIsVerticalLayout();
  const marketTokenItem = useMarketTokenItem({ coingeckoId: marketTokenId });
  const onBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  useLayoutEffect(() => {
    if (!isVertical) {
      navigation.setOptions({ headerShown: false });
    } else {
      navigation.setOptions({
        headerRight: () => <FavoritButton tokenItem={marketTokenItem} />,
        headerTitle: () => <HeaderTitle tokenItem={marketTokenItem} />,
      });
    }
  });
  const token = marketTokenItem?.tokens?.[0];

  const [signedUrl, updateUrl] = useState('');
  useEffect(() => {
    if (token?.address !== undefined && token?.networkId !== undefined) {
      backgroundApiProxy.serviceFiatPay
        .getFiatPayUrl({
          type: 'buy',
          tokenAddress: token?.address,
          networkId: token?.networkId,
        })
        .then((url) => updateUrl(url));
    }
  }, [token?.address, token?.networkId]);

  const stakedSupport = useTokenSupportStakedAssets(
    token?.networkId,
    token?.tokenIdOnNetwork,
  );
  if (isVertical) {
    return children ?? null;
  }

  return (
    <Box bg="background-default" w="full" h="full" p="4">
      <Box w="full" flexDirection="row" alignItems="center" py="5">
        <IconButton onPress={onBack} type="plain" name="ArrowLeftOutline" />
      </Box>
      <Box flex={1} flexDirection="row" justifyContent="center">
        <Box flex={1} maxW={SCREEN_SIZE.LARGE}>
          <Box
            display="flex"
            justifyContent="space-between"
            flexDirection="row"
            mb="8"
          >
            <HeaderTitle tokenItem={marketTokenItem} />
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="space-around"
            >
              {token ? (
                <SwapButton
                  onPress={() => {
                    if (token) {
                      backgroundApiProxy.serviceSwap.setOutputToken(token);
                      navigation.navigate(TabRoutes.Swap);
                    }
                  }}
                />
              ) : null}
              {stakedSupport ? (
                <StakeButton
                  onPress={() => {
                    if (token && stakedSupport) {
                      navigation.navigate(RootRoutes.Modal, {
                        screen: ModalRoutes.Staking,
                        params: {
                          screen: StakingRoutes.StakingAmount,
                          params: {
                            networkId: token.networkId,
                          },
                        },
                      });
                    }
                  }}
                />
              ) : null}
              {signedUrl.length > 0 ? (
                <PurchaseButton
                  onPress={() => {
                    navigation.navigate(RootRoutes.Modal, {
                      screen: ModalRoutes.FiatPay,
                      params: {
                        screen: FiatPayRoutes.MoonpayWebViewModal,
                        params: { url: signedUrl },
                      },
                    });
                  }}
                />
              ) : null}
              <FavoritButton tokenItem={marketTokenItem} />
            </Box>
          </Box>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

const MarketDetail: FC = () => {
  const route = useRoute<RouteProps>();
  const { marketTokenId } = route.params;
  const { tokenDetail } = useMarketDetail({ coingeckoId: marketTokenId });
  return (
    <MarketDetailLayout marketTokenId={marketTokenId}>
      <MarketDetailContent
        tokenDetail={tokenDetail}
        marketTokenId={marketTokenId}
      />
    </MarketDetailLayout>
  );
};
export default MarketDetail;

import React, { FC, useCallback, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';

import {
  Box,
  Icon,
  IconButton,
  ICON_NAMES,
  Image,
  ScrollView,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import MarketPriceChart from './Components/MarketDetail/MarketPriceChart';

import {
  HomeRoutes,
  HomeRoutesParams,
  ModalScreenProps,
  TabRoutes,
  TabRoutesParams,
  RootRoutes,
  ModalRoutes,
} from '../../routes/types';
import { RouteProp, useRoute } from '@react-navigation/core';

import { useMarketDetail } from './hooks/useMarketDetail';
import { useMarketTokenItem } from './hooks/useMarketToken';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { MarketTokenItem } from '../../store/reducers/market';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import MarketDetailTab from './Components/MarketDetail/MarketDetailTab';
import { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import { FiatPayModalRoutesParams } from '../../routes/Modal/FiatPay';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { useActiveWalletAccount, useManageTokens } from '../../hooks';
import { useFiatPay } from '../../hooks/redux';
import { CurrencyType } from '../FiatPay/types';
import { StakingRoutes } from '../Staking/typing';

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.MarketDetail>;

type NavigationProps = NativeStackNavigationProp<TabRoutesParams> &
  ModalScreenProps<FiatPayModalRoutesParams>;

const FavoritButton = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box>
      <IconButton
        ml={4}
        type={isVertical ? 'plain' : 'basic'}
        name={isVertical ? 'StarOutline' : 'StarSolid'}
        size={isVertical ? 'xl' : 'base'}
        circle={!isVertical}
        iconColor={tokenItem?.favorited ? 'icon-warning' : 'icon-default'}
        onPress={() => {
          if (tokenItem) {
            if (tokenItem.favorited) {
              backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
                tokenItem.coingeckoId,
              );
            } else {
              backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
                tokenItem.coingeckoId,
              ]);
            }
          }
        }}
      />
    </Box>
  );
};

const SwapButton = ({
  tokenItem,
  onPress,
}: {
  tokenItem: MarketTokenItem;
  onPress: () => void;
}) => (
  <Box>
    <IconButton
      ml={4}
      isDisabled={tokenItem.tokens && tokenItem.tokens.length === 0}
      type="basic"
      name="SwitchHorizontalSolid"
      size="base"
      circle
      iconColor="icon-default"
      onPress={onPress}
    />
  </Box>
);

const StakeButton = ({
  tokenItem,
  onPress,
}: {
  tokenItem: MarketTokenItem;
  onPress: () => void;
}) => (
  <Box>
    <IconButton
      isDisabled={tokenItem.tokens && tokenItem.tokens.length === 0}
      ml={4}
      type="basic"
      name="SaveSolid"
      size="base"
      circle
      iconColor="icon-default"
      onPress={onPress}
    />
  </Box>
);

const PurchaseButton = ({
  onPress,
  isDisabled,
}: {
  onPress: () => void;
  isDisabled: boolean;
}) => (
  <Box>
    <IconButton
      isDisabled={isDisabled}
      ml={4}
      type="basic"
      name="PlusSolid"
      size="base"
      circle
      iconColor="icon-default"
      onPress={onPress}
    />
  </Box>
);

const BellButton = ({
  tokenItem,
  onPress,
}: {
  tokenItem?: MarketTokenItem;
  onPress: () => void;
}) => (
  <Box>
    <IconButton
      ml={4}
      type="basic"
      name="BellSolid"
      size="base"
      circle
      iconColor="icon-default" // get subscribe status
      onPress={onPress}
    />
  </Box>
);

const HeaderTitle = ({ tokenItem }: { tokenItem?: MarketTokenItem }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Box flexDirection="row" alignItems="center">
      <Image
        borderRadius={isVertical ? 12 : 16}
        src={tokenItem?.logoURI}
        alt={tokenItem?.logoURI}
        key={tokenItem?.logoURI}
        size={isVertical ? 6 : 8}
        fallbackElement={
          <Icon name="QuestionMarkOutline" size={isVertical ? 24 : 32} />
        }
      />
      <Typography.Heading ml="2">{tokenItem?.symbol}</Typography.Heading>
    </Box>
  );
};

type MarketDetailLayoutProps = {
  marketTokenId: string;
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
  const token = marketTokenItem.tokens?.[0];
  const { network } = useActiveWalletAccount();
  const currencies = useFiatPay(network?.id ?? '');
  let crypotoCurrency = currencies.find((item) => {
    if (!token?.tokenIdOnNetwork) {
      return item.contract === '';
    }
    return item.contract === token?.tokenIdOnNetwork;
  });
  const { balances } = useManageTokens();
  const amount = balances[token?.tokenIdOnNetwork || 'main'] ?? '0';
  if (crypotoCurrency) {
    crypotoCurrency = { ...crypotoCurrency, balance: amount };
  }

  if (isVertical) {
    return children;
  }
  return (
    <Box bg="background-default" w="full" h="full" px="8">
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
              <SwapButton
                tokenItem={marketTokenItem}
                onPress={() => {
                  if (token) {
                    backgroundApiProxy.serviceSwap.setOutputToken(token);
                    navigation.navigate(TabRoutes.Swap);
                  }
                }}
              />
              <StakeButton
                tokenItem={marketTokenItem}
                onPress={() => {
                  if (token) {
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
              <PurchaseButton
                isDisabled={!crypotoCurrency}
                onPress={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.FiatPay,
                    params: {
                      screen: FiatPayRoutes.AmountInputModal,
                      params: {
                        token: crypotoCurrency as CurrencyType,
                        type: 'Buy',
                      },
                    },
                  });
                }}
              />
              <FavoritButton tokenItem={marketTokenItem} />
              {/* <BellButton tokenItem={marketTokenItem} /> */}
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
      <MarketDetailTab
        tokenDetail={tokenDetail}
        marketTokenId={marketTokenId}
      />
    </MarketDetailLayout>
  );
};
export default MarketDetail;

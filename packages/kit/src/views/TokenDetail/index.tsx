import { memo, useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Spinner,
  Token as TokenIcon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';
import { isBRC20Token } from '@onekeyhq/shared/src/utils/tokenUtils';

import { LazyDisplayView } from '../../components/LazyDisplayView';
import { useAppSelector, useTokenPositionInfo } from '../../hooks';
import { isSTETH, isSupportStakingType } from '../Staking/utils';
import { SwapPlugins } from '../Swap/Plugins/Swap';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AssetsInfo from './AssetsInfo';
import { BRC20TokenDetail } from './BRC20TokenDetail';
import { TokenDetailContext } from './context';
import MarketInfo from './MarketInfo';
import TokenDetailHeader from './TokenDetailHeader';
import { FavoritedButton } from './TokenDetailHeader/Header';
import { HeaderOptions } from './TokenDetailHeader/HeaderOptions';
import VerticalPriceChartSection from './TokenDetailHeader/VerticalPriceChartSection';

import type { HomeRoutes } from '../../routes/routesEnum';
import type { HomeRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LayoutChangeEvent } from 'react-native';

export type TokenDetailViewProps = NativeStackScreenProps<
  HomeRoutesParams,
  HomeRoutes.ScreenTokenDetail
>;

type RouteProps = RouteProp<HomeRoutesParams, HomeRoutes.ScreenTokenDetail>;

export enum TabEnum {
  Assets = 'Assets',
  History = 'History',
  Info = 'Info',
}

function TokenDetailLoadingWithoutMemo() {
  return (
    <Center>
      <Spinner mt={18} size="lg" />
    </Center>
  );
}
const TokenDetailLoading = memo(TokenDetailLoadingWithoutMemo);

function TokenDetailViewWithoutMemo() {
  const intl = useIntl();
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();

  const {
    coingeckoId,
    networkId,
    tokenAddress,
    sendAddress,
    accountId,

    price,
    price24h,
    logoURI,
    name,
    symbol,
  } = route.params;

  const defaultInfo = useMemo(
    () => ({
      price: price || undefined,
      price24h: price24h || undefined,
      logoURI,
      name,
      symbol,
    }),
    [price, price24h, logoURI, name, symbol],
  );

  const result = useTokenPositionInfo({
    networkId,
    accountId,
    tokenAddress,
    sendAddress,
    coingeckoId,
    defaultInfo,
  });

  const showChart = useAppSelector((s) => s.settings.showTokenDetailPriceChart);

  const isLightningNetwork = useMemo(
    () => isLightningNetworkByNetworkId(networkId),
    [networkId],
  );

  const isBRC20 = useMemo(() => isBRC20Token(tokenAddress), [tokenAddress]);

  const headerHeight = useMemo(() => {
    let height = isVerticalLayout ? 210 : 194;
    if (
      (isSupportStakingType({
        networkId,
        tokenIdOnNetwork: tokenAddress,
      }) ||
        isSTETH(networkId, tokenAddress)) &&
      !isAllNetworks(networkId)
    ) {
      height += 60;
    }
    if (showChart && !isVerticalLayout) {
      height += 332;
    }
    return height;
  }, [networkId, isVerticalLayout, showChart, tokenAddress]);

  const headerTitle = useCallback(() => {
    if (!isVerticalLayout) {
      return null;
    }
    return (
      <HStack space="8px" alignItems="center">
        <TokenIcon
          size="24px"
          showTokenVerifiedIcon
          token={{
            name: defaultInfo.name,
            symbol: defaultInfo.symbol,
            logoURI: defaultInfo.logoURI,
          }}
        />
        <Typography.Heading>{defaultInfo.symbol}</Typography.Heading>
      </HStack>
    );
  }, [isVerticalLayout, defaultInfo]);

  const headerRight = useCallback(() => {
    if (isBRC20) {
      return null;
    }

    if (!isVerticalLayout) {
      return <HeaderOptions />;
    }
    return <FavoritedButton coingeckoId={coingeckoId} />;
  }, [isVerticalLayout, isBRC20, coingeckoId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitle,
      headerRight,
    });
  }, [headerRight, headerTitle, navigation]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const {
      nativeEvent: {
        layout: { width },
      },
    } = event;
    setShowSwapPanel(width > 1280);
  }, []);

  const contextValue = useMemo(
    () => ({
      routeParams: route.params,
      ...result,
    }),
    [route.params, result],
  );
  const tabsHeader = useMemo(
    () => (
      <Box h={headerHeight}>
        <TokenDetailHeader />
      </Box>
    ),
    [headerHeight],
  );

  if (isBRC20)
    return (
      <TokenDetailContext.Provider value={contextValue}>
        <BRC20TokenDetail />
      </TokenDetailContext.Provider>
    );

  return (
    <TokenDetailContext.Provider value={contextValue}>
      <HStack
        onLayout={onLayout}
        position="relative"
        maxWidth="2155px"
        mx="auto"
        w="full"
        flex="1"
        justifyContent="center"
        pb={isVerticalLayout ? '60px' : 0}
      >
        <Tabs.Container
          headerHeight={headerHeight}
          key={String(headerHeight)}
          disableRefresh
          headerView={tabsHeader}
          containerStyle={{
            maxWidth: 1088, // 1024+32*2
            flex: 1,
          }}
        >
          <Tabs.Tab
            name={TabEnum.Assets}
            label={intl.formatMessage({ id: 'content__asset' })}
          >
            <AssetsInfo />
          </Tabs.Tab>
          <Tabs.Tab
            name={TabEnum.History}
            label={intl.formatMessage({ id: 'transaction__history' })}
          >
            <TxHistoryListView
              accountId={accountId}
              networkId={networkId}
              tokenId={isAllNetworks(networkId) ? coingeckoId : tokenAddress}
              tabComponent
            />
          </Tabs.Tab>
          <Tabs.Tab
            name={TabEnum.Info}
            label={intl.formatMessage({ id: 'content__info' })}
          >
            <MarketInfo coingeckoId={coingeckoId} />
          </Tabs.Tab>
        </Tabs.Container>
        {!isVerticalLayout &&
        showSwapPanel &&
        !isAllNetworks(networkId) &&
        !isLightningNetwork ? (
          <Box width="360px" mr="4">
            <SwapPlugins
              tokenId={tokenAddress ?? 'main'}
              networkId={networkId}
            />
          </Box>
        ) : null}

        {isVerticalLayout ? <VerticalPriceChartSection /> : null}
      </HStack>
    </TokenDetailContext.Provider>
  );
}

const TokenDetailView = memo(TokenDetailViewWithoutMemo);

function TokenDetail() {
  const route = useRoute<RouteProps>();

  const { tokenAddress } = route.params;

  const isBRC20 = useMemo(() => isBRC20Token(tokenAddress), [tokenAddress]);

  if (isBRC20) return <TokenDetailView />;

  return (
    <LazyDisplayView delay={100} defaultView={<TokenDetailLoading />}>
      <TokenDetailView />
    </LazyDisplayView>
  );
}

export default memo(TokenDetail);

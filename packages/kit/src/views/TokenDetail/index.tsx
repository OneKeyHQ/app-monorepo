import type { FC } from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

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

import { useAppSelector, useTokenDetailInfo } from '../../hooks';
import { isSTETH, isSupportStakingType } from '../Staking/utils';
import { SwapPlugins } from '../Swap/Plugins/Swap';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AssetsInfo from './AssetsInfo';
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

const TokenDetail: FC<TokenDetailViewProps> = () => {
  const intl = useIntl();
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();

  const {
    walletId,
    coingeckoId,
    networkId,
    tokenAddress,
    accountId,
    sendAddress,
    ...defaultInfo
  } = route.params;

  const detailInfo = useTokenDetailInfo({
    networkId,
    accountId,
    tokenAddress,
    coingeckoId,
    defaultInfo,
  });

  const showChart = useAppSelector((s) => s.settings.showTokenDetailPriceChart);

  const isLightningNetwork = useMemo(
    () => isLightningNetworkByNetworkId(networkId),
    [networkId],
  );

  const headerHeight = useMemo(() => {
    let height = isVerticalLayout ? 210 : 194;
    if (
      (isSupportStakingType({
        networkId: detailInfo?.defaultToken?.networkId,
        tokenIdOnNetwork: detailInfo?.defaultToken?.tokenIdOnNetwork,
      }) ||
        isSTETH(
          detailInfo?.defaultToken?.networkId,
          detailInfo?.defaultToken?.tokenIdOnNetwork,
        )) &&
      !isAllNetworks(networkId)
    ) {
      height += 60;
    }
    if (showChart && !isVerticalLayout) {
      height += 332;
    }
    return height;
  }, [networkId, detailInfo, isVerticalLayout, showChart]);

  const headerTitle = useCallback(() => {
    if (!isVerticalLayout) {
      return null;
    }
    return (
      <HStack space="8px" alignItems="center">
        <TokenIcon size="24px" showTokenVerifiedIcon token={detailInfo} />
        <Typography.Heading>{detailInfo?.symbol}</Typography.Heading>
      </HStack>
    );
  }, [isVerticalLayout, detailInfo]);

  const headerRight = useCallback(() => {
    if (!isVerticalLayout) {
      return <HeaderOptions />;
    }
    return <FavoritedButton coingeckoId={coingeckoId} />;
  }, [isVerticalLayout, coingeckoId]);

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
      detailInfo,
    }),
    [route.params, detailInfo],
  );
  const tabsHeader = useMemo(
    () => (
      <Box h={headerHeight}>
        <TokenDetailHeader />
      </Box>
    ),
    [headerHeight],
  );

  if (detailInfo.loading) {
    return (
      <Center>
        <Spinner mt={18} size="lg" />
      </Center>
    );
  }

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
        alignItems="flex-start"
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
};
export default TokenDetail;

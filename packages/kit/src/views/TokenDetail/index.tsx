import type { FC } from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Token as TokenIcon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isLightningNetworkByNetworkId } from '@onekeyhq/shared/src/engine/engineConsts';

import { useTokenDetailInfo, useTokenPositionInfo } from '../../hooks';
import { SwapPlugins } from '../Swap/Plugins/Swap';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AssetsInfo from './AssetsInfo';
import { TokenDetailContext } from './context';
import MarketInfo from './MarketInfo';
import TokenDetailHeader from './TokenDetailHeader';
import { FavoritedButton } from './TokenDetailHeader/Header';

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
    tokenAddress,
    coingeckoId,
    defaultInfo,
  });

  const positionInfo = useTokenPositionInfo({
    coingeckoId,
    networkId,
    tokenAddress,
    accountId,
    sendAddress,
    walletId,
  });

  const isLightningNetwork = useMemo(
    () => isLightningNetworkByNetworkId(networkId),
    [networkId],
  );

  const headerHeight = useMemo(() => {
    let height = isVerticalLayout ? 210 : 194;
    if (detailInfo?.ethereumNativeToken && !isAllNetworks(networkId)) {
      height += 132;
    }
    return height;
  }, [networkId, detailInfo?.ethereumNativeToken, isVerticalLayout]);

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
      return null;
    }
    return <FavoritedButton coingeckoId={coingeckoId} type="plain" size="xl" />;
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
      positionInfo,
    }),
    [route.params, detailInfo, positionInfo],
  );

  return (
    <TokenDetailContext.Provider value={contextValue}>
      <HStack flex={1} justifyContent="center" onLayout={onLayout}>
        <Tabs.Container
          key={String(headerHeight)}
          disableRefresh
          renderHeader={() => <TokenDetailHeader />}
          headerHeight={headerHeight}
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
          <Box width="360px" mt="6" mr="8">
            <SwapPlugins
              tokenId={tokenAddress ?? 'main'}
              networkId={networkId}
            />
          </Box>
        ) : null}
      </HStack>
    </TokenDetailContext.Provider>
  );
};
export default TokenDetail;

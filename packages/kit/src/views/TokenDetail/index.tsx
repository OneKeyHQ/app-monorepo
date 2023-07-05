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

import { useTokenPositionInfo } from '../../hooks';
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
    symbol,
    name,
    logoURI,
  } = route.params;

  const detailInfo = useTokenPositionInfo({
    coingeckoId,
    networkId,
    tokenAddress,
    accountId,
    sendAddress,
    walletId,
  });

  // const headerHeight = useMemo(() => {
  //   let height = 520;
  //   if (isVerticalLayout) {
  //     let stakedSupport = isSupportStakedAssets(networkId, tokenId);
  //     if (!stakedSupport) {
  //       stakedSupport = isSTETH(networkId, tokenId);
  //     }
  //     height = stakedSupport === true ? 570 : 570 - 88;
  //     height = 570;
  //   } else {
  //     height = 452;
  //   }
  //   return height;
  // }, [isVerticalLayout]);

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
            symbol,
            name,
            logoURI,
          }}
        />
        <Typography.Heading>{symbol}</Typography.Heading>
      </HStack>
    );
  }, [isVerticalLayout, symbol, name, logoURI]);

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
    }),
    [route.params, detailInfo],
  );

  return (
    <TokenDetailContext.Provider value={contextValue}>
      <HStack flex={1} justifyContent="center" onLayout={onLayout}>
        <Tabs.Container
          disableRefresh
          renderHeader={() => <TokenDetailHeader />}
          headerHeight={521}
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
        {!isVerticalLayout && showSwapPanel && !isAllNetworks(networkId) ? (
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

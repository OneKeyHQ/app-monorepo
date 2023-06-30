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
// import { TokenVerifiedIcon } from '@onekeyhq/components/src/Token';

import { useTokenDetailInfo } from '../../hooks/useTokens';
import { SwapPlugins } from '../Swap/Plugins/Swap';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AssetsInfo from './AssetsInfo';
import { TokenDetailContext } from './context';
import MarketInfo from './MarketInfo';
import TokenDetailHeader from './TokenDetailHeader';
import { FavoritedButton } from './TokenDetailHeader/DeskTopHeader';

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

  const { coingeckoId, networkId, tokenAddress, accountId, sendAddress } =
    route.params;

  const detailInfo = useTokenDetailInfo({
    coingeckoId,
    networkId,
    tokenAddress,
  });

  const { price, symbol, name, logoURI, defaultChain, tokens } =
    detailInfo ?? {};

  const defaultToken = useMemo(() => {
    if (!tokens?.length) {
      return;
    }
    if (defaultChain) {
      return tokens.find(
        (t) =>
          t.impl === defaultChain.impl && t.chainId === defaultChain.chainId,
      );
    }
    return tokens[0];
  }, [tokens, defaultChain]);

  const headerHeight = useMemo(() => {
    let height = 570;
    if (isVerticalLayout) {
      // let stakedSupport = isSupportStakedAssets(networkId, tokenId);
      // if (!stakedSupport) {
      //   stakedSupport = isSTETH(networkId, tokenId);
      // }
      // height = stakedSupport === true ? 570 : 570 - 88;
      height = 570;
    } else {
      height = 452;
    }
    return height;
  }, [isVerticalLayout]);

  const priceReady = useMemo(() => !!price, [price]);

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
        {/* <TokenVerifiedIcon size={24} token={{} || {}} /> */}
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
          renderHeader={() => (
            <TokenDetailHeader
              paddingX={{ base: '16px', md: '32px' }}
              bgColor="background-default"
            />
          )}
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
            <AssetsInfo
              token={defaultToken}
              tokenId={defaultToken?.address ?? 'main'}
              accountId={accountId}
              networkId={networkId}
              priceReady={priceReady}
              sendAddress={sendAddress}
            />
          </Tabs.Tab>
          <Tabs.Tab
            name={TabEnum.History}
            label={intl.formatMessage({ id: 'transaction__history' })}
          >
            <TxHistoryListView
              accountId={accountId}
              networkId={networkId}
              tokenId={tokenAddress || defaultToken?.address}
              tabComponent
            />
          </Tabs.Tab>
          <Tabs.Tab
            name={TabEnum.Info}
            label={intl.formatMessage({ id: 'content__info' })}
          >
            <MarketInfo token={defaultToken} />
          </Tabs.Tab>
        </Tabs.Container>
        {!isVerticalLayout && showSwapPanel ? (
          <Box width="360px" mt="6" mr="8">
            <SwapPlugins
              tokenId={defaultToken?.address ?? 'main'}
              networkId={networkId}
            />
          </Box>
        ) : null}
      </HStack>
    </TokenDetailContext.Provider>
  );
};
export default TokenDetail;

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
import { TokenVerifiedIcon } from '@onekeyhq/components/src/Token';

import { useActiveSideAccount } from '../../hooks';
import { useSimpleTokenPriceValue } from '../../hooks/useManegeTokenPrice';
import { useSingleToken } from '../../hooks/useTokens';
import { isSTETH, isSupportStakedAssets } from '../Staking/utils';
import { SwapPlugins } from '../Swap/Plugins/Swap';
import { TxHistoryListView } from '../TxHistory/TxHistoryListView';

import AssetsInfo from './AssetsInfo';
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

const SwapPanel = () => {
  const route = useRoute<RouteProps>();
  const { tokenId, networkId } = route.params;
  return (
    <Box width="360px" mt="6" mr="8">
      <SwapPlugins tokenId={tokenId} networkId={networkId} />
    </Box>
  );
};

const TokenDetail: FC<TokenDetailViewProps> = () => {
  const intl = useIntl();
  const [showSwapPanel, setShowSwapPanel] = useState(false);
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();

  const { accountId, networkId, tokenId, sendAddress } = route.params;

  const { network: activeNetwork } = useActiveSideAccount({
    accountId,
    networkId,
  });

  const { token } = useSingleToken(networkId, tokenId);

  const price = useSimpleTokenPriceValue({
    networkId,
    contractAdress: tokenId,
  });

  const headerHeight = useMemo(() => {
    let height = 570;
    if (isVerticalLayout) {
      let stakedSupport = isSupportStakedAssets(networkId, tokenId);
      if (!stakedSupport) {
        stakedSupport = isSTETH(networkId, tokenId);
      }
      height = stakedSupport === true ? 570 : 570 - 88;
    } else {
      height = 452;
    }
    return height;
  }, [isVerticalLayout, networkId, tokenId]);

  const priceReady = useMemo(() => {
    if (!token) {
      return false;
    }
    return !!price;
  }, [price, token]);

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
            ...token,
            logoURI: token?.logoURI || activeNetwork?.logoURI,
          }}
        />
        <Typography.Heading>
          {token?.tokenIdOnNetwork ? token?.symbol : activeNetwork?.symbol}
        </Typography.Heading>
        <TokenVerifiedIcon size={24} token={token || {}} />
      </HStack>
    );
  }, [activeNetwork?.logoURI, activeNetwork?.symbol, isVerticalLayout, token]);

  const headerRight = useCallback(() => {
    if (!isVerticalLayout) {
      return null;
    }
    return (
      <FavoritedButton
        coingeckoId={token?.coingeckoId}
        type="plain"
        size="xl"
      />
    );
  }, [isVerticalLayout, token]);

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

  return (
    <HStack flex={1} justifyContent="center" onLayout={onLayout}>
      <Tabs.Container
        disableRefresh
        renderHeader={() => (
          <TokenDetailHeader
            accountId={accountId}
            networkId={networkId}
            token={token}
            priceReady={priceReady}
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
            token={token}
            tokenId={tokenId}
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
            tokenId={tokenId}
            tabComponent
          />
        </Tabs.Tab>
        <Tabs.Tab
          name={TabEnum.Info}
          label={intl.formatMessage({ id: 'content__info' })}
        >
          <MarketInfo token={token} />
        </Tabs.Tab>
      </Tabs.Container>
      {!isVerticalLayout && showSwapPanel ? <SwapPanel /> : null}
    </HStack>
  );
};
export default TokenDetail;

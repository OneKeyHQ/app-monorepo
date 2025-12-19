import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  NavBackButton,
  Page,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import { HeaderButtonGroup } from '@onekeyhq/components/src/layouts/Navigation/Header';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  AccountSelectorProviderMirror,
  AccountSelectorTriggerHome,
} from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ECopyFrom,
  EEnterWay,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useToDetailPage } from '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage';
import { MarketTokenListBase } from '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase';
import {
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';
import { MarketWatchListProviderMirrorV2 } from '../MarketWatchListProviderMirrorV2';

import type { IMarketToken } from '../MarketHomeV2/components/MarketTokenList/MarketTokenData';
import type { EModalMarketRoutes, IModalMarketParamList } from '../router';
import type { RouteProp } from '@react-navigation/core';

type IMarketBannerDetailRouteParams = RouteProp<
  ITabMarketParamList & IModalMarketParamList,
  ETabMarketRoutes.MarketBannerDetail | EModalMarketRoutes.MarketBannerDetail
>;

function MarketBannerDetailContent({ title }: { title: string }) {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { tokenListId } = route.params;
  const toDetailPage = useToDetailPage({ from: EEnterWay.BannerList });
  const navigation = useAppNavigation();
  const { config } = useAccountSelectorContextData();
  const { md } = useMedia();

  const renderHeaderLeft = useCallback(
    () => <NavBackButton onPress={() => navigation.pop()} />,
    [navigation],
  );

  const renderHeaderTitle = useCallback(
    () => <SizableText size="$headingLg">{title}</SizableText>,
    [title],
  );

  const renderHeaderRight = useCallback(
    () =>
      config ? (
        <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
          <HeaderButtonGroup>
            <AccountSelectorTriggerHome num={0} />
          </HeaderButtonGroup>
        </AccountSelectorProviderMirror>
      ) : null,
    [config],
  );

  const { result, isLoading } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerTokenList({
          tokenListId,
        });
      return data;
    },
    [tokenListId],
    {
      watchLoading: true,
    },
  );

  const transformedData = useMemo(() => {
    if (!result) return [];
    return result.map((item, index) => {
      const chainId = item.networkId || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
        sortIndex: index,
      });
    });
  }, [result]);

  const handleItemPress = useCallback(
    (item: IMarketToken) => {
      void toDetailPage({
        tokenAddress: item.address,
        networkId: item.networkId,
        symbol: item.symbol,
        isNative: item.isNative,
      });
    },
    [toDetailPage],
  );

  const listResult = useMemo(
    () => ({
      data: transformedData,
      isLoading,
      setSortBy: () => {},
      setSortType: () => {},
    }),
    [transformedData, isLoading],
  );

  return (
    <Page>
      {md ? (
        <Page.Header title={title} />
      ) : (
        <Page.Header
          headerTitle={renderHeaderTitle}
          headerLeft={renderHeaderLeft}
          headerRight={renderHeaderRight}
        />
      )}

      <Page.Body>
        <Stack flex={1} px={md ? '$0' : '$4'}>
          <MarketTokenListBase
            result={listResult}
            onItemPress={handleItemPress}
            hideTokenAge
            watchlistFrom={EWatchlistFrom.BannerList}
            copyFrom={ECopyFrom.BannerList}
          />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export function MarketBannerDetail() {
  const route = useRoute<IMarketBannerDetailRouteParams>();
  const { title } = route.params;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirrorV2
        storeName={EJotaiContextStoreNames.marketWatchListV2}
      >
        <MarketBannerDetailContent title={title} />
      </MarketWatchListProviderMirrorV2>
    </AccountSelectorProviderMirror>
  );
}

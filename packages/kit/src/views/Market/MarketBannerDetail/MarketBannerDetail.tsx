import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Page,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
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
  const toDetailPage = useToDetailPage();

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

  const { md } = useMedia();

  return (
    <Page>
      {md ? (
        <Page.Header title={title} />
      ) : (
        <>
          <Page.Header headerShown={false} />
          <XStack alignItems="center" px="$5" h="$14">
            <SizableText size="$heading2xl">{title}</SizableText>
          </XStack>
        </>
      )}
      <Page.Body>
        <Stack flex={1} px="$4">
          <MarketTokenListBase
            result={listResult}
            onItemPress={handleItemPress}
            hideTokenAge
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

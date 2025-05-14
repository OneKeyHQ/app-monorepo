import { useMemo } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  EPageType,
  Page,
  ScrollView,
  XStack,
  YStack,
  useDeferredPromise,
  useMedia,
  usePageType,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ETabMarketRoutes,
  ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TokenDetailTabs } from '../components/TokenDetailTabs';
import { MarketWatchListProviderMirror } from '../MarketWatchListProviderMirror';

import {
  TokenDetailHeader as LegacyTokenDetailHeader,
  MarketDetailHeader,
  TokenPriceChart as NewTokenPriceChart,
  SwapPanel,
  TokenDetailHeaderSkeleton,
} from './components';
import { useMarketDetailData } from './useMarketDetailData';

function MarketDetail({
  route,
}: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>) {
  const { token: coinGeckoId } = route.params;
  const { gtMd: gtMdMedia } = useMedia();

  const pageType = usePageType();

  const gtMd = pageType === EPageType.modal ? false : gtMdMedia;

  const { tokenDetail, isRefreshing, onRefresh } =
    useMarketDetailData(coinGeckoId);

  const tokenDetailHeader = useMemo(() => {
    if (tokenDetail) {
      return (
        <LegacyTokenDetailHeader
          coinGeckoId={coinGeckoId}
          token={tokenDetail}
        />
      );
    }
    return <TokenDetailHeaderSkeleton gtMd={gtMd} />;
  }, [coinGeckoId, gtMd, tokenDetail]);

  const defer = useDeferredPromise();

  const tokenPriceChart = useMemo(
    () => (
      <NewTokenPriceChart
        tokenDetail={tokenDetail}
        coinGeckoId={coinGeckoId}
        defer={defer}
      />
    ),
    [coinGeckoId, defer, tokenDetail],
  );

  return (
    <Page>
      <MarketDetailHeader
        tokenDetail={tokenDetail}
        coinGeckoId={coinGeckoId}
        gtMd={gtMd}
      />
      <Page.Body>
        <SwapPanel />

        {gtMd ? (
          <YStack flex={1}>
            <XStack flex={1} pt="$5">
              <ScrollView minWidth={392} maxWidth={392}>
                {tokenDetailHeader}
              </ScrollView>
              <YStack flex={1}>
                <TokenDetailTabs
                  defer={defer}
                  token={tokenDetail}
                  coinGeckoId={coinGeckoId}
                  listHeaderComponent={tokenPriceChart}
                />
              </YStack>
            </XStack>
          </YStack>
        ) : (
          <TokenDetailTabs
            defer={defer}
            isRefreshing={isRefreshing}
            onRefresh={onRefresh}
            token={tokenDetail}
            coinGeckoId={coinGeckoId}
            listHeaderComponent={tokenDetailHeader}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default function MarketDetailWithProvider(
  props: IPageScreenProps<ITabMarketParamList, ETabMarketRoutes.MarketDetail>,
) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <MarketWatchListProviderMirror
        storeName={EJotaiContextStoreNames.marketWatchList}
      >
        <MarketDetail {...props} />
      </MarketWatchListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

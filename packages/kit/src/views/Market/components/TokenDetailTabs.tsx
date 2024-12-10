import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITabPageProps } from '@onekeyhq/components';
import {
  RefreshControl,
  Skeleton,
  Stack,
  Tab,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ITabInstance } from '@onekeyhq/components/src/layouts/TabView/StickyTabComponent/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketDetailPool,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';
import { TokenPriceChart } from './TokenPriceChart';

import type { IDeferredPromise } from '../../../hooks/useDeferredPromise';
import type { LayoutChangeEvent } from 'react-native';

function SkeletonRow() {
  return (
    <XStack>
      <XStack flex={1}>
        <Skeleton w="$24" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
    </XStack>
  );
}

function MdSkeletonRow() {
  return (
    <XStack>
      <XStack flex={1}>
        <Skeleton w="$24" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
      <XStack flex={1} jc="flex-end">
        <Skeleton w="$16" h="$3" />
      </XStack>
    </XStack>
  );
}

function BasicTokenDetailTabs({
  token,
  listHeaderComponent,
  isRefreshing,
  onRefresh,
  defer,
  coinGeckoId,
}: {
  token?: IMarketTokenDetail;
  listHeaderComponent?: ReactElement;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  defer: IDeferredPromise<unknown>;
  coinGeckoId: string;
}) {
  const intl = useIntl();
  const { md } = useMedia();

  const [pools, setPools] = useState<
    | {
        data: IMarketDetailPool[];
        contract_address: string;
        onekeyNetworkId?: string | undefined;
        coingeckoNetworkId?: string | undefined;
      }[]
    | undefined
  >(undefined);

  const init = useCallback(async () => {
    if (token?.detailPlatforms) {
      const response = await backgroundApiProxy.serviceMarket.fetchPools(
        token.detailPlatforms,
      );

      setTimeout(() => {
        defer.resolve(null);
      }, 100);
      setPools(response);
    }
  }, [defer, token?.detailPlatforms]);
  useEffect(() => {
    void init();
  }, [init]);

  const renderPoolSkeleton = useMemo(
    () =>
      md ? (
        <YStack gap="$10" px="$5" pt="$11">
          <MdSkeletonRow />
          <MdSkeletonRow />
          <MdSkeletonRow />
          <MdSkeletonRow />
        </YStack>
      ) : (
        <YStack gap="$6" px="$5" pt="$11">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </YStack>
      ),
    [md],
  );

  const tabConfig = useMemo(
    () =>
      pools
        ? [
            md && token
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.global_overview,
                  }),
                  // eslint-disable-next-line react/no-unstable-nested-components
                  page: (props: ITabPageProps) => (
                    <TokenPriceChart
                      {...props}
                      tickers={token?.tickers}
                      coinGeckoId={coinGeckoId}
                      defer={defer}
                      symbol={token?.symbol}
                    />
                  ),
                }
              : undefined,
            md && token
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.global_overview,
                  }),
                  // eslint-disable-next-line react/no-unstable-nested-components
                  page: (props: ITabPageProps) => (
                    <MarketDetailOverview {...props} token={token} />
                  ),
                }
              : undefined,
            (pools.length || token?.tickers?.length) && token
              ? {
                  title: intl.formatMessage({ id: ETranslations.global_pools }),
                  // eslint-disable-next-line react/no-unstable-nested-components
                  page: (props: ITabPageProps) => (
                    <MarketDetailPools
                      {...props}
                      pools={pools}
                      tickers={token.tickers}
                    />
                  ),
                }
              : undefined,
            token && {
              title: intl.formatMessage({
                id: ETranslations.global_links,
              }),
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <MarketDetailLinks {...props} token={token} />
              ),
            },
          ].filter(Boolean)
        : [],
    [coinGeckoId, defer, intl, md, pools, token],
  );

  const tabRef = useRef<ITabInstance | null>(null);

  const changeTabVerticalScrollEnabled = useCallback(
    ({ enabled }: { enabled: boolean }) => {
      tabRef?.current?.setVerticalScrollEnabled(enabled);
    },
    [],
  );
  useEffect(() => {
    // if (!platformEnv.isNative) {
    //   return;
    // }
    // setTimeout(() => {
    //   tabRef.current?.scrollToTop();
    //   changeTabVerticalScrollEnabled({ enabled: false });
    // }, 100);
    // appEventBus.on(
    //   EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled,
    //   changeTabVerticalScrollEnabled,
    // );
    // return () => {
    //   appEventBus.off(
    //     EAppEventBusNames.ChangeTokenDetailTabVerticalScrollEnabled,
    //     changeTabVerticalScrollEnabled,
    //   );
    // };
  }, [changeTabVerticalScrollEnabled]);

  const onSelectedPageIndex = useCallback(
    (index: number) => {
      if (index === 0) {
        tabRef.current?.scrollToTop();
        setTimeout(() => {
          changeTabVerticalScrollEnabled({ enabled: false });
        }, 50);
      } else {
        changeTabVerticalScrollEnabled({ enabled: true });
      }
    },
    [changeTabVerticalScrollEnabled],
  );

  const handleMount = useCallback(
    (e: LayoutChangeEvent) => {
      if (!platformEnv.isNative) {
        return;
      }
      if (e.nativeEvent.layout.height > 0) {
        setTimeout(() => {
          tabRef.current?.scrollToTop();
          changeTabVerticalScrollEnabled({ enabled: false });
        }, 100);
      }
    },
    [changeTabVerticalScrollEnabled],
  );

  return (
    <Tab
      ref={tabRef}
      refreshControl={
        <RefreshControl refreshing={!!isRefreshing} onRefresh={onRefresh} />
      }
      $gtMd={{ pr: '$5' }}
      $md={{ mt: '$5' }}
      data={tabConfig}
      disableRefresh
      ListHeaderComponent={
        <Stack mb="$5" onLayout={handleMount}>
          {listHeaderComponent}
          {/* {pools ? null : (
            <YStack $gtMd={{ px: '$5' }}>{renderPoolSkeleton}</YStack>
          )} */}
        </Stack>
      }
      onSelectedPageIndex={onSelectedPageIndex}
    />
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);

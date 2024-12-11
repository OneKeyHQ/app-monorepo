import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ITabPageProps } from '@onekeyhq/components';
import { RefreshControl, Stack, Tab, useMedia } from '@onekeyhq/components';
import type { ITabInstance } from '@onekeyhq/components/src/layouts/TabView/StickyTabComponent/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';
import { TokenPriceChart } from './TokenPriceChart';

import type { IDeferredPromise } from '../../../hooks/useDeferredPromise';
import type { LayoutChangeEvent } from 'react-native';

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

  useEffect(() => {
    setTimeout(() => {
      defer.resolve(null);
    }, 100);
  }, [defer]);

  const tabConfig = useMemo(
    () =>
      [
        md && token
          ? {
              title: intl.formatMessage({
                id: ETranslations.market_chart,
              }),
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <TokenPriceChart
                  {...props}
                  isFetching={!token}
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
        token?.tickers?.length && token
          ? {
              title: intl.formatMessage({ id: ETranslations.global_pools }),
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (props: ITabPageProps) => (
                <MarketDetailPools
                  {...props}
                  tickers={token.tickers}
                  detailPlatforms={token.detailPlatforms}
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
      ].filter(Boolean),
    [coinGeckoId, defer, intl, md, token],
  );

  const tabRef = useRef<ITabInstance | null>(null);

  const changeTabVerticalScrollEnabled = useCallback(
    ({ enabled }: { enabled: boolean }) => {
      tabRef?.current?.setVerticalScrollEnabled(enabled);
    },
    [],
  );

  const prevSelectedPageIndex = useRef(0);
  const onSelectedPageIndex = useCallback(
    (index: number) => {
      if (index === 0) {
        tabRef.current?.scrollToTop();
        setTimeout(() => {
          changeTabVerticalScrollEnabled({ enabled: false });
        }, 50);
      } else if (prevSelectedPageIndex.current === 0) {
        changeTabVerticalScrollEnabled({ enabled: true });
      }
      prevSelectedPageIndex.current = index;
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
        <Stack mb="$5" onLayout={handleMount} h={150} $gtMd={{ h: 450 }}>
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

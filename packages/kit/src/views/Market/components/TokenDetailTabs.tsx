import type { ReactElement } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Tabs, YStack, useIsModalPage, useMedia } from '@onekeyhq/components';
import type { IDeferredPromise, ITabPageProps } from '@onekeyhq/components';
import type { ITabInstance } from '@onekeyhq/components/src/layouts/TabView/StickyTabComponent/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';
import { TokenPriceChart } from './TokenPriceChart';

import type { LayoutChangeEvent } from 'react-native';

function BasicTokenDetailTabs({
  token,
  listHeaderComponent,
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
  const isModalPage = useIsModalPage();
  const { md: mdMedia, gtMd: gtMdMedia } = useMedia();
  const md = isModalPage ? true : mdMedia;

  useEffect(() => {
    setTimeout(() => {
      defer.resolve(null);
    }, 100);
  }, [defer]);

  const tabConfigs = useMemo(
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
                  fallbackToChart={!!token?.fallbackToChart}
                  tvPlatform={token?.tvPlatform}
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
      if (!md) {
        return;
      }
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
    [changeTabVerticalScrollEnabled, md],
  );

  const handleMount = useCallback(
    (e: LayoutChangeEvent) => {
      if (!md) {
        return;
      }
      if (e.nativeEvent.layout.height > 0) {
        setTimeout(() => {
          tabRef.current?.scrollToTop();
          changeTabVerticalScrollEnabled({ enabled: false });
        }, 100);
      }
    },
    [changeTabVerticalScrollEnabled, md],
  );

  return (
    <Tabs.Container
      headerContainerStyle={{
        shadowOpacity: 0,
        elevation: 0,
      }}
      pagerProps={
        {
          scrollSensitivity: 4,
        } as any
      }
      containerStyle={{
        ...(gtMdMedia ? { paddingRight: isModalPage ? 0 : 20 } : undefined),
        ...(md ? { marginTop: 20 } : undefined),
        ...(isModalPage ? { marginTop: 20 } : undefined),
      }}
      onIndexChange={onSelectedPageIndex}
      renderHeader={() => (
        <YStack
          bg="$bgApp"
          pb="$5"
          onLayout={handleMount}
          h={170}
          $gtMd={{
            ...(isModalPage ? null : { h: 450 }),
          }}
        >
          {listHeaderComponent}
        </YStack>
      )}
      renderTabBar={(props) => <Tabs.TabBar {...props} />}
      key={tabConfigs.length}
    >
      {tabConfigs.map((tab) => (
        <Tabs.Tab key={tab.title} name={tab.title}>
          <Tabs.ScrollView>
            {tab.page({ showWalletActions: false })}
          </Tabs.ScrollView>
        </Tabs.Tab>
      ))}
    </Tabs.Container>
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);

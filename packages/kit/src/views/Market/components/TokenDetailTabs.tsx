import type { ReactElement } from 'react';
import { memo, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Stack,
  Tabs,
  YStack,
  useIsModalPage,
  useMedia,
} from '@onekeyhq/components';
import type { IDeferredPromise } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from './MarketDetailLinks';
import { MarketDetailOverview } from './MarketDetailOverview';
import { MarketDetailPools } from './MarketDetailPools';
import { TokenPriceChart } from './TokenPriceChart';

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
              page: (
                <Stack flex={1}>
                  <TokenPriceChart
                    fallbackToChart={!!token?.fallbackToChart}
                    tvPlatform={token?.tvPlatform}
                    isFetching={!token}
                    tickers={token?.tickers}
                    coinGeckoId={coinGeckoId}
                    defer={defer}
                    symbol={token?.symbol}
                  />
                </Stack>
              ),
            }
          : undefined,
        md && token
          ? {
              title: intl.formatMessage({
                id: ETranslations.global_overview,
              }),
              // eslint-disable-next-line react/no-unstable-nested-components
              page: <MarketDetailOverview token={token} />,
            }
          : undefined,
        token?.tickers?.length && token
          ? {
              title: intl.formatMessage({ id: ETranslations.global_pools }),
              // eslint-disable-next-line react/no-unstable-nested-components
              page: (
                <MarketDetailPools
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
          page: <MarketDetailLinks token={token} />,
        },
      ].filter(Boolean),
    [coinGeckoId, defer, intl, md, token],
  );

  return (
    <Tabs.Container
      containerStyle={{
        ...(gtMdMedia ? { paddingRight: isModalPage ? 0 : 20 } : undefined),
        ...(md ? { marginTop: 20 } : undefined),
        ...(isModalPage ? { marginTop: 20 } : undefined),
      }}
      renderHeader={() => (
        <YStack
          bg="$bgApp"
          pb="$5"
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
          <Tabs.ScrollView>{tab.page}</Tabs.ScrollView>
        </Tabs.Tab>
      ))}
    </Tabs.Container>
  );
}

export const TokenDetailTabs = memo(BasicTokenDetailTabs);

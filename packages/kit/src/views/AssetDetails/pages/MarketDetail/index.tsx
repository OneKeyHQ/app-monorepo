import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useIsOverlayPage,
} from '@onekeyhq/components';
import { TabBar, TabBarItem } from '@onekeyhq/components/src/composite/TabBar';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AppPager } from '@onekeyhq/kit/src/components/AppPager';
import type { IAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/types';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IMarketPreferredToken,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from '../../../Market/components/MarketDetailLinks';
import { MarketDetailOverview } from '../../../Market/components/MarketDetailOverview';
import { MarketDetailPools } from '../../../Market/components/MarketDetailPools';
import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { MarketTradeButton } from '../../../Market/components/MarketTradeButton';
import { PriceChangePercentage } from '../../../Market/components/PriceChangePercentage';

import { MarketDetailChart } from './MarketDetailChart';

import type { LayoutChangeEvent } from 'react-native';

type IMarketDetailProps = IPageScreenProps<
  IModalAssetDetailsParamList,
  EModalAssetDetailRoutes.MarketDetail
>;

export function MarketDetailContent({
  coinGeckoId,
  preferredToken,
}: {
  coinGeckoId: string;
  preferredToken?: IMarketPreferredToken;
}) {
  const intl = useIntl();
  const isOverlayPage = useIsOverlayPage();
  const fillWebChart = platformEnv.isWeb && isOverlayPage;
  const [bodyHeight, setBodyHeight] = useState<number>();
  const [tabBarHeight, setTabBarHeight] = useState<number>();
  const handleBodyLayout = useCallback((event: LayoutChangeEvent) => {
    setBodyHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const handleTabBarLayout = useCallback((event: LayoutChangeEvent) => {
    setTabBarHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const chartHeight =
    bodyHeight !== undefined && tabBarHeight !== undefined
      ? Math.max(0, bodyHeight - tabBarHeight)
      : undefined;
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const lastTokenRef = useRef<IMarketTokenDetail | undefined>(undefined);
  const {
    result: token,
    isLoading,
    run: retry,
  } = usePromiseResult(
    async () => {
      try {
        const response =
          await backgroundApiProxy.serviceMarket.fetchMarketTokenDetail(
            coinGeckoId,
            true,
            USD_CURRENCY_ID,
          );
        lastTokenRef.current = response;
        return response;
      } catch {
        // Keep a rendered chart during transient polling failures; initial failures expose retry.
        return lastTokenRef.current;
      }
    },
    [coinGeckoId],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 45 }),
    },
  );
  const pages = useMemo<IAppPagerPage[]>(() => {
    if (!token) return [];
    return [
      {
        key: 'chart',
        name: intl.formatMessage({ id: ETranslations.market_chart }),
        children: fillWebChart ? (
          <Stack height={chartHeight} minHeight={0}>
            <MarketDetailChart coinGeckoId={coinGeckoId} token={token} />
          </Stack>
        ) : (
          <MarketDetailChart coinGeckoId={coinGeckoId} token={token} />
        ),
      },
      {
        key: 'overview',
        name: intl.formatMessage({ id: ETranslations.global_overview }),
        children: <MarketDetailOverview token={token} />,
      },
      ...(token.tickers?.length
        ? [
            {
              key: 'pools',
              name: intl.formatMessage({ id: ETranslations.global_pools }),
              children: (
                <MarketDetailPools
                  tickers={token.tickers}
                  detailPlatforms={token.detailPlatforms}
                />
              ),
            },
          ]
        : []),
      {
        key: 'links',
        name: intl.formatMessage({ id: ETranslations.global_links }),
        children: <MarketDetailLinks token={token} />,
      },
    ];
  }, [chartHeight, coinGeckoId, fillWebChart, intl, token]);

  const renderHeaderTitle = useCallback(
    () => (
      <XStack gap="$2" ai="center">
        <MarketTokenIcon uri={token?.image ?? ''} size="sm" />
        <SizableText>{token?.symbol.toUpperCase()}</SizableText>
      </XStack>
    ),
    [token?.image, token?.symbol],
  );

  return (
    <Page>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body
        testID="asset-market-detail"
        onLayout={fillWebChart ? handleBodyLayout : undefined}
      >
        {token ? (
          <AppPager
            pages={pages}
            animationEnabled={false}
            renderHeader={() => (
              <YStack height={170} px="$5" pb="$5" bg="$bgApp">
                <YStack flex={1}>
                  <SizableText size="$headingMd" color="$textSubdued">
                    {token.name}
                  </SizableText>
                  <Currency
                    pt="$2"
                    sourceCurrency={USD_CURRENCY_ID}
                    targetCurrency={USD_CURRENCY_ID}
                    size="$heading3xl"
                  >
                    {token.stats.currentPrice}
                  </Currency>
                  <PriceChangePercentage pt="$0.5" width="100%">
                    {token.stats.performance.priceChangePercentage24h}
                  </PriceChangePercentage>
                </YStack>
                <MarketTradeButton
                  coinGeckoId={coinGeckoId}
                  token={token}
                  accountId={account?.id ?? ''}
                  preferredToken={preferredToken}
                />
              </YStack>
            )}
            renderTabBar={({ focusedTab, tabNames, onTabPress }) => (
              <YStack onLayout={fillWebChart ? handleTabBarLayout : undefined}>
                <TabBar
                  focusedTab={focusedTab}
                  tabNames={tabNames}
                  onTabPress={onTabPress}
                  renderItem={(props, index) => (
                    <TabBarItem
                      key={props.name}
                      {...props}
                      testID={`asset-market-detail-tab-${pages[index].key}`}
                    />
                  )}
                />
              </YStack>
            )}
          />
        ) : (
          <Stack flex={1} ai="center" jc="center" gap="$2">
            {isLoading !== false ? (
              <Spinner size="large" />
            ) : (
              <>
                <SizableText color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.global_unknown_error_retry_message,
                  })}
                </SizableText>
                <Button
                  testID="asset-market-detail-retry"
                  variant="tertiary"
                  onPress={() => void retry()}
                >
                  {intl.formatMessage({ id: ETranslations.global_retry })}
                </Button>
              </>
            )}
          </Stack>
        )}
      </Page.Body>
    </Page>
  );
}

export default function MarketDetail({ route }: IMarketDetailProps) {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home, sceneUrl: '' }}
      enabledNum={[0]}
    >
      <MarketDetailContent
        key={route.params.token}
        coinGeckoId={route.params.token}
        preferredToken={route.params.preferredToken}
      />
    </AccountSelectorProviderMirror>
  );
}

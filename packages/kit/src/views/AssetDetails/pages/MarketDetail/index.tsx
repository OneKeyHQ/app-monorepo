import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Page,
  SizableText,
  Spinner,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailLinks } from '../../../Market/components/MarketDetailLinks';
import { MarketDetailOverview } from '../../../Market/components/MarketDetailOverview';
import { MarketDetailPools } from '../../../Market/components/MarketDetailPools';
import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { MarketTradeButton } from '../../../Market/components/MarketTradeButton';
import { PriceChangePercentage } from '../../../Market/components/PriceChangePercentage';

import { MarketDetailChart } from './MarketDetailChart';

type IMarketDetailProps = IPageScreenProps<
  IModalAssetDetailsParamList,
  EModalAssetDetailRoutes.MarketDetail
>;

export function MarketDetailContent({ coinGeckoId }: { coinGeckoId: string }) {
  const intl = useIntl();
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
      <Page.Body testID="asset-market-detail">
        {token ? (
          <Tabs.Container
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
                />
              </YStack>
            )}
            renderTabBar={(props) => <Tabs.TabBar {...props} />}
          >
            <Tabs.Tab
              name={intl.formatMessage({ id: ETranslations.market_chart })}
            >
              <Tabs.ScrollView>
                <MarketDetailChart coinGeckoId={coinGeckoId} token={token} />
              </Tabs.ScrollView>
            </Tabs.Tab>
            <Tabs.Tab
              name={intl.formatMessage({ id: ETranslations.global_overview })}
            >
              <Tabs.ScrollView>
                <MarketDetailOverview token={token} />
              </Tabs.ScrollView>
            </Tabs.Tab>
            {token.tickers?.length ? (
              <Tabs.Tab
                name={intl.formatMessage({ id: ETranslations.global_pools })}
              >
                <Tabs.ScrollView>
                  <MarketDetailPools
                    tickers={token.tickers}
                    detailPlatforms={token.detailPlatforms}
                  />
                </Tabs.ScrollView>
              </Tabs.Tab>
            ) : null}
            <Tabs.Tab
              name={intl.formatMessage({ id: ETranslations.global_links })}
            >
              <Tabs.ScrollView>
                <MarketDetailLinks token={token} />
              </Tabs.ScrollView>
            </Tabs.Tab>
          </Tabs.Container>
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
      />
    </AccountSelectorProviderMirror>
  );
}

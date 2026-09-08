import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketTokenIcon } from '../../../Market/components/MarketTokenIcon';
import { PriceChangePercentage } from '../../../Market/components/PriceChangePercentage';
import { TokenPriceChart } from '../../../Market/components/TokenPriceChart';

export function NativeMarketDetailContent({
  coinGeckoId,
}: {
  coinGeckoId: string;
}) {
  const intl = useIntl();
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
        // Preserve the chart on polling failures; initial failures expose retry.
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
      <XStack gap="$2" alignItems="center">
        <MarketTokenIcon uri={token?.image ?? ''} size="sm" />
        <SizableText>{token?.symbol.toUpperCase()}</SizableText>
      </XStack>
    ),
    [token?.image, token?.symbol],
  );

  return (
    <Page>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body>
        {token ? (
          <ScrollView testID="native-asset-market-detail">
            <YStack px="$5" py="$3" gap="$1">
              <SizableText size="$headingMd" color="$textSubdued">
                {token.name}
              </SizableText>
              <Currency sourceCurrency={USD_CURRENCY_ID} size="$heading3xl">
                {token.stats.currentPrice}
              </Currency>
              <PriceChangePercentage>
                {token.stats.performance.priceChangePercentage24h}
              </PriceChangePercentage>
            </YStack>
            <TokenPriceChart coinGeckoId={coinGeckoId} token={token} />
          </ScrollView>
        ) : (
          <Stack flex={1} alignItems="center" justifyContent="center" gap="$2">
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
                  testID="native-asset-market-detail-retry"
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

export default function NativeMarketDetail({
  route,
}: IPageScreenProps<
  IModalAssetDetailsParamList,
  EModalAssetDetailRoutes.MarketDetail
>) {
  return (
    <NativeMarketDetailContent
      key={route.params.token}
      coinGeckoId={route.params.token}
    />
  );
}

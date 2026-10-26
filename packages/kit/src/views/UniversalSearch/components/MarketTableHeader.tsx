import { useIntl } from 'react-intl';

import { SizableText, XStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IMarketSearchMetric,
  type IMarketSearchPriceChangeTitle,
  formatMarketSearchPriceChangeHeader,
} from './marketSearchMetric';

export const MARKET_DATA_COLUMN_WIDTH = 120;

const METRIC_TRANSLATION_IDS: Record<IMarketSearchMetric, ETranslations> = {
  liquidity: ETranslations.global_liquidity,
  marketCap: ETranslations.global_market_cap,
};

export function MarketTableHeader({
  metric = 'liquidity',
  changeTitle = '24h',
}: {
  metric?: IMarketSearchMetric;
  changeTitle?: IMarketSearchPriceChangeTitle;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const priceChangeHeader = formatMarketSearchPriceChangeHeader({
    priceLabel: intl
      .formatMessage({ id: ETranslations.global_price })
      .toUpperCase(),
    changeLabel:
      changeTitle === 'change'
        ? intl
            .formatMessage({ id: ETranslations.market_stock_change__title })
            .toUpperCase()
        : undefined,
  });
  return (
    <XStack alignSelf="stretch" mx="$2" px="$3" py="$1.5" gap="$3" ai="center">
      <XStack flex={1} minWidth={0} gap="$1" ai="center">
        <XStack w="$8" ai="center" jc="center">
          <SizableText size="$bodySm" color="$textSubdued">
            #
          </SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued" flex={1}>
          {intl.formatMessage({ id: ETranslations.global_name }).toUpperCase()}
        </SizableText>
      </XStack>
      <XStack flexShrink={0} ai="center">
        <XStack w={gtMd ? MARKET_DATA_COLUMN_WIDTH : undefined} jc="flex-end">
          <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
            {priceChangeHeader}
          </SizableText>
        </XStack>
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end">
            <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
              {intl
                .formatMessage({ id: METRIC_TRANSLATION_IDS[metric] })
                .toUpperCase()}
            </SizableText>
          </XStack>
        ) : null}
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end">
            <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
              {intl
                .formatMessage({ id: ETranslations.dexmarket_turnover })
                .toUpperCase()}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    </XStack>
  );
}

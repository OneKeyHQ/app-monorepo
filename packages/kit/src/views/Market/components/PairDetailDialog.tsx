import BigNumber from 'bignumber.js';
import { differenceInDays } from 'date-fns';
import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketDetailTicker } from '@onekeyhq/shared/types/market';

import { MarketPoolIcon } from './MarketPoolIcon';
import { MarketTokenAddress } from './MarketTokenAddress';
import { PoolDetailsItem } from './PoolDetailDialog';

export function PairDetailDialog({
  item: {
    logo,
    base,
    target,
    market,
    last,
    volume,
    bid_ask_spread_percentage: spread,
    trust_score: trustScore,
  },
}: {
  item: IMarketDetailTicker;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$3">
      <XStack gap="$4">
        <PoolDetailsItem
          title={intl.formatMessage({ id: ETranslations.global_pair })}
        >
          {`${base} / ${target}`}
        </PoolDetailsItem>
        <PoolDetailsItem
          title={intl.formatMessage({ id: ETranslations.global_dex })}
        >
          <XStack gap="$1.5">
            <MarketPoolIcon uri={logo} />
            <SizableText size="$bodyMdMedium">{market.name}</SizableText>
          </XStack>
        </PoolDetailsItem>
      </XStack>
      <XStack gap="$4">
        <PoolDetailsItem
          title={intl.formatMessage({ id: ETranslations.global_price })}
          currency
          isNumeric
          formatter="price"
        >
          {String(last)}
        </PoolDetailsItem>
        <PoolDetailsItem
          title={intl.formatMessage({
            id: ETranslations.market_twenty_four_hour_volume,
          })}
          isNumeric
        >
          {String(volume)}
        </PoolDetailsItem>
      </XStack>
      <XStack gap="$4">
        <PoolDetailsItem
          title={intl.formatMessage({
            id: ETranslations.market_spread,
          })}
          isNumeric
          formatter="priceChange"
        >
          {BigNumber(spread).toFixed(2)}
        </PoolDetailsItem>
        <PoolDetailsItem
          title={intl.formatMessage({
            id: ETranslations.market_last_updated,
          })}
          isNumeric
        >
          {intl.formatMessage({
            id: ETranslations.market_last_updated,
          })}
        </PoolDetailsItem>
      </XStack>
      <XStack gap="$4">
        <PoolDetailsItem
          title={intl.formatMessage({
            id: ETranslations.market_trust_score,
          })}
          bordered={false}
        >
          {trustScore === 'green' ? '🟢' : ''}
        </PoolDetailsItem>
      </XStack>
    </YStack>
  );
}

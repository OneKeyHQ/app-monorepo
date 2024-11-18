import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  IconButton,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketDetailTicker } from '@onekeyhq/shared/types/market';

import { MarketPoolIcon } from './MarketPoolIcon';
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
    trade_url: tradeUrl,
  },
}: {
  item: IMarketDetailTicker;
}) {
  const intl = useIntl();
  const pairName = `${base}/${target}`;

  const dialog = useDialogInstance();
  const handleOpenUrl = useCallback(async () => {
    if (platformEnv.isNative) {
      await dialog.close();
    }
    openUrlInApp(tradeUrl);
  }, [dialog, tradeUrl]);
  return (
    <YStack gap="$3" pb="$5">
      <XStack gap="$4">
        <PoolDetailsItem
          title={intl.formatMessage({ id: ETranslations.global_pair })}
        >
          {pairName}
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
      <XStack gap="$1.5" ai="center" pt="$2">
        <XStack gap="$2">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.market_pair_link })}
          </SizableText>
          <SizableText size="$bodyMd">{pairName}</SizableText>
        </XStack>
        <IconButton
          variant="tertiary"
          color="$iconSubdued"
          icon="OpenOutline"
          size="small"
          iconSize="$4"
          onPress={handleOpenUrl}
        />
      </XStack>
    </YStack>
  );
}

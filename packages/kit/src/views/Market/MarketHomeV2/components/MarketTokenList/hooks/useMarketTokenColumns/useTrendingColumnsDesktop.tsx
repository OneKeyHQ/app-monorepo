import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import { MarketStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import type { IMarketTimeRangeValue } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { Txns } from '../../components/Txns';
import { getTokenAgeInfo } from '../../utils/tokenListHelpers';

import type { IMarketToken } from '../../MarketTokenData';

const EMPTY_MARKET_VALUE = '--';

const TOKEN_AGE_TRANSLATION_MAP = {
  hour: ETranslations.dexmarket_token_age_h,
  day: ETranslations.dexmarket_token_age_d,
  month: ETranslations.dexmarket_token_age_m,
  year: ETranslations.dexmarket_token_age_y,
} as const;

function MarketValue({
  value,
  currency,
  subdued,
}: {
  value: number;
  currency?: boolean;
  subdued?: boolean;
}) {
  if (!Number.isFinite(value) || value === 0) {
    return (
      <SizableText
        size={subdued ? '$bodySm' : '$bodyLgMedium'}
        color={subdued ? '$textSubdued' : '$text'}
      >
        {EMPTY_MARKET_VALUE}
      </SizableText>
    );
  }

  return (
    <NumberSizeableText
      size={subdued ? '$bodySm' : '$bodyLgMedium'}
      color={subdued ? '$textSubdued' : '$text'}
      formatter="marketCap"
      formatterOptions={
        currency ? { currency: '$', capAtMaxT: true } : undefined
      }
    >
      {value}
    </NumberSizeableText>
  );
}

export function useTrendingColumnsDesktop({
  networkId,
  timeRange = '1h',
}: {
  networkId?: string;
  timeRange?: IMarketTimeRangeValue;
}): ITableColumn<IMarketToken>[] {
  const intl = useIntl();

  return useMemo(
    () => [
      {
        title: (
          <SizableText pl="$2" size="$bodySmMedium" color="$textSubdued">
            #
          </SizableText>
        ),
        dataIndex: 'star',
        columnWidth: 40,
        render: (_: unknown, record: IMarketToken) => (
          <Stack pl="$2">
            <MarketStarV2
              chainId={record.chainId || networkId || ''}
              contractAddress={record.address}
              from={EWatchlistFrom.Homepage}
              tokenSymbol={record.symbol}
              size="small"
              customIconSize="$4"
              isNative={record.isNative}
            />
          </Stack>
        ),
        renderSkeleton: () => (
          <Skeleton width={24} height={24} borderRadius="$full" />
        ),
      },
      {
        title: `${intl.formatMessage({
          id: ETranslations.global_name,
        })}/${intl.formatMessage({
          id: ETranslations.dexmarket_token_age,
        })}`,
        dataIndex: 'nameTokenAge',
        columnWidth: 260,
        render: (_: unknown, record: IMarketToken) => {
          const ageInfo = getTokenAgeInfo(record.firstTradeTime);
          const ageLabel = ageInfo
            ? intl.formatMessage(
                { id: TOKEN_AGE_TRANSLATION_MAP[ageInfo.unit] },
                { amount: ageInfo.amount },
              )
            : EMPTY_MARKET_VALUE;

          return (
            <XStack alignItems="center" gap="$3" minWidth={0}>
              <Token
                size="lg"
                borderRadius="$full"
                tokenImageUri={record.tokenImageUri}
                tokenImageUris={record.tokenImageUris}
                networkImageUri={record.networkLogoUri}
                fallbackIcon="CryptoCoinOutline"
              />
              <YStack minWidth={0} flex={1} gap="$0.5">
                <XStack alignItems="center" gap="$1" minWidth={0}>
                  <SizableText
                    size="$bodyLgMedium"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {record.symbol}
                  </SizableText>
                  {record.communityRecognized ? (
                    <CommunityRecognizedBadge />
                  ) : null}
                </XStack>
                <SizableText size="$bodySm" color="$textSubdued">
                  {ageLabel}
                </SizableText>
              </YStack>
            </XStack>
          );
        },
        renderSkeleton: () => (
          <XStack alignItems="center" gap="$3">
            <Skeleton width={40} height={40} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={80} height={16} />
              <Skeleton width={40} height={12} />
            </YStack>
          </XStack>
        ),
      },
      {
        title: `MCap/${intl.formatMessage({
          id: ETranslations.global_price,
        })}`,
        dataIndex: 'marketCapPrice',
        columnProps: { flex: 1.25 },
        render: (_: unknown, record: IMarketToken) => (
          <YStack gap="$0.5">
            <MarketValue value={record.marketCap} currency />
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter={record.price > 1_000_000 ? 'marketCap' : 'price'}
              formatterOptions={{ currency: '$', capAtMaxT: true }}
            >
              {record.price}
            </NumberSizeableText>
          </YStack>
        ),
        renderSkeleton: () => (
          <YStack gap="$1">
            <Skeleton width={80} height={16} />
            <Skeleton width={64} height={12} />
          </YStack>
        ),
      },
      {
        title: intl.formatMessage(
          { id: ETranslations.market_change_in_range },
          { range: timeRange },
        ),
        dataIndex: 'change24h',
        columnProps: { flex: 1 },
        render: (value: number, record: IMarketToken) => {
          if (record.priceChangeRaw === '-') {
            return <SizableText size="$bodyLgMedium">--</SizableText>;
          }
          const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
            priceChange: value,
          });
          return (
            <NumberSizeableText
              size="$bodyLgMedium"
              color={changeColor}
              formatter="priceChange"
              formatterOptions={{ showPlusMinusSigns }}
            >
              {value}
            </NumberSizeableText>
          );
        },
        renderSkeleton: () => <Skeleton width={60} height={16} />,
      },
      {
        title: intl.formatMessage({ id: ETranslations.dexmarket_liquidity }),
        dataIndex: 'liquidity',
        columnProps: { flex: 1 },
        render: (value: number) => <MarketValue value={value} currency />,
        renderSkeleton: () => <Skeleton width={80} height={16} />,
      },
      {
        title: intl.formatMessage(
          { id: ETranslations.market_txns_in_range },
          { range: timeRange },
        ),
        dataIndex: 'transactions',
        columnProps: { flex: 1 },
        render: (value: number, record: IMarketToken) => (
          <Txns transactions={value} walletInfo={record.walletInfo} />
        ),
        renderSkeleton: () => (
          <YStack gap="$1">
            <Skeleton width={50} height={14} />
            <Skeleton width={64} height={12} />
          </YStack>
        ),
      },
      {
        title: intl.formatMessage(
          { id: ETranslations.market_volume_in_range },
          { range: timeRange },
        ),
        dataIndex: 'turnover',
        columnProps: { flex: 1 },
        render: (value: number) => <MarketValue value={value} currency />,
        renderSkeleton: () => <Skeleton width={90} height={16} />,
      },
    ],
    [intl, networkId, timeRange],
  );
}

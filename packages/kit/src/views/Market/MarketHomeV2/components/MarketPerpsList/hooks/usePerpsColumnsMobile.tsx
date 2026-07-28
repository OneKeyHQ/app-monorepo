import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  LeverageBadge,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IMarketPerpsToken } from './useMarketPerpsTokenList';

export function usePerpsColumnsMobile(): ITableColumn<IMarketPerpsToken>[] {
  const intl = useIntl();
  return useMemo(
    () => [
      // Column 1: Token info
      {
        title: intl.formatMessage({ id: ETranslations.global_name }),
        titleProps: { paddingBottom: '$2', paddingLeft: '$3' },
        dataIndex: 'tokenInfo',
        columnWidth: '50%',
        render: (_: unknown, record: IMarketPerpsToken) => (
          <XStack
            alignItems="center"
            gap="$3"
            ml="$3"
            minWidth={0}
            overflow="hidden"
          >
            <Token
              size="md"
              borderRadius="$full"
              tokenImageUri={record.tokenImageUrl}
              fallbackIcon="CryptoCoinOutline"
            />
            <YStack flex={1} minWidth={0}>
              <XStack alignItems="center" gap="$1" minWidth={0}>
                <SizableText
                  size="$bodyLgMedium"
                  numberOfLines={1}
                  maxWidth="$32"
                  flexShrink={1}
                  ellipsizeMode="tail"
                  userSelect="none"
                >
                  {record.displayName}
                </SizableText>
                <LeverageBadge leverage={record.maxLeverage} />
              </XStack>
              <XStack alignItems="center" gap="$1" minWidth={0}>
                {record.subtitle ? (
                  <SubtitleText subtitle={record.subtitle} />
                ) : null}
                <NumberSizeableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                  formatter="marketCap"
                  userSelect="none"
                >
                  {record.volume24h ?? '0'}
                </NumberSizeableText>
              </XStack>
            </YStack>
          </XStack>
        ),
        renderSkeleton: () => (
          <XStack alignItems="center" paddingLeft="$5" gap="$3">
            <Skeleton width={32} height={32} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={80} height={16} />
              <Skeleton width={60} height={12} />
            </YStack>
          </XStack>
        ),
      },
      // Column 2: Price + Change
      {
        title: `${intl.formatMessage({ id: ETranslations.global_price })} / ${intl.formatMessage({ id: ETranslations.dexmarket_token_change })}`,
        titleProps: { paddingBottom: '$2', paddingRight: '$3' },
        dataIndex: 'price',
        columnWidth: '50%',
        align: 'right' as const,
        render: (_: unknown, record: IMarketPerpsToken) => {
          let changeColor = '$textSubdued';
          if (record.change24hPercent !== undefined) {
            changeColor =
              record.change24hPercent >= 0 ? '$textSuccess' : '$textCritical';
          }
          return (
            <XStack justifyContent="flex-end" alignItems="center" mr="$3">
              <YStack alignItems="flex-end">
                <NumberSizeableText
                  userSelect="none"
                  flexShrink={1}
                  numberOfLines={1}
                  size="$bodyLgMedium"
                  formatter="price"
                  formatterOptions={{ currency: '$' }}
                >
                  {record.markPrice ?? '0'}
                </NumberSizeableText>
                <NumberSizeableText
                  size="$bodyMd"
                  color={changeColor}
                  formatter="priceChange"
                  formatterOptions={{ showPlusMinusSigns: true }}
                >
                  {record.change24hPercent ?? 0}
                </NumberSizeableText>
              </YStack>
            </XStack>
          );
        },
        renderSkeleton: () => (
          <XStack
            justifyContent="flex-end"
            alignItems="center"
            paddingRight="$5"
          >
            <Skeleton width="$20" height="$8" borderRadius="$2" />
          </XStack>
        ),
      },
    ],
    [intl],
  );
}

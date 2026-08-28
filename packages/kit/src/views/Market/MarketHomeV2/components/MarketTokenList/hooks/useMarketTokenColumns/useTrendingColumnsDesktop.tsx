import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ITableColumn } from '@onekeyhq/components';
import {
  Icon,
  NATIVE_HIT_SLOP,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import { MarketStarV2 } from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import type { IMarketTimeRangeValue } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  ECopyFrom,
  EWatchlistFrom,
} from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';

import { Txns } from '../../components/Txns';
import { getTokenAgeInfo } from '../../utils/tokenListHelpers';

import type { IMarketToken } from '../../MarketTokenData';
import type { GestureResponderEvent } from 'react-native';

const EMPTY_MARKET_VALUE = '--';

/**
 * Tamagui group set on Trending data rows so the name cell can react to a hover
 * anywhere on that row. Tamagui only accepts a group name as a literal style
 * prop key, so this constant and the `$group-marketTokenRow-hover` prop below
 * must be kept in sync by hand.
 *
 * `as const` keeps the literal type from widening to `string` when the name is
 * carried through a variable into an untyped row-props object.
 */
export const MARKET_TOKEN_ROW_GROUP_NAME = 'marketTokenRow' as const;

// The token age and the contract address share one line-height window and the
// pair slides up on hover, so the age is pushed out by the address rather than
// dissolving underneath it. 16px is the `$bodySm` line box both lines use.
const TOKEN_SECONDARY_LINE_HEIGHT = 16;

const secondaryTextProps = {
  size: '$bodySm',
  color: '$textSubdued',
  numberOfLines: 1,
  ellipsizeMode: 'tail',
} as const;

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

/**
 * Shortened contract address plus a copy button. Kept as its own component
 * because a column `render` callback is a plain function and cannot use hooks.
 */
function TokenContractAddressLine({ address }: { address: string }) {
  const { copyText } = useClipboard();

  const handleCopy = useCallback(
    (event: GestureResponderEvent) => {
      // Pressing anywhere on the row navigates to the token detail page.
      event.stopPropagation();
      copyText(address);
      defaultLogger.dex.actions.dexCopyCA({
        copyFrom: ECopyFrom.Homepage,
        copiedContent: address,
      });
    },
    [address, copyText],
  );

  return (
    <XStack
      height={TOKEN_SECONDARY_LINE_HEIGHT}
      alignItems="center"
      gap="$0.5"
      minWidth={0}
    >
      <SizableText {...secondaryTextProps}>
        {accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 4,
        })}
      </SizableText>
      <Stack
        cursor="pointer"
        hitSlop={NATIVE_HIT_SLOP}
        hoverStyle={{ opacity: 0.75 }}
        pressStyle={{ opacity: 0.5 }}
        onPress={handleCopy}
      >
        <Icon name="Copy3Outline" size="$3.5" color="$iconSubdued" />
      </Stack>
    </XStack>
  );
}

/**
 * Name-column subtitle for the Trending desktop table. It normally shows the
 * token age; while the row is hovered it slides up to reveal the copyable
 * contract address.
 *
 * The swap is CSS-only: the data row carries a Tamagui `group`, so both lines
 * render once and only the sliding wrapper reacts to the group's hover state.
 * Row-level JS hover state would mean a setState per row on every pointer move,
 * and the shared Table component exposes no row hover hook to piggyback on.
 */
function TrendingTokenSecondaryLine({
  address,
  ageLabel,
}: {
  address: string;
  ageLabel?: string;
}) {
  const ageLine = (
    <XStack
      height={TOKEN_SECONDARY_LINE_HEIGHT}
      alignItems="center"
      minWidth={0}
    >
      <SizableText {...secondaryTextProps}>
        {ageLabel ?? EMPTY_MARKET_VALUE}
      </SizableText>
    </XStack>
  );

  if (!address) {
    return ageLine;
  }

  // Hover never fires on native, and there is no age to slide away from when
  // `firstTradeTime` is missing. Both cases show the address up front so the
  // copy button stays reachable, the same fallback the stock list uses.
  // Touch-capable desktop browsers are deliberately not excluded: they still
  // have a pointer, and treating them as touch-only would hide the age from
  // every touchscreen laptop.
  const canSwapOnHover = Boolean(ageLabel) && !platformEnv.isNative;

  if (!canSwapOnHover) {
    return <TokenContractAddressLine address={address} />;
  }

  return (
    <Stack height={TOKEN_SECONDARY_LINE_HEIGHT} overflow="hidden" minWidth={0}>
      <Stack
        transition="quick"
        animateOnly={ANIMATE_ONLY_TRANSFORM}
        y={0}
        $group-marketTokenRow-hover={{ y: -TOKEN_SECONDARY_LINE_HEIGHT }}
      >
        {ageLine}
        <TokenContractAddressLine address={address} />
      </Stack>
    </Stack>
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
            : undefined;

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
                <TrendingTokenSecondaryLine
                  address={record.address}
                  ageLabel={ageLabel}
                />
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
        title: `${timeRange} Change`,
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
        title: `${timeRange} ${intl.formatMessage({
          id: ETranslations.dexmarket_txns,
        })}`,
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
        title: `${timeRange} Volume`,
        dataIndex: 'turnover',
        columnProps: { flex: 1 },
        render: (value: number) => <MarketValue value={value} currency />,
        renderSkeleton: () => <Skeleton width={90} height={16} />,
      },
    ],
    [intl, networkId, timeRange],
  );
}

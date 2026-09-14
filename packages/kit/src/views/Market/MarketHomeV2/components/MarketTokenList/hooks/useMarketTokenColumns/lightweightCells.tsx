import { SizableText, Stack, XStack } from '@onekeyhq/components';
import {
  MARKET_CELL_LINE_GAP,
  MARKET_CELL_LOGO_GAP,
} from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketListCell';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IMarketToken } from '../../MarketTokenData';

export const EMPTY_MARKET_VALUE = '--';

/**
 * Web cold start keeps only the first rows rich and renders the rest as plain
 * text until the measured startup window closes; see `deferRichRowAfterIndex`
 * in MarketTokenListBase.
 */
export function shouldUseLightweightCell(
  index: number | undefined,
  deferRichRowAfterIndex: number | undefined,
) {
  return (
    deferRichRowAfterIndex !== undefined &&
    (index ?? 0) >= deferRichRowAfterIndex
  );
}

export function formatLightweightMarketValue(value: unknown) {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return EMPTY_MARKET_VALUE;
  }

  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  const absValue = Math.abs(numericValue);
  if (absValue >= 1_000_000_000) {
    return `${(numericValue / 1_000_000_000).toFixed(absValue >= 10_000_000_000 ? 0 : 1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(absValue >= 10_000_000 ? 0 : 1)}M`;
  }
  if (absValue >= 1000) {
    return `${(numericValue / 1000).toFixed(absValue >= 10_000 ? 0 : 1)}K`;
  }
  if (absValue > 0 && absValue < 0.01) {
    return numericValue.toPrecision(3);
  }
  if (absValue % 1 === 0) {
    return String(numericValue);
  }
  return numericValue.toFixed(absValue >= 100 ? 1 : 2);
}

export function renderLightweightText(value: unknown) {
  return (
    <SizableText size="$bodyLgMedium" numberOfLines={1} ellipsizeMode="tail">
      {formatLightweightMarketValue(value)}
    </SizableText>
  );
}

export function renderLightweightTokenIdentity(record: IMarketToken) {
  const subtitle = record.address
    ? accountUtils.shortenAddress({
        address: record.address,
        leadingLength: 6,
        trailingLength: 4,
      })
    : record.name;

  return (
    <XStack
      alignItems="center"
      gap={MARKET_CELL_LOGO_GAP}
      userSelect="none"
      minWidth={0}
      overflow="hidden"
    >
      <Stack width={40} height={40} borderRadius="$full" bg="$bgStrong" />
      <Stack flex={1} minWidth={0} gap={MARKET_CELL_LINE_GAP}>
        <SizableText
          size="$bodyLgMedium"
          numberOfLines={1}
          maxWidth="$32"
          flexShrink={1}
          ellipsizeMode="tail"
        >
          {record.symbol}
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {subtitle}
        </SizableText>
      </Stack>
    </XStack>
  );
}

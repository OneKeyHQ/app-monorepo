import { useCallback } from 'react';

import {
  Icon,
  NATIVE_HIT_SLOP,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ECopyFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { MarketHoverRevealLine } from './MarketHoverRevealLine';
import {
  EMPTY_MARKET_VALUE,
  MARKET_CELL_SECONDARY_LINE_HEIGHT,
  MarketCellSecondary,
} from './MarketListCell';

import type { GestureResponderEvent } from 'react-native';

// The token age and the contract address share one line-height window and the
// pair slides up on hover, so the age is pushed out by the address rather than
// dissolving underneath it.
const TOKEN_SECONDARY_LINE_HEIGHT = MARKET_CELL_SECONDARY_LINE_HEIGHT;

// The age reads at full strength; the address that replaces it on hover is
// the design's regular, subdued face.
const AGE_TEXT_COLOR = '$text';
const ADDRESS_TEXT_PROPS = {
  size: '$bodySm',
  color: '$textSubdued',
} as const;

/**
 * Shortened contract address plus a copy button. Kept as its own component
 * because a column `render` callback is a plain function and cannot use hooks.
 */
export function TokenContractAddressLine({
  address,
  copyFrom = ECopyFrom.Homepage,
  lineHeight = TOKEN_SECONDARY_LINE_HEIGHT,
  size = ADDRESS_TEXT_PROPS.size,
}: {
  address: string;
  copyFrom?: ECopyFrom;
  /** The line box it slides into; a subtitle-sized line needs the taller box. */
  lineHeight?: number;
  size?: ISizableTextProps['size'];
}) {
  const { copyText } = useClipboard();

  const handleCopy = useCallback(
    (event: GestureResponderEvent) => {
      // Pressing anywhere on the row navigates to the token detail page.
      event.stopPropagation();
      copyText(address);
      defaultLogger.dex.actions.dexCopyCA({
        copyFrom,
        copiedContent: address,
      });
    },
    [address, copyFrom, copyText],
  );

  return (
    <XStack height={lineHeight} alignItems="center" gap="$0.5" minWidth={0}>
      <MarketCellSecondary size={size} color={ADDRESS_TEXT_PROPS.color}>
        {accountUtils.shortenAddress({
          address,
          leadingLength: 6,
          trailingLength: 4,
        })}
      </MarketCellSecondary>
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
 * Name-column subtitle shared by the Trending table and the spot-token rows of
 * the watchlist. It normally shows the token age; while the row is hovered it
 * slides up to reveal the copyable contract address.
 *
 * The swap is CSS-only: the data row carries a Tamagui `group`, so both lines
 * render once and only the sliding wrapper reacts to the group's hover state.
 * Row-level JS hover state would mean a setState per row on every pointer move,
 * and the shared Table component exposes no row hover hook to piggyback on.
 */
export function MarketTokenAgeAddressLine({
  address,
  ageLabel,
  copyFrom,
}: {
  address: string;
  ageLabel?: string;
  copyFrom?: ECopyFrom;
}) {
  const ageLine = (
    <XStack
      height={TOKEN_SECONDARY_LINE_HEIGHT}
      alignItems="center"
      minWidth={0}
    >
      <MarketCellSecondary color={AGE_TEXT_COLOR}>
        {ageLabel ?? EMPTY_MARKET_VALUE}
      </MarketCellSecondary>
    </XStack>
  );

  if (!address) {
    return ageLine;
  }

  // With no age there is nothing to slide away from, so the address stands on
  // its own and its copy button stays reachable.
  if (!ageLabel) {
    return <TokenContractAddressLine address={address} copyFrom={copyFrom} />;
  }

  return (
    <MarketHoverRevealLine
      lineHeight={TOKEN_SECONDARY_LINE_HEIGHT}
      resting={ageLine}
      revealed={
        <TokenContractAddressLine address={address} copyFrom={copyFrom} />
      }
    />
  );
}

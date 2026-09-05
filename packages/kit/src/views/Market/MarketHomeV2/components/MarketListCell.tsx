import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';

// Figma `Market / ListPageTable / TBody`, shared by every desktop list page:
// a 16/24 primary over an optional 12/16 secondary, 4px apart, and 14px from
// the 40px logo to that text group.
export const MARKET_CELL_PRIMARY_SIZE = '$bodyLgMedium';
export const MARKET_CELL_SECONDARY_SIZE = '$bodySmMedium';
// A name's subtitle — the company or localized token name — reads a step up
// from a metric's secondary line. Stocks sets the scale.
export const MARKET_CELL_SUBTITLE_SIZE = '$bodyMd';
export const MARKET_CELL_LINE_GAP = '$1';
export const MARKET_CELL_LOGO_GAP = 14;
export const MARKET_CELL_SECONDARY_LINE_HEIGHT = 16;

export function MarketCellPrimary({
  children,
  color = '$text',
  ...rest
}: { children: ReactNode } & ISizableTextProps) {
  return (
    <SizableText
      size={MARKET_CELL_PRIMARY_SIZE}
      color={color}
      numberOfLines={1}
      ellipsizeMode="tail"
      {...rest}
    >
      {children}
    </SizableText>
  );
}

export function MarketCellSecondary({
  children,
  color = '$textSubdued',
  ...rest
}: { children: ReactNode } & ISizableTextProps) {
  return (
    <SizableText
      size={MARKET_CELL_SECONDARY_SIZE}
      color={color}
      numberOfLines={1}
      ellipsizeMode="tail"
      {...rest}
    >
      {children}
    </SizableText>
  );
}

/** The two-line text group inside a cell. */
export function MarketCellLines({ children }: { children: ReactNode }) {
  return (
    <YStack
      flex={1}
      minWidth={0}
      justifyContent="center"
      gap={MARKET_CELL_LINE_GAP}
    >
      {children}
    </YStack>
  );
}

/**
 * A first-column cell: the token logo, then the name over its subtitle. Every
 * list page renders this same frame and only swaps what the two lines say.
 */
export function MarketIdentityCell({
  logo,
  primary,
  secondary,
}: {
  logo: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    // Bounded to the column so the name and subtitle ellipsize instead of
    // pushing the row wider.
    <XStack
      width="100%"
      minWidth={0}
      overflow="hidden"
      alignItems="center"
      gap={MARKET_CELL_LOGO_GAP}
    >
      {logo}
      <MarketCellLines>
        {primary}
        {secondary}
      </MarketCellLines>
    </XStack>
  );
}

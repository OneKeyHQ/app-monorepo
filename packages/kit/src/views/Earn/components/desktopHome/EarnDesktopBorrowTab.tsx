import { useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildMarketCard } from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';

import type {
  IEarnDesktopMarketCard,
  IEarnDesktopMarketReserves,
} from './earnDesktopHome.utils';

const COLLATERAL_ICON_LIMIT = 6;

type ICardSurface = '$bgSubdued' | '$gray3' | '$gray4';

// Opaque steps up from the card color, so the rings that separate the
// collateral icons can change with the card
function getCardSurface({
  isHovered,
  isPressed,
}: {
  isHovered: boolean;
  isPressed: boolean;
}): ICardSurface {
  if (isPressed) {
    return '$gray4';
  }
  return isHovered ? '$gray3' : '$bgSubdued';
}

function CollateralStack({
  card,
  ringColor,
}: {
  card: IEarnDesktopMarketCard;
  ringColor: ICardSurface;
}) {
  const visible = card.collateral.slice(0, COLLATERAL_ICON_LIMIT);
  const moreCount = card.collateral.length - visible.length;
  return (
    <XStack ai="center">
      {visible.map((token, index) => (
        <YStack
          key={token.symbol}
          ml={index ? -6 : 0}
          borderRadius="$full"
          borderWidth={2}
          borderColor={ringColor}
          bg={ringColor}
        >
          <Token size="xs" tokenImageUri={token.logoURI} />
        </YStack>
      ))}
      {moreCount > 0 ? (
        <SizableText ml="$2" size="$bodySm" color="$textSubdued">
          {`+${moreCount}`}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function MarketCard({
  card,
  isLoading,
  onPress,
}: {
  card: IEarnDesktopMarketCard;
  isLoading: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const { market } = card;
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const surface = getCardSurface({ isHovered, isPressed });
  return (
    // The tiles' padding, so both kinds of card hold their content alike
    <YStack
      testID={`earn-desktop-market-${card.key}`}
      role="button"
      flexGrow={1}
      bg={surface}
      borderRadius="$5"
      borderCurve="continuous"
      p="$4"
      cursor="pointer"
      userSelect="none"
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onPress={onPress}
    >
      <XStack ai="center" gap="$3">
        <Token
          size="lg"
          tokenImageUri={market.logoURI}
          networkId={market.networkId}
          showNetworkIcon
        />
        <YStack flex={1} minWidth={0}>
          <XStack ai="center" gap="$0.5">
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {card.label}
            </SizableText>
            <Icon
              name="ChevronRightSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {market.network?.name}
          </SizableText>
        </YStack>
      </XStack>
      <SizableText mt="$4" mb="$1" size="$bodySm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.defi_borrow_apy })}
      </SizableText>
      {isLoading && !card.topBorrow.length
        ? Array.from({ length: 3 }).map((_, index) => (
            <XStack key={index} ai="center" gap="$2.5" h={46}>
              <Skeleton w="$7" h="$7" radius="round" />
              <Skeleton w={64} h={16} borderRadius="$2" />
            </XStack>
          ))
        : card.topBorrow.map((row) => (
            <XStack key={row.reserveAddress} ai="center" gap="$2.5" h={46}>
              <Token size="sm" tokenImageUri={row.logoURI} />
              <SizableText flex={1} size="$bodyLgMedium" numberOfLines={1}>
                {row.symbol}
              </SizableText>
              <SizableText size="$bodyLgMedium">
                {`${new BigNumber(row.apy).toFixed(2)}%`}
              </SizableText>
            </XStack>
          ))}
      {card.moreCount > 0 ? (
        <XStack ai="center" gap="$0.5" h={30}>
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {EARN_DESKTOP_DEMO_COPY.more(card.moreCount)}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      ) : null}
      <YStack flexGrow={1} minHeight="$2" />
      <XStack
        pt="$3.5"
        ai="center"
        jc="space-between"
        borderTopWidth={1}
        borderTopColor="$borderSubdued"
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.defi_collateral })}
        </SizableText>
        <CollateralStack card={card} ringColor={surface} />
      </XStack>
    </YStack>
  );
}

export function EarnDesktopBorrowTab({
  markets,
  isLoading,
  onOpenMarket,
}: {
  markets: IEarnDesktopMarketReserves[];
  isLoading: boolean;
  onOpenMarket: (market: IBorrowMarketItem) => void;
}) {
  const media = useMedia();
  const cards = useMemo(
    () => markets.map((entry) => buildMarketCard(entry)),
    [markets],
  );
  // Cards sit as far apart as the tiles above the tabs
  if (!cards.length) {
    return (
      <XStack gap="$4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} flex={1} h={320} borderRadius="$5" />
        ))}
      </XStack>
    );
  }
  const perRow = media.gtLg ? 3 : 2;
  const rows: IEarnDesktopMarketCard[][] = [];
  for (let index = 0; index < cards.length; index += perRow) {
    rows.push(cards.slice(index, index + perRow));
  }
  return (
    <YStack gap="$4">
      {rows.map((rowCards, rowIndex) => (
        <XStack key={rowIndex} gap="$4">
          {/* Unpadded slots split the row evenly, spacers included, so the
              last row's cards keep the others' width */}
          {rowCards.map((card) => (
            <YStack key={card.key} flex={1} flexBasis={0} minWidth={0}>
              <MarketCard
                card={card}
                isLoading={isLoading}
                onPress={() => onOpenMarket(card.market)}
              />
            </YStack>
          ))}
          {Array.from({ length: perRow - rowCards.length }).map((_, index) => (
            <YStack key={`spacer-${index}`} flex={1} flexBasis={0} />
          ))}
        </XStack>
      ))}
    </YStack>
  );
}

import { memo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { resolveHealthFactorValueColor } from '../../../Borrow/components/healthFactorValueColor';
import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { sumBorrowedFiat } from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { EasedSection } from './EarnEasedSection';

import type { IEarnDesktopAccountMarket } from './useEarnDesktopHomeData';

// Wide, the cards share a row three to a row, as the offer cards do
const CARDS_PER_ROW = 3;
// The figures start under the market's name, as on the Loans window's cards
const FIGURES_INDENT = '$12';
const HOVER_MOTION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_BG_COLOR,
} as const;

// How many loans each account had when last read, so a visit while they
// load again keeps their place instead of pushing the list down later
const loanCountByAccount = new Map<string, number>();

function LoanFigure({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <YStack flex={1} flexBasis={0} minWidth={0} gap="$0.5">
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <SizableText
        size="$bodyMdMedium"
        color={color}
        numberOfLines={1}
        fontVariant={['tabular-nums']}
      >
        {value}
      </SizableText>
    </YStack>
  );
}

function BasicLoanCard({
  entry,
  onOpenMarket,
}: {
  entry: IEarnDesktopAccountMarket;
  onOpenMarket: (market: IBorrowMarketItem) => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { symbol: currency } = useCurrency();
  const { market } = entry;
  const marketLabel = getBorrowMarketLabel(market);
  const borrowed = sumBorrowedFiat([entry]).toNumber();
  // The figure and its color as the Borrow page the card opens shows them
  const health = entry.healthFactor?.healthFactor;
  const healthDetail = health?.button?.data?.healthFactorDetail;
  const healthText = healthDetail?.value || health?.text?.text;
  const healthColor = healthDetail
    ? resolveHealthFactorValueColor(healthDetail)
    : health?.text?.color;
  const open = () => onOpenMarket(market);
  return (
    <YStack
      testID={`earn-desktop-your-loan-${buildBorrowMarketKey(market)}`}
      role="button"
      aria-label={`${marketLabel}, ${market.network.name}`}
      gap="$3"
      px="$4"
      py="$3.5"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      cursor="pointer"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={open}
      {...(reduceMotion ? undefined : HOVER_MOTION)}
      {...buildKeyboardPressProps(open, 2)}
    >
      <XStack ai="center" gap="$3">
        <ProtocolImage
          logoURI={market.logoURI}
          networkLogoURI={market.network.logoURI}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {marketLabel}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {market.network.name}
          </SizableText>
        </YStack>
        {/* The market's own page opens */}
        <Icon
          name="ChevronRightSmallOutline"
          size="$5"
          color="$iconSubdued"
          flexShrink={0}
        />
      </XStack>
      <XStack pl={FIGURES_INDENT} gap="$3">
        <LoanFigure
          label={intl.formatMessage({
            id: ETranslations.wallet_defi_asset_type_borrowed,
          })}
          value={String(
            numberFormat(String(borrowed), {
              formatter: 'value',
              formatterOptions: { currency },
            }),
          )}
        />
        <LoanFigure
          label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
          value={healthText || '–'}
          color={healthColor}
        />
      </XStack>
    </YStack>
  );
}

const LoanCard = memo(BasicLoanCard);

function LoanCardSkeleton() {
  return (
    <YStack
      gap="$3"
      px="$4"
      py="$3.5"
      bg="$bgSubdued"
      borderRadius="$3"
      borderCurve="continuous"
    >
      <XStack ai="center" gap="$3">
        <Skeleton w="$9" h="$9" borderRadius="$2" />
        <YStack flex={1} gap="$1.5">
          <Skeleton w={96} h={16} borderRadius="$2" />
          <Skeleton w={64} h={12} borderRadius="$2" />
        </YStack>
      </XStack>
      <XStack pl={FIGURES_INDENT} gap="$3">
        {[0, 1].map((index) => (
          <YStack key={index} flex={1} flexBasis={0} gap="$1.5">
            <Skeleton w={56} h={12} borderRadius="$2" />
            <Skeleton w={48} h={16} borderRadius="$2" />
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

/**
 * The account's loans above the Loans list, one card per market it borrows
 * in: the market, what is borrowed there and its health factor, in the tiers
 * the Loans window reads. A card opens that market's Borrow page, where
 * repaying, collateral and borrowing more are. Nothing shows without a loan
 */
export type IEarnDesktopYourLoansProps = {
  loans: IEarnDesktopAccountMarket[];
  /** The account's markets are read; until then a known count holds */
  isLoaded: boolean;
  accountScope: string;
  onOpenMarket: (market: IBorrowMarketItem) => void;
};

function BasicEarnDesktopYourLoans({
  loans,
  isLoaded,
  accountScope,
  onOpenMarket,
}: IEarnDesktopYourLoansProps) {
  const media = useMedia();
  const isWide = media.gtMd;

  useEffect(() => {
    if (isLoaded) {
      loanCountByAccount.set(accountScope, loans.length);
    }
  }, [accountScope, isLoaded, loans.length]);

  const count = isLoaded
    ? loans.length
    : (loanCountByAccount.get(accountScope) ?? 0);
  let cards: ReactNode[] = [];
  if (count > 0) {
    cards = isLoaded
      ? loans.map((entry) => (
          <LoanCard
            key={buildBorrowMarketKey(entry.market)}
            entry={entry}
            onOpenMarket={onOpenMarket}
          />
        ))
      : Array.from({ length: count }).map((_, index) => (
          <LoanCardSkeleton key={index} />
        ));
  }

  let grid: ReactNode = null;
  if (cards.length && isWide) {
    // Rows of three; a short row keeps the cards a third wide
    const rows: ReactNode[][] = [];
    for (let index = 0; index < cards.length; index += CARDS_PER_ROW) {
      rows.push(cards.slice(index, index + CARDS_PER_ROW));
    }
    grid = (
      <YStack gap="$3">
        {rows.map((row, rowIndex) => (
          <XStack key={rowIndex} gap="$3">
            {row.map((card, index) => (
              <Stack key={index} flex={1} flexBasis={0} minWidth={0}>
                {card}
              </Stack>
            ))}
            {Array.from({ length: CARDS_PER_ROW - row.length }).map(
              (_, index) => (
                <Stack key={`room-${index}`} flex={1} flexBasis={0} />
              ),
            )}
          </XStack>
        ))}
      </YStack>
    );
  } else if (cards.length) {
    grid = <YStack gap="$2">{cards}</YStack>;
  }

  return (
    // The cards come and go with the room under them, easing the list below
    <EasedSection>
      {grid ? (
        <YStack testID="earn-desktop-your-loans" gap="$3" pb="$8">
          <SizableText size="$headingMd">
            {EARN_DESKTOP_DEMO_COPY.yourLoans}
          </SizableText>
          {grid}
        </YStack>
      ) : null}
    </EasedSection>
  );
}

export const EarnDesktopYourLoans = memo(BasicEarnDesktopYourLoans);

/** A loan's market opens on the Borrow page, the market's own page */
export function useEarnDesktopOpenBorrowMarket() {
  const navigation = useAppNavigation();
  return useCallback(
    (market: IBorrowMarketItem) =>
      BorrowNavigation.pushToBorrowHome(navigation, market),
    [navigation],
  );
}

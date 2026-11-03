import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Accordion,
  Badge,
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { getBorrowMarketLabel } from '../../../Borrow/borrowMarketDisplayName';
import { buildBorrowMarketKey } from '../../../Borrow/borrowMarketKey';
import { BorrowNavigation } from '../../../Borrow/borrowUtils';
import { resolveHealthFactorValueColor } from '../../../Borrow/components/healthFactorValueColor';
import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { EarnNavigation } from '../../earnUtils';
import {
  LOAN_HEALTH_TEXT_COLOR,
  getLoanHealthTone,
} from '../../pages/EarnLoanRouter/loanRouter.utils';
import {
  LIST_HIDDEN_STYLE,
  getListHeightTransition,
  getListRowMotion,
} from '../../utils/earnListMotion';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import {
  readLoanHealth,
  sortLoansByRisk,
  summarizeLoanPosition,
} from './earnDesktopHome.utils';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { EasedSection } from './EarnEasedSection';
import { EarnLoanAssetLogos } from './EarnLoanAssetLogos';
import { EarnMoreToggle } from './EarnMoreToggle';

import type { IEarnDesktopAccountMarket } from './useEarnDesktopHomeData';

// Wide, the cards share a row three to a row, as the offer cards do
const CARDS_PER_ROW = 3;
// Three cards, the first row wide; the rest open in place (demo 11-03)
const CARD_LIMIT = 3;
const MORE_CARDS_VALUE = 'more';
const HOVER_MOTION = {
  transition: 'quick',
  animateOnly: ANIMATE_ONLY_BG_COLOR,
} as const;

// How many loans each account had when last read, so a visit while they
// load again keeps their place instead of pushing the list down later
const loanCountByAccount = new Map<string, number>();

// A line of the card as the Loans window's position writes it: the label on
// the left, the figure on the right
function LoanCardRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack jc="space-between" ai="center" gap="$3" minHeight="$6">
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        numberOfLines={1}
        flexShrink={0}
      >
        {label}
      </SizableText>
      <XStack ai="center" jc="flex-end" gap="$2" flexShrink={1} minWidth={0}>
        {children}
      </XStack>
    </XStack>
  );
}

function LoanCardValue({
  children,
  color,
}: {
  children: string;
  color?: ColorTokens;
}) {
  return (
    <SizableText
      size="$bodyMdMedium"
      color={color}
      numberOfLines={1}
      fontVariant={['tabular-nums']}
    >
      {children}
    </SizableText>
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
  // The logos' rings take the card's color as it lights
  const [isHovered, setIsHovered] = useState(false);
  const { market } = entry;
  const marketLabel = getBorrowMarketLabel(market);
  const position = summarizeLoanPosition(entry.reserves);
  const formatFiat = (value: number) =>
    String(
      numberFormat(String(value), {
        formatter: 'value',
        formatterOptions: { currency },
      }),
    );
  // The figure, its color and status as the Borrow page the card opens
  // shows them
  const health = readLoanHealth(entry.healthFactor);
  let healthColor: ColorTokens | undefined;
  if (health.detail) {
    healthColor = resolveHealthFactorValueColor(health.detail);
  } else if (health.value !== undefined) {
    healthColor = LOAN_HEALTH_TEXT_COLOR[getLoanHealthTone(health.value)];
  }
  // The hover color is see-through: a ring in it would show the card twice
  // over, so the ring takes the solid step the lit card shows as
  const ringColor = isHovered ? '$gray3' : '$bgSubdued';
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
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
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
        {/* The market's card on My portfolio opens */}
        <Icon
          name="ChevronRightSmallOutline"
          size="$5"
          color="$iconSubdued"
          flexShrink={0}
        />
      </XStack>
      <YStack gap="$2">
        <LoanCardRow
          label={intl.formatMessage({ id: ETranslations.defi_collateral })}
        >
          <EarnLoanAssetLogos
            assets={position.collateralAssets}
            ringColor={ringColor}
          />
          <LoanCardValue>{formatFiat(position.collateralValue)}</LoanCardValue>
        </LoanCardRow>
        <LoanCardRow
          label={intl.formatMessage({
            id: ETranslations.wallet_defi_asset_type_borrowed,
          })}
        >
          <EarnLoanAssetLogos
            assets={position.debtAssets}
            ringColor={ringColor}
          />
          <LoanCardValue>{formatFiat(position.debtValue)}</LoanCardValue>
        </LoanCardRow>
        <LoanCardRow
          label={intl.formatMessage({ id: ETranslations.defi_health_factor })}
        >
          <LoanCardValue color={healthColor}>
            {health.text || '–'}
          </LoanCardValue>
          {health.detail?.status?.tag ? (
            <Badge badgeType={health.detail.status.badge}>
              {health.detail.status.tag}
            </Badge>
          ) : null}
        </LoanCardRow>
      </YStack>
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
      <YStack gap="$2">
        {[0, 1, 2].map((index) => (
          <XStack key={index} h="$6" jc="space-between" ai="center">
            <Skeleton w={72} h={14} borderRadius="$2" />
            <Skeleton w={64} h={14} borderRadius="$2" />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

/**
 * The account's loans above the Loans list, one card per market it borrows
 * in, the riskiest first: the market, then what backs its loans, what is
 * borrowed and the health factor, written as the Loans window writes the
 * position, the health factor in the Borrow page's words. Three cards, then
 * "Show N more" opens the rest in place (demo 11-03). A card opens that
 * market's card on My portfolio, where its rows withdraw, repay and set
 * collateral (useEarnDesktopOpenYourLoan). Nothing shows without a loan
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
  const reduceMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      loanCountByAccount.set(accountScope, loans.length);
    }
  }, [accountScope, isLoaded, loans.length]);

  const sortedLoans = useMemo(() => sortLoansByRisk(loans), [loans]);
  const count = isLoaded
    ? loans.length
    : (loanCountByAccount.get(accountScope) ?? 0);
  let cards: ReactNode[] = [];
  if (count > 0) {
    cards = isLoaded
      ? sortedLoans.map((entry) => (
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

  // Wide, rows of three; a short row keeps the cards a third wide
  const layOut = (list: ReactNode[], isFold: boolean) => {
    if (!isWide) {
      return (
        <YStack gap="$2">
          {list.map((card, index) =>
            isFold ? (
              <YStack key={index} {...getListRowMotion(index, reduceMotion)}>
                {card}
              </YStack>
            ) : (
              card
            ),
          )}
        </YStack>
      );
    }
    const rows: ReactNode[][] = [];
    for (let index = 0; index < list.length; index += CARDS_PER_ROW) {
      rows.push(list.slice(index, index + CARDS_PER_ROW));
    }
    return (
      <YStack gap="$3">
        {rows.map((row, rowIndex) => (
          <XStack
            key={rowIndex}
            gap="$3"
            {...(isFold ? getListRowMotion(rowIndex, reduceMotion) : undefined)}
          >
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
  };
  const moreCards = cards.slice(CARD_LIMIT);
  const grid: ReactNode = cards.length ? (
    <YStack>
      {layOut(cards.slice(0, CARD_LIMIT), false)}
      {/* The rest unfold under the first cards as the holdings list's rows
          do, and fade as they fold */}
      {moreCards.length ? (
        <Accordion
          type="single"
          collapsible
          value={isExpanded ? MORE_CARDS_VALUE : ''}
        >
          <Accordion.Item value={MORE_CARDS_VALUE}>
            <Accordion.HeightAnimator
              transition={getListHeightTransition(isExpanded, reduceMotion)}
            >
              <Accordion.Content
                unstyled
                transition="quick"
                animateOnly={ANIMATE_ONLY_OPACITY}
                exitStyle={LIST_HIDDEN_STYLE}
              >
                <YStack pt={isWide ? '$3' : '$2'}>
                  {layOut(moreCards, true)}
                </YStack>
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      ) : null}
      {moreCards.length ? (
        // On the cards' content edge
        <XStack pl="$4">
          <EarnMoreToggle
            testID="earn-desktop-your-loans-more"
            count={moreCards.length}
            isExpanded={isExpanded}
            onPress={() => setIsExpanded((prev) => !prev)}
          />
        </XStack>
      ) : null}
    </YStack>
  ) : null;

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

/**
 * A Your loans card opens My portfolio on its market's card (demo 11-03),
 * where the market's rows withdraw, repay and set collateral. The apps'
 * My portfolio reads no lending market of its own, so there the card opens
 * the market's Borrow page, as before
 */
export function useEarnDesktopOpenYourLoan() {
  const navigation = useAppNavigation();
  return useCallback(
    (market: IBorrowMarketItem) => {
      if (platformEnv.isNative) {
        BorrowNavigation.pushToBorrowHome(navigation, market);
        return;
      }
      EarnNavigation.pushToEarnPositions(navigation, {
        focusMarket: buildBorrowMarketKey(market),
      });
    },
    [navigation],
  );
}

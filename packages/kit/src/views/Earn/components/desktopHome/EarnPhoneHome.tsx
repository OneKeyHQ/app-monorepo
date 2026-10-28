import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { SizableText, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_HEIGHT } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AvailableAssetsFlatList } from '../AvailableAssetsFlatList';
import { EarnHomeShortcuts } from '../EarnHomeShortcuts';
import { EARN_SECTION_GAP } from '../earnListRhythm';
import { FAQContent } from '../FAQContent';

import {
  EarnDesktopHoldCard,
  EarnDesktopHoldCardSkeleton,
} from './EarnDesktopHoldCard';
import { EarnPhoneLoansPreview } from './EarnPhoneLoansPreview';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopLoanPair,
  IEarnDesktopMarketReserves,
} from './earnDesktopHome.utils';

const SECTION_EASE_MS = 250;
// As the hero's rewards row eases in and out
const SECTION_EASE = ['smooth', { duration: SECTION_EASE_MS }] as [
  'smooth',
  { duration: number },
];

/**
 * A block whose height eases to its content's, so what's below moves
 * smoothly instead of at once. Without an easeKey every change eases (a
 * section that arrives or leaves after the page has drawn). With one, only a
 * change of key eases (one kind of content taking another's place); between
 * changes the block follows its content, whose own motion stays its own
 */
function EasedSection({
  easeKey,
  children,
}: {
  easeKey?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const easesAlways = easeKey === undefined;
  // The content's last measured height
  const measuredRef = useRef<number | undefined>(undefined);
  // Held while easing; undefined lets the content set the height
  const [height, setHeight] = useState<number>();
  const [isEasing, setIsEasing] = useState(false);
  const keyRef = useRef(easeKey);
  // A new kind of content: hold the old height before it paints, then ease
  // to the new one once measured
  useLayoutEffect(() => {
    if (easesAlways || keyRef.current === easeKey) {
      return;
    }
    keyRef.current = easeKey;
    if (reduceMotion || measuredRef.current === undefined) {
      return;
    }
    setHeight(measuredRef.current);
    setIsEasing(true);
  }, [easeKey, easesAlways, reduceMotion]);
  // Past the ease, the content sets the height again
  useEffect(() => {
    if (!isEasing) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsEasing(false);
      setHeight(undefined);
    }, SECTION_EASE_MS + 100);
    return () => clearTimeout(timer);
  }, [isEasing, easeKey]);
  const isEased = !reduceMotion && (easesAlways || isEasing);
  return (
    <YStack
      h={height}
      overflow={easesAlways || isEasing ? 'hidden' : undefined}
      transition={isEased ? SECTION_EASE : undefined}
      animateOnly={ANIMATE_ONLY_HEIGHT}
    >
      <YStack
        onLayout={(event) => {
          const measured = Math.round(event.nativeEvent.layout.height);
          measuredRef.current = measured;
          if (easesAlways || isEasing) {
            setHeight(measured);
          }
        }}
      >
        {children}
      </YStack>
    </YStack>
  );
}

/**
 * The DeFi home on a phone-wide screen: the same totals, rows and windows as
 * the wide layout, with its lists one tap away instead of in tabs. From the
 * top: the totals (or the guide), the Tokens, Loans and Protocols entries,
 * the banner, the wallet's tokens, Trending tokens and Fixed Income as the
 * phone app shows them, the first Loans pairs, then the questions
 */
export function EarnPhoneHome({
  header,
  headerKind,
  banner,
  showsHoldings,
  isHoldLoading,
  holdRows,
  networkNames,
  markets,
  isMarketsLoaded,
  faqList,
  isFaqLoading,
  onOpenTokens,
  onOpenLoans,
  onOpenProtocols,
  onOpenHoldRow,
  onOpenHoldings,
  onOpenLoanPair,
}: {
  /** The totals, or the guide while the account has no positions */
  header: ReactNode;
  /** Which of the two the header is; a change eases the page's top */
  headerKind: 'totals' | 'guide';
  /** The banner block, sized to show its art whole */
  banner: ReactNode;
  /**
   * Off with no wallet, and for a wallet holding nothing Earn takes (while
   * loading too, once that is known)
   */
  showsHoldings: boolean;
  isHoldLoading: boolean;
  holdRows: IEarnDesktopHoldRow[];
  networkNames: Map<string, string>;
  markets: IEarnDesktopMarketReserves[];
  isMarketsLoaded: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading: boolean;
  onOpenTokens: () => void;
  onOpenLoans: () => void;
  onOpenProtocols: () => void;
  onOpenHoldRow: (row: IEarnDesktopHoldRow) => void;
  onOpenHoldings: () => void;
  onOpenLoanPair: (pair: IEarnDesktopLoanPair) => void;
}) {
  const intl = useIntl();
  let holdings: ReactNode = null;
  if (showsHoldings) {
    holdings = isHoldLoading ? (
      <EarnDesktopHoldCardSkeleton variant="phone" />
    ) : (
      <EarnDesktopHoldCard
        variant="phone"
        rows={holdRows}
        networkNames={networkNames}
        onOpenRow={onOpenHoldRow}
        onOpenAll={onOpenHoldings}
      />
    );
  }
  return (
    <YStack pb="$10">
      {/* The phone home's room above and below its totals */}
      <YStack px="$pagePadding" pt="$6" pb="$6">
        {/* The totals' placeholder is shorter than the guide that takes its
            place for an account without positions */}
        <EasedSection easeKey={headerKind}>{header}</EasedSection>
      </YStack>
      <EarnHomeShortcuts
        onOpenLoans={onOpenLoans}
        onOpenTokens={onOpenTokens}
        onOpenProtocols={onOpenProtocols}
      />
      {banner}
      {/* The holdings leave with the gap after them */}
      <EasedSection>
        {holdings ? <YStack pb={EARN_SECTION_GAP}>{holdings}</YStack> : null}
      </EasedSection>
      {/* The sections keep the phone home's rhythm, Trending tokens and
          Fixed Income included */}
      <YStack gap={EARN_SECTION_GAP}>
        <AvailableAssetsFlatList />
        <EarnPhoneLoansPreview
          markets={markets}
          isMarketsLoaded={isMarketsLoaded}
          onOpenPair={onOpenLoanPair}
          onOpenAll={onOpenLoans}
        />
        {faqList.length || isFaqLoading ? (
          <YStack px="$pagePadding" gap="$2">
            <SizableText size="$headingLg">
              {intl.formatMessage({ id: ETranslations.global_faqs })}
            </SizableText>
            <FAQContent faqList={faqList} isLoading={isFaqLoading} />
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

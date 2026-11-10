import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AvailableAssetsFlatList } from '../AvailableAssetsFlatList';
import { EarnHomeShortcuts } from '../EarnHomeShortcuts';
import { EARN_SECTION_GAP } from '../earnListRhythm';
import { FAQContent } from '../FAQContent';

import {
  EarnDesktopHoldCard,
  EarnDesktopHoldCardSkeleton,
} from './EarnDesktopHoldCard';
import { EasedSection } from './EarnEasedSection';
import { EarnPhoneLoansPreview } from './EarnPhoneLoansPreview';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopLoanPair,
  IEarnDesktopMarketReserves,
} from './earnDesktopHome.utils';

/**
 * The DeFi home on a phone-wide screen: the same totals, rows and windows as
 * the wide layout, with its lists one tap away instead of in tabs. From the
 * top: the totals (or the guide), the Earn, Loans and Protocols entries,
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
  markets,
  isMarketsLoaded,
  faqList,
  isFaqLoading,
  onOpenTokens,
  onOpenLoans,
  onOpenEarnRouter,
  onOpenLoansRouter,
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
  markets: IEarnDesktopMarketReserves[];
  isMarketsLoaded: boolean;
  faqList: Array<{ question: string; answer: string }>;
  isFaqLoading: boolean;
  onOpenTokens: () => void;
  onOpenLoans: () => void;
  // The tiles open the two routers: the deposit window and the Loans window
  onOpenEarnRouter: () => void;
  onOpenLoansRouter: () => void;
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
        onOpenEarn={onOpenEarnRouter}
        onOpenLoans={onOpenLoansRouter}
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
        <AvailableAssetsFlatList namesLiquidity />
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

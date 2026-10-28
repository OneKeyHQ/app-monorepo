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
import { EarnPhoneLoansPreview } from './EarnPhoneLoansPreview';

import type {
  IEarnDesktopHoldRow,
  IEarnDesktopLoanPair,
  IEarnDesktopMarketReserves,
} from './earnDesktopHome.utils';

/**
 * The DeFi home on a phone-wide screen: the same totals, rows and windows as
 * the wide layout, with its lists one tap away instead of in tabs. From the
 * top: the totals (or the guide), the Tokens, Loans and Protocols entries,
 * the banner, the wallet's tokens, Trending tokens and Fixed Income as the
 * phone app shows them, the first Loans pairs, then the questions
 */
export function EarnPhoneHome({
  header,
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
  /** The banner block, sized to show its art whole */
  banner: ReactNode;
  /** Off for a wallet with nothing Earn takes, and with no wallet */
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
        {header}
      </YStack>
      <EarnHomeShortcuts
        onOpenLoans={onOpenLoans}
        onOpenTokens={onOpenTokens}
        onOpenProtocols={onOpenProtocols}
      />
      {banner}
      {/* The sections keep the phone home's rhythm, Trending tokens and
          Fixed Income included */}
      <YStack gap={EARN_SECTION_GAP}>
        {holdings}
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

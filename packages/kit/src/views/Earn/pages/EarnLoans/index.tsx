import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  ScrollView,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  EarnDesktopBorrowTab,
  useEarnDesktopOpenLoanPair,
} from '../../components/desktopHome/EarnDesktopBorrowTab';
import { useEarnDesktopOpenBorrowMarket } from '../../components/desktopHome/EarnDesktopYourLoans';
import {
  useEarnDesktopAccountMarkets,
  useEarnDesktopMarkets,
  useEarnDesktopWalletHoldings,
} from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnProviderMirror } from '../../EarnProviderMirror';

/**
 * Loans on a phone-wide screen: the Loans list the wide home has as a tab,
 * its filters and sort included, which the phone home shows the first pairs
 * of. A row opens the Loans router on its pair
 */
function EarnLoansContent() {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const isActive = useRouteIsFocused();
  const { marketList, isListReady, markets, isLoaded } = useEarnDesktopMarkets({
    isActive,
  });
  // The account's loans, over the list
  const accountMarkets = useEarnDesktopAccountMarkets({
    markets: marketList,
    isListReady,
    isActive,
  });
  const handleOpenMarket = useEarnDesktopOpenBorrowMarket();
  const yourLoans = useMemo(
    () => ({
      loans: accountMarkets.loans,
      isLoaded: accountMarkets.isLoaded,
      accountScope: accountMarkets.accountScope,
      onOpenMarket: handleOpenMarket,
    }),
    [
      accountMarkets.accountScope,
      accountMarkets.isLoaded,
      accountMarkets.loans,
      handleOpenMarket,
    ],
  );
  // The wallet's balances where the markets are, for the collateral it holds
  const marketNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(marketList.map((market) => market.networkId)),
      ).toSorted(),
    [marketList],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive,
    refreshNetworkIds: marketNetworkIds,
  });
  const handleOpenPair = useEarnDesktopOpenLoanPair();

  // A page of its own, as My portfolio: the back button and the title in
  // the page header on every width
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_loans__action })}
      />
      <Page.Body>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
        >
          <YStack px="$pagePadding" pt="$2" pb="$10">
            <EarnDesktopBorrowTab
              markets={markets}
              isLoaded={isLoaded}
              isActive={isActive}
              walletNetworkGroups={wallet.networkGroups}
              onOpenPair={handleOpenPair}
              yourLoans={yourLoans}
            />
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default function EarnLoans() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <EarnLoansContent />
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

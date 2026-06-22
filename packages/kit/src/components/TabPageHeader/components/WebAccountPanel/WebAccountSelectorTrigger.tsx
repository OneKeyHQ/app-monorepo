import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText, Spinner, XStack } from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PerpsAccountNumberValue } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/components/PerpsAccountNumberValue';
import { useShowDepositWithdrawModal } from '@onekeyhq/kit/src/views/Perp/hooks/useShowDepositWithdrawModal';
import { useShowPortfolio } from '@onekeyhq/kit/src/views/Perp/hooks/useShowPortfolio';
import {
  usePerpsActiveAccountAtom,
  usePerpsComputedAccountValueAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useWebDappRealAddress } from './useWebDappRealAddress';
import { WebAccountPanelPopover } from './WebAccountPanelPopover';

import type { GestureResponderEvent } from 'react-native';

export interface IWebAccountSelectorTriggerProps {
  tabRoute: ETabRoutes;
}

// The Popover's own Trigger wrapper drives the open-on-press behavior; this
// noop only exists so the trigger XStack keeps a Pressable press state for
// pressStyle to animate against.
const noop = () => undefined;

function PerpsBalancePill({ userAddress }: { userAddress?: string }) {
  const intl = useIntl();
  const [perpsActiveAccount] = usePerpsActiveAccountAtom();
  const [computedValue] = usePerpsComputedAccountValueAtom();
  const { showPortfolio } = useShowPortfolio();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  // The computed value is scoped to perpsActiveAccountAtom, which may describe a
  // different account than the one shown in this trigger (e.g. used Perps with
  // account A, then switched the header to account B). Only trust it when its
  // address matches the displayed account; otherwise treat the value/loading as
  // unknown so the pill hides instead of showing A's balance for B.
  const isForThisAccount =
    !!userAddress &&
    perpsActiveAccount?.accountAddress?.toLowerCase() ===
      userAddress.toLowerCase();
  const accountValue = isForThisAccount
    ? computedValue?.accountValue
    : undefined;
  const isLoading = isForThisAccount ? computedValue?.isLoading : false;

  // Gate on whether the balance is KNOWN, not on isLoading: an empty account
  // keeps isLoading=true (spotTotalUsd never resolves to a positive value), yet
  // accountValue is a concrete '0' → that path shows the Deposit pill below.
  // When the value is genuinely unknown (undefined): show a spinner while it's
  // still loading, otherwise render nothing (no premature "Deposit").
  if (accountValue === undefined) {
    if (isLoading) {
      return (
        <XStack ai="center" jc="center" px="$2" h={26}>
          <Spinner size="small" />
        </XStack>
      );
    }
    return null;
  }

  const isEmptyAccount = new BigNumber(accountValue).lte(0);

  const handlePress = (e: GestureResponderEvent) => {
    e.stopPropagation();
    // Empty account → open the deposit dialog (same as the panel's Deposit
    // button); funded account → open the Portfolio & PnL dialog.
    if (isEmptyAccount) {
      void showDepositWithdrawModal('deposit');
    } else {
      showPortfolio();
    }
  };

  return (
    <XStack
      ai="center"
      jc="center"
      gap="$1"
      px="$2"
      h={26}
      borderRadius="$full"
      bg={isEmptyAccount ? '$brand9' : '$neutral4'}
      onPress={handlePress}
      cursor="pointer"
      hoverStyle={{ opacity: 0.85 }}
      pressStyle={{ opacity: 0.7 }}
      testID="web-account-selector-perps-pill"
    >
      {isEmptyAccount ? (
        <SizableText size="$bodyLgMedium" color="$textOnColor">
          {intl.formatMessage({ id: ETranslations.perp_trade_deposit })}
        </SizableText>
      ) : (
        <PerpsAccountNumberValue
          value={accountValue}
          textSize="$bodyLgMedium"
        />
      )}
    </XStack>
  );
}

export function WebAccountSelectorTrigger({
  tabRoute,
}: IWebAccountSelectorTriggerProps) {
  const {
    activeAccount: { account, dbAccount, indexedAccount },
  } = useActiveAccount({ num: 0 });

  // In web-dapp all-networks mode an indexed account's address is a mock
  // placeholder; resolve the real EVM address for the header.
  const realAddress = useWebDappRealAddress({
    address: account?.address,
    indexedAccountId: indexedAccount?.id,
  });
  const address = realAddress
    ? accountUtils.shortenAddress({
        address: realAddress,
        leadingLength: 4,
        trailingLength: 4,
      })
    : '';

  const isPerpsRoute =
    tabRoute === ETabRoutes.Perp || tabRoute === ETabRoutes.WebviewPerpTrade;

  const trigger = (
    <XStack
      h="$8"
      ai="center"
      pl="$2"
      pr="$1"
      bg="$bgStrong"
      borderRadius="$full"
      hoverStyle={{ bg: '$bgStrongHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={noop}
      role="button"
      testID="web-account-selector-trigger"
    >
      <AccountAvatar
        size={20}
        borderRadius="$full"
        outlineWidth={1}
        outlineStyle="solid"
        outlineColor="$borderSubdued"
        outlineOffset={-1}
        account={account}
        dbAccount={dbAccount}
        indexedAccount={indexedAccount}
      />
      <XStack ai="center" pl="$2" pr="$3">
        <SizableText size="$bodyLg" color="$text">
          {address}
        </SizableText>
      </XStack>
      {isPerpsRoute ? <PerpsBalancePill userAddress={realAddress} /> : null}
    </XStack>
  );

  return <WebAccountPanelPopover renderTrigger={trigger} connected />;
}

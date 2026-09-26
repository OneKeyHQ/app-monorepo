import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { openSwapDepositEntry } from '../utils/swapDepositEntryUtils';

import { getTokenIdentityKey } from './swapStockChannelUtils';
import { resolveSwapNetworkAccount } from './useSwapAccount';

// Returns a stable press handler for the swap deposit entry. The inputs are
// read through a ref at press time, so callers may pass objects rebuilt on
// every balance refresh and inline callbacks without re-rendering the
// memoized action footer. `onClose` runs when the receive modal goes away and
// should reload the balance the user may just have topped up; each surface
// owns that reload (Swap From atom, Stocks balance hook, Pro pay-token sync).
//
// `accountInfo` is the account already resolved for the token's network.
// While that cross-network lookup is still pending the verdict keeps showing
// "Deposit to Trade" (so the button does not flicker), and a tap in that
// window resolves the account from `activeAccount` on demand instead of being
// dropped. One lookup at a time; a result for a token or account that is no
// longer selected is discarded.
function buildSwapDepositSelectionKey({
  token,
  activeAccount,
}: {
  token?: ISwapToken;
  activeAccount?: IAccountSelectorActiveAccountInfo;
}) {
  return [
    getTokenIdentityKey(token),
    activeAccount?.wallet?.id,
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount?.dbAccount?.id,
  ].join('|');
}

export function useSwapDepositEntryPress({
  token,
  accountInfo,
  activeAccount,
  onClose,
  logLowBalance = true,
}: {
  token?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
  activeAccount?: IAccountSelectorActiveAccountInfo;
  onClose: () => void;
  // Passed through to openSwapDepositEntry; always-visible deposit entries
  // (the Pro panel's Top up chip) set false so they do not count the
  // low-balance funnel event.
  logLowBalance?: boolean;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const latest = useRef({
    token,
    accountInfo,
    activeAccount,
    onClose,
    logLowBalance,
  });
  latest.current = {
    token,
    accountInfo,
    activeAccount,
    onClose,
    logLowBalance,
  };
  // Selection key of the in-flight on-demand lookup. One lookup per selection:
  // repeated taps for the same selection dedupe, while a press for a new
  // selection starts its own lookup and the older result is dropped below.
  const resolvingKeyRef = useRef('');
  // A pending lookup must not open anything after this entry unmounted (the
  // user left the page while the account was resolving).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return useCallback(() => {
    void (async () => {
      const pressed = latest.current;
      const pressedKey = buildSwapDepositSelectionKey(pressed);
      if (resolvingKeyRef.current === pressedKey) return;
      let depositAccountInfo = pressed.accountInfo;
      if (
        !depositAccountInfo &&
        pressed.token?.networkId &&
        pressed.activeAccount
      ) {
        resolvingKeyRef.current = pressedKey;
        try {
          const { account } = await resolveSwapNetworkAccount({
            accountId: pressed.activeAccount.account?.id,
            indexedAccountId: pressed.activeAccount.indexedAccount?.id,
            dbAccount: pressed.activeAccount.dbAccount,
            networkId: pressed.token.networkId,
          });
          depositAccountInfo = account
            ? { ...pressed.activeAccount, account }
            : undefined;
        } catch {
          depositAccountInfo = undefined;
        } finally {
          if (resolvingKeyRef.current === pressedKey) {
            resolvingKeyRef.current = '';
          }
        }
        if (!mountedRef.current) return;
        if (buildSwapDepositSelectionKey(latest.current) !== pressedKey) {
          return;
        }
      }
      if (!mountedRef.current) return;
      const opened = openSwapDepositEntry({
        navigation,
        token: pressed.token,
        accountInfo: depositAccountInfo,
        onClose: latest.current.onClose,
        logLowBalance: latest.current.logLowBalance,
      });
      // A pressable entry only ends up here without an account when the
      // on-demand lookup above failed (or the token is gone); say so instead of
      // leaving a dead tap.
      if (!opened) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.swap_page_toast_address_generated_fail,
          }),
        });
      }
    })();
  }, [intl, navigation]);
}

import { useCallback, useRef } from 'react';

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
}: {
  token?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
  activeAccount?: IAccountSelectorActiveAccountInfo;
  onClose: () => void;
}) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const latest = useRef({ token, accountInfo, activeAccount, onClose });
  latest.current = { token, accountInfo, activeAccount, onClose };
  const resolvingRef = useRef(false);
  return useCallback(() => {
    void (async () => {
      if (resolvingRef.current) return;
      const pressed = latest.current;
      let depositAccountInfo = pressed.accountInfo;
      if (
        !depositAccountInfo &&
        pressed.token?.networkId &&
        pressed.activeAccount
      ) {
        resolvingRef.current = true;
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
          resolvingRef.current = false;
        }
        if (
          buildSwapDepositSelectionKey(latest.current) !==
          buildSwapDepositSelectionKey(pressed)
        ) {
          return;
        }
      }
      const opened = openSwapDepositEntry({
        navigation,
        token: pressed.token,
        accountInfo: depositAccountInfo,
        onClose: latest.current.onClose,
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

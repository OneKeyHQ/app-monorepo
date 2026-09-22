import { useCallback, useRef } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSwapActions } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { openSwapDepositEntry } from '../utils/swapDepositEntryUtils';

import { useSwapAddressInfo } from './useSwapAccount';

// Returns a stable press handler for the swap deposit entry. The token and
// account objects are rebuilt on every balance refresh and account event, so
// they are read through refs at press time instead of being callback deps;
// this keeps the action footer memo tree from re-rendering on each refresh.
// When the receive modal closes the from-token balance is reloaded from the
// network: the user may have deposited meanwhile and the cached balance would
// otherwise keep the button on "Deposit to Trade" / "Insufficient balance".
export function useSwapDepositEntryPress({
  token,
  accountInfo,
}: {
  token?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
}) {
  const navigation = useAppNavigation();
  const { loadSwapSelectTokenDetail } = useSwapActions().current;
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const accountInfoRef = useRef(accountInfo);
  accountInfoRef.current = accountInfo;
  const swapFromAddressInfoRef = useRef(swapFromAddressInfo);
  swapFromAddressInfoRef.current = swapFromAddressInfo;
  const refreshFromTokenBalance = useCallback(() => {
    void loadSwapSelectTokenDetail(
      ESwapDirectionType.FROM,
      swapFromAddressInfoRef.current,
      true,
    );
  }, [loadSwapSelectTokenDetail]);
  return useCallback(
    () =>
      openSwapDepositEntry({
        navigation,
        token: tokenRef.current,
        accountInfo: accountInfoRef.current,
        onClose: refreshFromTokenBalance,
      }),
    [navigation, refreshFromTokenBalance],
  );
}

import { useCallback, useRef } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { openSwapDepositEntry } from '../utils/swapDepositEntryUtils';

// Returns a stable press handler for the swap deposit entry. The token and
// account objects are rebuilt on every balance refresh and account event, so
// they are read through refs at press time instead of being callback deps;
// this keeps the action footer memo tree from re-rendering on each refresh.
export function useSwapDepositEntryPress({
  token,
  accountInfo,
}: {
  token?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
}) {
  const navigation = useAppNavigation();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const accountInfoRef = useRef(accountInfo);
  accountInfoRef.current = accountInfo;
  return useCallback(
    () =>
      openSwapDepositEntry({
        navigation,
        token: tokenRef.current,
        accountInfo: accountInfoRef.current,
      }),
    [navigation],
  );
}

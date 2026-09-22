import { useCallback, useRef } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { openSwapDepositEntry } from '../utils/swapDepositEntryUtils';

// Returns a stable press handler for the swap deposit entry. The inputs are
// read through a ref at press time, so callers may pass objects rebuilt on
// every balance refresh and inline callbacks without re-rendering the
// memoized action footer. `onClose` runs when the receive modal goes away and
// should reload the balance the user may just have topped up; each surface
// owns that reload (Swap From atom, Stocks balance hook, Pro pay-token sync).
export function useSwapDepositEntryPress({
  token,
  accountInfo,
  onClose,
}: {
  token?: ISwapToken;
  accountInfo?: IAccountSelectorActiveAccountInfo;
  onClose: () => void;
}) {
  const navigation = useAppNavigation();
  const latest = useRef({ token, accountInfo, onClose });
  latest.current = { token, accountInfo, onClose };
  return useCallback(
    () => openSwapDepositEntry({ navigation, ...latest.current }),
    [navigation],
  );
}

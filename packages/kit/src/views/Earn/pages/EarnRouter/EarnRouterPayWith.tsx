import { useMemo, useSyncExternalStore } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';

import { useEarnDesktopWalletHoldings } from '../../components/desktopHome/useEarnDesktopHomeData';

import {
  listPayTokens,
  mergePickedPayTokens,
  pickDefaultPayToken,
  withPickedTokenDetails,
} from './earnRouter.utils';

import type { IEarnRouterPayToken } from './earnRouter.utils';

// Tokens picked in Pay with's picker that the wallet's list lacks (none
// held, or one Pay with's own list leaves out), by network: a form drawn
// again (another protocol, the details page's tabs) still finds the pick
const pickedPayTokens = new Map<string, IEarnRouterPayToken[]>();
const pickedPayTokenListeners = new Set<() => void>();
const NO_PICKED_PAY_TOKENS: IEarnRouterPayToken[] = [];

export function rememberPickedPayToken(
  networkId: string,
  item: IEarnRouterPayToken,
) {
  const others = (pickedPayTokens.get(networkId) ?? []).filter(
    (picked) => picked.key !== item.key,
  );
  pickedPayTokens.set(networkId, [...others, item]);
  pickedPayTokenListeners.forEach((listener) => listener());
}

// A pick carries what the picker had: a popular token chip has no price, and
// the list may be in another currency. Its balance and price in USD are read
// once picked, and the pick takes them when it is still there
export async function refreshPickedPayToken({
  accountId,
  networkId,
  item,
}: {
  accountId: string;
  networkId: string;
  item: IEarnRouterPayToken;
}) {
  try {
    const accountAddress = accountId
      ? await backgroundApiProxy.serviceAccount
          .getAccountAddressForApi({ accountId, networkId })
          .catch(() => undefined)
      : undefined;
    const details = await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
      networkId,
      accountAddress,
      accountId: accountAddress ? accountId : undefined,
      contractAddress: item.token.address,
      currency: USD_CURRENCY_ID,
    });
    const detail = details?.[0];
    const latest = pickedPayTokens
      .get(networkId)
      ?.find((picked) => picked.key === item.key);
    if (detail && latest) {
      rememberPickedPayToken(networkId, withPickedTokenDetails(latest, detail));
    }
  } catch {
    // The pick keeps what the picker showed
  }
}

function subscribePickedPayTokens(listener: () => void) {
  pickedPayTokenListeners.add(listener);
  return () => {
    pickedPayTokenListeners.delete(listener);
  };
}

function usePickedPayTokens(networkId: string) {
  return useSyncExternalStore(
    subscribePickedPayTokens,
    () => pickedPayTokens.get(networkId) ?? NO_PICKED_PAY_TOKENS,
  );
}

// The wallet's tokens on the deposit's network, for Pay with, and the picks
// they lack
export function usePayTokens({
  networkId,
  depositSymbol,
  enabled = true,
}: {
  networkId: string;
  depositSymbol: string;
  enabled?: boolean;
}) {
  const refreshNetworkIds = useMemo(() => [networkId], [networkId]);
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const payableSymbols = useMemo(
    () =>
      new Set(
        Object.values(availableAssetsByType).flatMap((assets) =>
          (assets ?? []).map((asset) => asset.symbol.toLowerCase()),
        ),
      ),
    [availableAssetsByType],
  );
  const wallet = useEarnDesktopWalletHoldings({
    isActive: enabled,
    refreshNetworkIds,
  });
  const group = useMemo(
    () => wallet.networkGroups.find((item) => item.networkId === networkId),
    [networkId, wallet.networkGroups],
  );
  const heldTokens = useMemo(
    () =>
      listPayTokens({
        group,
        depositSymbol,
        // Before Earn's lists are in, nothing is filtered out
        payableSymbols: payableSymbols.size ? payableSymbols : undefined,
      }),
    [depositSymbol, group, payableSymbols],
  );
  const picked = usePickedPayTokens(networkId);
  const tokens = useMemo(
    () => mergePickedPayTokens(heldTokens, picked),
    [heldTokens, picked],
  );
  const defaultToken = useMemo(
    () => pickDefaultPayToken(heldTokens),
    [heldTokens],
  );
  return {
    // The wallet's, then the picks
    tokens,
    heldTokens,
    defaultToken,
    isLoaded: wallet.isLoaded,
    refresh: wallet.refresh,
  };
}

// Pay with's token chip, which opens the picker
export const PAY_WITH_TRIGGER_TEST_ID = 'earn-pay-with-trigger';

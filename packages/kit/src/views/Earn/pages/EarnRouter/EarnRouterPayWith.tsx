import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useEarnAtom } from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';

import { useEarnDesktopWalletHoldings } from '../../components/desktopHome/useEarnDesktopHomeData';

import {
  listEarnNetworkIds,
  listPayTokens,
  listPayTokensAcrossNetworks,
  mergePickedPayTokens,
  pickDefaultPayToken,
  pickDefaultPayTokenAcrossNetworks,
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

// Every network's picks, one list kept until a pick changes, for a Pay with
// that bridges
let everyNetworkPicks: IEarnRouterPayToken[] = NO_PICKED_PAY_TOKENS;
let everyNetworkPicksVersion = 0;
let everyNetworkPicksBuiltAt = -1;
// Added first, so the list is stale before any view reads it again
pickedPayTokenListeners.add(() => {
  everyNetworkPicksVersion += 1;
});
function readEveryNetworkPicks() {
  if (everyNetworkPicksBuiltAt !== everyNetworkPicksVersion) {
    everyNetworkPicksBuiltAt = everyNetworkPicksVersion;
    const all = [...pickedPayTokens.values()].flat();
    everyNetworkPicks = all.length ? all : NO_PICKED_PAY_TOKENS;
  }
  return everyNetworkPicks;
}

// One network's picks, or every network's (`networkId` unset)
function usePickedPayTokens(networkId?: string) {
  return useSyncExternalStore(subscribePickedPayTokens, () =>
    networkId
      ? (pickedPayTokens.get(networkId) ?? NO_PICKED_PAY_TOKENS)
      : readEveryNetworkPicks(),
  );
}

// The wallet's tokens on the deposit's network, for Pay with, and the picks
// they lack. Across networks, every network's (11-05: a token elsewhere is
// bridged to the deposit's network first)
export function usePayTokens({
  accountId,
  networkId,
  depositSymbol,
  enabled = true,
  acrossNetworks = false,
}: {
  accountId: string;
  networkId: string;
  depositSymbol: string;
  enabled?: boolean;
  acrossNetworks?: boolean;
}) {
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  // Fetched again after the cache: the deposit's network; across networks,
  // every one Earn offers on, as the home fetches them, and the ones a
  // bridge paid from, whose balances it moved
  const [paidFromNetworkIds, setPaidFromNetworkIds] = useState<string[]>([]);
  const refreshNetworkIds = useMemo(
    () =>
      acrossNetworks
        ? listEarnNetworkIds({
            assets: Object.values(availableAssetsByType).flatMap(
              (list) => list ?? [],
            ),
            alsoNetworkIds: [networkId, ...paidFromNetworkIds],
          })
        : [networkId],
    [acrossNetworks, availableAssetsByType, networkId, paidFromNetworkIds],
  );
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
  const heldTokens = useMemo(() => {
    // Before Earn's lists are in, nothing is filtered out
    const payable = payableSymbols.size ? payableSymbols : undefined;
    return acrossNetworks
      ? listPayTokensAcrossNetworks({
          groups: wallet.networkGroups,
          depositSymbol,
          depositNetworkId: networkId,
          payableSymbols: payable,
        })
      : listPayTokens({
          group,
          depositSymbol,
          depositNetworkId: networkId,
          payableSymbols: payable,
        });
  }, [
    acrossNetworks,
    depositSymbol,
    group,
    networkId,
    payableSymbols,
    wallet.networkGroups,
  ]);
  const picked = usePickedPayTokens(acrossNetworks ? undefined : networkId);
  const tokens = useMemo(
    () => mergePickedPayTokens(heldTokens, picked),
    [heldTokens, picked],
  );
  const defaultToken = useMemo(
    () =>
      acrossNetworks
        ? pickDefaultPayTokenAcrossNetworks(heldTokens, depositSymbol)
        : pickDefaultPayToken(heldTokens),
    [acrossNetworks, depositSymbol, heldTokens],
  );
  // The wallet holds nothing at all on the network, of any token; across
  // networks, nothing anywhere
  const emptyGroups = acrossNetworks
    ? wallet.networkGroups
    : [group].filter(Boolean);
  const isNetworkEmpty =
    wallet.isLoaded &&
    !emptyGroups.some((item) =>
      (item?.tokens ?? []).some((token) =>
        new BigNumber(item?.map[token.$key]?.balanceParsed ?? 0).gt(0),
      ),
    );
  // After a transaction: the wallet's balances, and the picks' own, which
  // the wallet's list doesn't carry
  const { refresh: refreshWallet } = wallet;
  const refresh = useCallback(
    async (alsoNetworkIds?: string[]) => {
      // A bridge's own network, fetched along with the deposit's from now on
      const extra = Array.isArray(alsoNetworkIds)
        ? alsoNetworkIds.filter((id) => id && id !== networkId)
        : [];
      if (acrossNetworks && extra.length) {
        setPaidFromNetworkIds((prev) => {
          const next = [...new Set([...prev, ...extra])];
          return next.length === prev.length ? prev : next;
        });
      }
      const picks = acrossNetworks
        ? [...pickedPayTokens.values()].flat()
        : (pickedPayTokens.get(networkId) ?? []);
      await Promise.all([
        refreshWallet(),
        ...picks.map((item) =>
          refreshPickedPayToken({
            accountId: item.accountId || accountId,
            networkId: item.networkId || networkId,
            item,
          }),
        ),
      ]);
    },
    [accountId, acrossNetworks, networkId, refreshWallet],
  );
  return {
    // The wallet's, then the picks
    tokens,
    heldTokens,
    defaultToken,
    isLoaded: wallet.isLoaded,
    isNetworkEmpty,
    refresh,
  };
}

// Pay with's token chip, which opens the picker
export const PAY_WITH_TRIGGER_TEST_ID = 'earn-pay-with-trigger';

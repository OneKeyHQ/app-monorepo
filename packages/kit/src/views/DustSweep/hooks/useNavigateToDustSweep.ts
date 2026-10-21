import type { PropsWithChildren } from 'react';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IDustSweepEntry,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';

export function isDustSweepNetworkSupported({
  networkId,
  isAllNetworks,
  supportedNetworkIds,
}: {
  networkId?: string;
  isAllNetworks?: boolean;
  supportedNetworkIds?: ReadonlySet<string>;
}) {
  // Aggregate mode keeps its existing entry while capabilities load. Single
  // networks must match the provider rules used by the destination.
  return Boolean(
    isAllNetworks || (networkId && supportedNetworkIds?.has(networkId)),
  );
}

type IDustSweepEntryCapabilities = {
  supportedNetworkIds?: ReadonlySet<string>;
  isRefreshing: boolean;
  // Home tab and route are both focused.
  isFocused: boolean;
};

const DustSweepEntryCapabilitiesContext =
  createContext<IDustSweepEntryCapabilities>({
    supportedNetworkIds: undefined,
    isRefreshing: false,
    isFocused: true,
  });

export function DustSweepEntryCapabilitiesProvider({
  children,
  isFocused,
}: PropsWithChildren<{ isFocused: boolean }>) {
  const { result, isLoading } = usePromiseResult(
    async () => {
      const { loadDustSweepEntryCapabilities } =
        await import('../utils/loadNetworks');
      return loadDustSweepEntryCapabilities();
    },
    [],
    {
      checkIsMounted: true,
      checkIsFocused: true,
      watchLoading: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
    },
  );
  const supportedNetworkIds = useMemo(
    () => result && new Set(result.map((network) => network.networkId)),
    [result],
  );
  const capabilities = useMemo(
    () => ({
      supportedNetworkIds,
      // Keep the existing entry mounted while capabilities revalidate, but
      // prevent navigation until the destination rules are current.
      isRefreshing: Boolean(result && isLoading),
      isFocused,
    }),
    [isFocused, isLoading, result, supportedNetworkIds],
  );
  return createElement(
    DustSweepEntryCapabilitiesContext.Provider,
    { value: capabilities },
    children,
  );
}

export function useNavigateToDustSweep() {
  const intl = useIntl();

  return useCallback(
    async (
      params: Omit<IDustSweepRouteParams, 'walletId'> & { walletId?: string },
    ) => {
      const { navigateToDustSweep } =
        await import('../utils/navigateToDustSweep');
      await navigateToDustSweep({ params, intl });
    },
    [intl],
  );
}

// Entry points that open Dust Sweep for the active Home account.
export function useActiveAccountDustSweep() {
  const navigateToDustSweep = useNavigateToDustSweep();
  const { supportedNetworkIds, isRefreshing, isFocused } = useContext(
    DustSweepEntryCapabilitiesContext,
  );
  const {
    activeAccount: { account, wallet, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const walletId = wallet?.id;
  // Mirrors the navigation handler's guards so entries never lead to the
  // "account does not support swap" dialog.
  const canDustSweep =
    !!(
      account?.id ?? (network?.isAllNetworks ? indexedAccount?.id : undefined)
    ) &&
    !!walletId &&
    !accountUtils.isWatchingWallet({ walletId }) &&
    !accountUtils.isExternalWallet({ walletId }) &&
    isDustSweepNetworkSupported({
      networkId: network?.id,
      isAllNetworks: network?.isAllNetworks,
      supportedNetworkIds,
    });
  const navigate = useCallback(
    (entry: IDustSweepEntry) =>
      navigateToDustSweep({
        accountId: account?.id,
        walletId,
        indexedAccountId: indexedAccount?.id,
        networkId: network?.isAllNetworks ? undefined : network?.id,
        entry,
      }),
    [
      navigateToDustSweep,
      account?.id,
      walletId,
      indexedAccount?.id,
      network?.id,
      network?.isAllNetworks,
    ],
  );
  // Capabilities revalidate whenever Home regains focus (e.g. back from Dust
  // Sweep). Keep the entry looking enabled meanwhile; a tap during the refresh
  // waits for it and opens only if Home is still focused on the same account
  // and network, and that account is still supported.
  const scopeKey = [
    walletId,
    account?.id,
    indexedAccount?.id,
    network?.id,
  ].join('|');
  const [pendingEntry, setPendingEntry] = useState<{
    entry: IDustSweepEntry;
    scopeKey: string;
  }>();
  const openDustSweep = useCallback(
    (entry: IDustSweepEntry) => {
      if (!canDustSweep) return undefined;
      if (isRefreshing) {
        setPendingEntry({ entry, scopeKey });
        return undefined;
      }
      return navigate(entry);
    },
    [canDustSweep, isRefreshing, navigate, scopeKey],
  );
  useEffect(() => {
    if (!pendingEntry) return;
    // Leaving Home or switching account/network drops the queued tap.
    if (!isFocused || pendingEntry.scopeKey !== scopeKey) {
      setPendingEntry(undefined);
      return;
    }
    if (isRefreshing) return;
    setPendingEntry(undefined);
    if (canDustSweep) void navigate(pendingEntry.entry);
  }, [canDustSweep, isFocused, isRefreshing, navigate, pendingEntry, scopeKey]);
  return {
    canDustSweep,
    openDustSweep,
  };
}

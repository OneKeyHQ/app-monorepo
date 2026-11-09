import type { PropsWithChildren } from 'react';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  isFocused: boolean;
};

const DustSweepEntryCapabilitiesContext =
  createContext<IDustSweepEntryCapabilities>({
    supportedNetworkIds: undefined,
    isFocused: true,
  });

export function DustSweepEntryCapabilitiesProvider({
  children,
  isFocused,
}: PropsWithChildren<{ isFocused: boolean }>) {
  const { result } = usePromiseResult(
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
      isFocused,
    }),
    [isFocused, supportedNetworkIds],
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
      isCurrent?: () => boolean,
    ) => {
      const { navigateToDustSweep } =
        await import('../utils/navigateToDustSweep');
      if (isCurrent && !isCurrent()) return;
      await navigateToDustSweep({ params, intl });
    },
    [intl],
  );
}

// Entry points that open Dust Sweep for the active Home account.
export function useActiveAccountDustSweep() {
  const navigateToDustSweep = useNavigateToDustSweep();
  const { supportedNetworkIds, isFocused } = useContext(
    DustSweepEntryCapabilitiesContext,
  );
  const {
    activeAccount: { account, wallet, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const walletId = wallet?.id;
  const scopeKey = JSON.stringify([
    walletId,
    account?.id,
    indexedAccount?.id,
    network?.id,
  ]);
  const scopeRef = useRef({ scopeKey, isFocused, generation: 0 });
  if (
    scopeRef.current.scopeKey !== scopeKey ||
    scopeRef.current.isFocused !== isFocused
  ) {
    scopeRef.current = {
      scopeKey,
      isFocused,
      generation: scopeRef.current.generation + 1,
    };
  }
  const mountedRef = useRef(true);
  const openingRef = useRef<{
    generation: number;
    promise: Promise<void>;
  } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
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
  const canDustSweepRef = useRef(canDustSweep);
  canDustSweepRef.current = canDustSweep;
  const navigate = useCallback(
    (entry: IDustSweepEntry, generation: number) =>
      navigateToDustSweep(
        {
          accountId: account?.id,
          walletId,
          indexedAccountId: indexedAccount?.id,
          networkId: network?.isAllNetworks ? undefined : network?.id,
          entry,
        },
        () =>
          mountedRef.current &&
          scopeRef.current.isFocused &&
          canDustSweepRef.current &&
          scopeRef.current.generation === generation &&
          scopeRef.current.scopeKey === scopeKey,
      ),
    [
      navigateToDustSweep,
      account?.id,
      walletId,
      indexedAccount?.id,
      network?.id,
      network?.isAllNetworks,
      scopeKey,
    ],
  );
  const openDustSweep = useCallback(
    (entry: IDustSweepEntry) => {
      if (!canDustSweep) return undefined;
      const { generation } = scopeRef.current;
      if (openingRef.current?.generation === generation)
        return openingRef.current.promise;
      const pending = navigate(entry, generation).finally(() => {
        if (openingRef.current?.promise === pending) openingRef.current = null;
      });
      openingRef.current = { generation, promise: pending };
      return pending;
    },
    [canDustSweep, navigate],
  );
  return {
    canDustSweep,
    openDustSweep,
  };
}

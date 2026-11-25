import type { MutableRefObject, PropsWithChildren } from 'react';
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
  // networks must support Swap in the destination.
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

// Networks Dust sweep can open on; undefined while the capabilities load.
export function useDustSweepSupportedNetworkIds() {
  return useContext(DustSweepEntryCapabilitiesContext).supportedNetworkIds;
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

export type IDustSweepScope = {
  scopeKey: string;
  isFocused: boolean;
  generation: number;
  mounted: boolean;
};

// The active Home account and focus a Dust Sweep tap belongs to. The
// generation moves on every change, so a pending tap never lands after the
// account or focus changed, even away and back.
export function useDustSweepScope(isFocused: boolean) {
  const {
    activeAccount: { account, wallet, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const scopeKey = JSON.stringify([
    wallet?.id,
    account?.id,
    indexedAccount?.id,
    network?.id,
  ]);
  // One object for the hook's life, so a pending tap reads it live.
  const scopeRef = useRef<IDustSweepScope>({
    scopeKey,
    isFocused,
    generation: 0,
    mounted: true,
  });
  const scope = scopeRef.current;
  if (scope.scopeKey !== scopeKey || scope.isFocused !== isFocused) {
    scope.scopeKey = scopeKey;
    scope.isFocused = isFocused;
    scope.generation += 1;
  }
  useEffect(() => {
    scope.mounted = true;
    return () => {
      scope.mounted = false;
    };
  }, [scope]);
  return scopeRef;
}

// Entry points that open Dust Sweep for the active Home account. A menu item
// unmounts as its menu closes, before a first open has loaded the page, so it
// passes its mounted host's scope, which keeps the account and focus guard
// live.
export function useActiveAccountDustSweep({
  hostScope,
}: { hostScope?: MutableRefObject<IDustSweepScope> } = {}) {
  const navigateToDustSweep = useNavigateToDustSweep();
  const { supportedNetworkIds, isFocused } = useContext(
    DustSweepEntryCapabilitiesContext,
  );
  const {
    activeAccount: { account, wallet, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const walletId = wallet?.id;
  const ownScope = useDustSweepScope(isFocused);
  const scope = hostScope ?? ownScope;
  const { scopeKey } = ownScope.current;
  const openingRef = useRef<{
    generation: number;
    promise: Promise<void>;
  } | null>(null);
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
          scope.current.mounted &&
          scope.current.isFocused &&
          canDustSweepRef.current &&
          scope.current.generation === generation &&
          scope.current.scopeKey === scopeKey,
      ),
    [
      navigateToDustSweep,
      account?.id,
      walletId,
      indexedAccount?.id,
      network?.id,
      network?.isAllNetworks,
      scopeKey,
      scope,
    ],
  );
  const openDustSweep = useCallback(
    (entry: IDustSweepEntry) => {
      if (!canDustSweep) return undefined;
      const { generation } = scope.current;
      if (openingRef.current?.generation === generation)
        return openingRef.current.promise;
      const pending = navigate(entry, generation).finally(() => {
        if (openingRef.current?.promise === pending) openingRef.current = null;
      });
      openingRef.current = { generation, promise: pending };
      return pending;
    },
    [canDustSweep, navigate, scope],
  );
  return {
    canDustSweep,
    openDustSweep,
  };
}

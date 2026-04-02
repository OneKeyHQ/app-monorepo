import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { createStore } from 'mipd';

import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import type { EIP6963ProviderDetail } from 'mipd';

const ONE_KEY_RDNS_PATTERNS = ['so.onekey.app.wallet'];

// ---------------------------------------------------------------------------
// Module-level singleton MIPD store + useSyncExternalStore glue
// ---------------------------------------------------------------------------
const sharedMipdStore =
  typeof globalThis !== 'undefined' ? createStore() : undefined;

let cachedProviders: readonly EIP6963ProviderDetail[] =
  sharedMipdStore?.getProviders() ?? [];

const listeners = new Set<() => void>();

sharedMipdStore?.subscribe((updated) => {
  cachedProviders = updated;
  listeners.forEach((l) => l());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedProviders;
}

function findOneKeyProvider(providers: readonly EIP6963ProviderDetail[]) {
  return providers.find((provider) => {
    if (!provider?.info) return false;
    const rdns = provider.info.rdns?.toLowerCase() ?? '';
    const name = provider.info.name?.toLowerCase() ?? '';
    return (
      ONE_KEY_RDNS_PATTERNS.some((p) => rdns.includes(p)) ||
      name.includes('onekey')
    );
  });
}

// ---------------------------------------------------------------------------
// useEIP6963Providers — returns the latest provider list, auto-updates
// ---------------------------------------------------------------------------
function useEIP6963Providers() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// useOneKeyWalletDetection
// ---------------------------------------------------------------------------
export function useOneKeyWalletDetection() {
  const isOneKeyExtWalletInstalled = !!globalThis.$onekey?.$private?.isOneKey;
  const providers = useEIP6963Providers();

  const oneKeyEIP6963Provider = useMemo(
    () => findOneKeyProvider(providers),
    [providers],
  );

  const getOneKeyConnectionInfo =
    useCallback((): IExternalConnectionInfo | null => {
      // Prefer the cached provider from subscribe; fall back to a fresh read.
      const provider =
        oneKeyEIP6963Provider ??
        findOneKeyProvider(sharedMipdStore?.getProviders() ?? []);

      if (provider) {
        return {
          evmEIP6963: {
            info: provider.info,
          },
        };
      }

      if (isOneKeyExtWalletInstalled) {
        return {
          evmInjected: {
            global: 'ethereum',
            name: 'OneKey Wallet',
          },
        };
      }

      return null;
    }, [oneKeyEIP6963Provider, isOneKeyExtWalletInstalled]);

  const isOneKeyInstalled = useMemo(() => {
    return !!oneKeyEIP6963Provider || isOneKeyExtWalletInstalled;
  }, [oneKeyEIP6963Provider, isOneKeyExtWalletInstalled]);

  const oneKeyProviderInfo = useMemo(() => {
    if (oneKeyEIP6963Provider) {
      return {
        name: oneKeyEIP6963Provider.info.name,
        icon: oneKeyEIP6963Provider.info.icon,
        rdns: oneKeyEIP6963Provider.info.rdns,
        uuid: oneKeyEIP6963Provider.info.uuid,
      };
    }

    if (isOneKeyExtWalletInstalled) {
      return {
        name: 'OneKey Wallet',
        icon: '',
        rdns: 'injected',
        uuid: 'onekey-injected',
      };
    }

    return null;
  }, [oneKeyEIP6963Provider, isOneKeyExtWalletInstalled]);

  return {
    isOneKeyInstalled,
    oneKeyProviderInfo,
    getOneKeyConnectionInfo,
  };
}

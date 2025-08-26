import { useCallback, useMemo } from 'react';

import { createStore } from 'mipd';

import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

export function useOneKeyWalletDetection() {
  // check injected wallet
  const isOneKeyExtWalletInstalled = !!globalThis.$onekey?.$private?.isOneKey;

  // get EIP6963 providers
  const getEIP6963Providers = useCallback(() => {
    if (typeof globalThis === 'undefined') return [];

    const mipd = createStore();
    return mipd.getProviders();
  }, []);

  // find OneKey EIP6963 provider
  const oneKeyEIP6963Provider = useMemo(() => {
    const providers = getEIP6963Providers();

    // OneKey RDNS
    const oneKeyRdnsPatterns = ['so.onekey.app.wallet'];

    // find OneKey provider
    const oneKeyProvider = providers.find((provider) => {
      const rdns = provider.info.rdns.toLowerCase();
      const name = provider.info.name.toLowerCase();

      const rdnsMatch = oneKeyRdnsPatterns.some((pattern) =>
        rdns.includes(pattern.toLowerCase()),
      );

      const nameMatch = name.includes('onekey');

      return rdnsMatch || nameMatch;
    });

    return oneKeyProvider;
  }, [getEIP6963Providers]);

  // get OneKey connection info - use EIP6963 first, fallback to injected
  const getOneKeyConnectionInfo =
    useCallback((): IExternalConnectionInfo | null => {
      // use EIP6963 first
      if (oneKeyEIP6963Provider) {
        return {
          evmEIP6963: {
            info: oneKeyEIP6963Provider.info,
          },
        };
      }

      // fallback to injected wallet
      if (isOneKeyExtWalletInstalled) {
        return {
          evmInjected: {
            global: 'ethereum',
            name: 'OneKey Wallet',
            icon: '',
          },
        };
      }

      return null;
    }, [oneKeyEIP6963Provider, isOneKeyExtWalletInstalled]);

  // check if OneKey extension is installed
  const isOneKeyInstalled = useMemo(() => {
    return !!oneKeyEIP6963Provider || isOneKeyExtWalletInstalled;
  }, [oneKeyEIP6963Provider, isOneKeyExtWalletInstalled]);

  // get OneKey provider info for display
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

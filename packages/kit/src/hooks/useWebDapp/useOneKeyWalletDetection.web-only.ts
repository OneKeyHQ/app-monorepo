import { useCallback, useMemo, useSyncExternalStore } from 'react';

import {
  getEIP6963Providers,
  subscribeEIP6963Providers,
} from '@onekeyhq/shared/src/utils/eip6963ProviderUtils';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import type { EIP6963ProviderDetail } from 'mipd';

const ONE_KEY_RDNS_PATTERNS = ['so.onekey.app.wallet'];

function findOneKeyProvider(providers: readonly EIP6963ProviderDetail[]) {
  return providers.find((provider) => {
    if (!provider?.info) return false;
    const rdns = provider.info.rdns?.toLowerCase() ?? '';
    const name = provider.info.name?.toLowerCase() ?? '';
    return (
      ONE_KEY_RDNS_PATTERNS.some((pattern) => rdns.includes(pattern)) ||
      name.includes('onekey')
    );
  });
}

function useEIP6963Providers() {
  return useSyncExternalStore(subscribeEIP6963Providers, getEIP6963Providers);
}

export function useOneKeyWalletDetection() {
  const isOneKeyExtWalletInstalled = !!globalThis.$onekey?.$private?.isOneKey;
  const providers = useEIP6963Providers();

  const oneKeyEIP6963Provider = useMemo(
    () => findOneKeyProvider(providers),
    [providers],
  );

  const getOneKeyConnectionInfo =
    useCallback((): IExternalConnectionInfo | null => {
      const provider =
        oneKeyEIP6963Provider ?? findOneKeyProvider(getEIP6963Providers());

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

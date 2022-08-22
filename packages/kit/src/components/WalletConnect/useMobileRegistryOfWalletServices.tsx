import React, { useEffect, useMemo } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { usePromiseResult } from '../../hooks/usePromiseResult';

import { WalletService } from './types';

// https://registry.walletconnect.org/data/wallets.json
function buildEnabledWallets({
  isVerticalLayout,
}: {
  isVerticalLayout: boolean;
}) {
  let enabledWallets = [
    'MetaMask',
    'Trust Wallet',
    'Rainbow',
    'imToken',
    'TokenPocket',
    'BitKeep',
  ];
  const enabledWalletsInVerticalOnly = [
    //
    'Zerion',
  ];
  if (isVerticalLayout) {
    enabledWallets = enabledWallets.concat(enabledWalletsInVerticalOnly);
  }
  return enabledWallets;
}

const defaultState: {
  data: WalletService[];
  error?: Error;
  loading: boolean;
} = Object.freeze({
  data: [],
  error: undefined,
  loading: true,
});
// import { useMobileRegistry } from '@walletconnect/react-native-dapp';
export default function useMobileRegistry() {
  const [state, setState] = React.useState(defaultState);
  React.useEffect(() => {
    (async () => {
      try {
        const result = await fetch(
          'https://registry.walletconnect.org/data/wallets.json',
        );
        const data = await result.json();
        setState({
          data: Object.values(data),
          error: undefined,
          loading: false,
        });
      } catch (err) {
        const error = err as Error;
        debugLogger.common.error(error);
        setState({ ...defaultState, error, loading: false });
      }
    })();
  }, [setState]);
  return state;
}

export function useMobileRegistryOfWalletServices() {
  // https://registry.walletconnect.org/data/wallets.json
  const { error, data: walletServicesRemote } = useMobileRegistry();
  const { result: walletServicesLocal } = usePromiseResult(() =>
    simpleDb.walletConnect.getWalletServicesList(),
  );
  const isVerticalLayout = useIsVerticalLayout();
  useEffect(() => {
    if (walletServicesRemote && walletServicesRemote.length) {
      simpleDb.walletConnect.saveWalletServicesList(walletServicesRemote);
    }
  }, [walletServicesRemote]);

  const walletServices = useMemo(
    () =>
      walletServicesLocal && walletServicesLocal.length
        ? walletServicesLocal
        : walletServicesRemote,
    [walletServicesLocal, walletServicesRemote],
  );

  const enabledWallets = useMemo(
    () => buildEnabledWallets({ isVerticalLayout }),
    [isVerticalLayout],
  );

  const walletServicesEnabled = useMemo(
    () =>
      enabledWallets
        .map((name) => walletServices.find((item) => item.name === name))
        .filter(Boolean),
    [enabledWallets, walletServices],
  );

  return { data: walletServicesEnabled, allData: walletServices, error };
}

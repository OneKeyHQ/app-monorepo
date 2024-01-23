import { useEffect, useMemo, useState } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

import {
  WALLET_CONNECT_INSTITUTION_WALLET_NAMES,
  WALLET_CONNECT_WALLET_NAMES,
  WalletServiceWithoutVerify,
} from './walletConnectConsts';

import type { WalletService } from './types';

// https://registry.walletconnect.org/data/wallets.json
function buildEnabledWallets({
  isVerticalLayout,
}: {
  isVerticalLayout: boolean;
}) {
  let enabledWallets = [
    WALLET_CONNECT_WALLET_NAMES.MetaMask,
    WALLET_CONNECT_WALLET_NAMES['OKX Wallet'],
    WALLET_CONNECT_WALLET_NAMES['Trust Wallet'],
    WALLET_CONNECT_WALLET_NAMES.Rainbow,
    WALLET_CONNECT_WALLET_NAMES.imToken,
    WALLET_CONNECT_WALLET_NAMES.TokenPocket,
    WALLET_CONNECT_WALLET_NAMES.BitKeep,
    WALLET_CONNECT_WALLET_NAMES.Zerion,
  ];
  const enabledWalletsInVerticalOnly = [
    ...Object.values(WALLET_CONNECT_INSTITUTION_WALLET_NAMES),
    WALLET_CONNECT_WALLET_NAMES['1inch'],
  ];
  if (isVerticalLayout) {
    enabledWallets = enabledWallets.concat(enabledWalletsInVerticalOnly);
  }
  return enabledWallets;
}

function buildInstitutionalEnabledWallets() {
  return Object.keys(WALLET_CONNECT_INSTITUTION_WALLET_NAMES);
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
  const [state, setState] = useState(defaultState);
  useEffect(() => {
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
  const { serviceWalletConnect } = backgroundApiProxy;
  // https://registry.walletconnect.org/data/wallets.json
  const { error, data: walletServicesRemote } = useMobileRegistry();
  const { result: walletServicesLocal } = usePromiseResult(
    () => serviceWalletConnect.getWalletServicesList(),
    [serviceWalletConnect],
  );
  const isVerticalLayout = useIsVerticalLayout();
  useEffect(() => {
    if (walletServicesRemote && walletServicesRemote.length) {
      serviceWalletConnect.saveWalletServicesList(walletServicesRemote);
    }
  }, [serviceWalletConnect, walletServicesRemote]);

  const walletServices = useMemo(() => {
    const walletServiceData =
      walletServicesLocal && walletServicesLocal.length
        ? walletServicesLocal
        : walletServicesRemote;
    return walletServiceData.concat(
      WalletServiceWithoutVerify as unknown as WalletService[],
    );
  }, [walletServicesLocal, walletServicesRemote]);

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

  const institutionWallets = useMemo(
    () => buildInstitutionalEnabledWallets(),
    [],
  );
  const institutionWalletServicesEnabled = useMemo(
    () =>
      institutionWallets
        .map((name) => walletServices.find((item) => item.name === name))
        .filter(Boolean),
    [institutionWallets, walletServices],
  );

  return {
    data: walletServicesEnabled,
    institutionData: institutionWalletServicesEnabled,
    allData: walletServices,
    error,
  };
}

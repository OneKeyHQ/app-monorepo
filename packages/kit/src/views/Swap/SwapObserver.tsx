import React, { useEffect } from 'react';

import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, usePrevious } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';

import { useEnabledSwappableNetworks } from './hooks/useSwap';
import { refs } from './refs';
import { isNetworkEnabled } from './utils';

const NetworkObserver = () => {
  const { network } = useActiveWalletAccount();
  const prevNetowrk = usePrevious(network);
  useEffect(() => {
    async function resetNativeToken(baseNetwork: Network) {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken(
        baseNetwork.id,
      );
      if (nativeToken && refs.inputIsDirty === false) {
        backgroundApiProxy.serviceSwap.selectToken(
          'INPUT',
          baseNetwork,
          nativeToken,
        );
        backgroundApiProxy.serviceSwap.setSendingAccountByNetwork(baseNetwork);
      }
      backgroundApiProxy.serviceSwap.setNetworkSelectorId(baseNetwork.id);
    }
    function main() {
      if (network && isNetworkEnabled(network)) {
        if (prevNetowrk === undefined) {
          resetNativeToken(network);
        }
      }
    }
    main();
    return () => {
      refs.inputIsDirty = false;
    };
  }, [network, prevNetowrk]);
  return null;
};

const AccountsObserver = () => {
  useEffect(() => {
    const fn = (account: Account) => {
      backgroundApiProxy.serviceSwap.handleAccountRemoved(account);
    };
    appUIEventBus.on(AppUIEventBusNames.RemoveAccount, fn);
    return function () {
      appUIEventBus.off(AppUIEventBusNames.RemoveAccount, fn);
    };
  }, []);
  const accounts = useAppSelector((s) => s.runtime.accounts);
  useEffect(() => {
    backgroundApiProxy.serviceSwap.refreshSendingAccount();
  }, [accounts]);
  return null;
};

const TokenUpdater = () => {
  const enabledNetworks = useEnabledSwappableNetworks();
  useEffect(() => {
    backgroundApiProxy.serviceToken.getEnabledNativeTokens({
      forceUpdate: true,
    });
  }, []);
  useEffect(() => {
    async function main() {
      for (let i = 0; i < enabledNetworks.length; i += 1) {
        const network = enabledNetworks[i];
        await backgroundApiProxy.serviceToken.fetchTokensIfEmpty({
          activeNetworkId: network.id,
        });
      }
    }
    main();
  }, [enabledNetworks]);
  return null;
};

const SwapListener = () => (
  <>
    <NetworkObserver />
    <AccountsObserver />
    <TokenUpdater />
  </>
);

export default SwapListener;

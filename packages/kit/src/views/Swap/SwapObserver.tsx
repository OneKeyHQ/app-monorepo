import React, { useEffect } from 'react';

import { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, usePrevious } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';

import { useEnabledSwappableNetworks } from './hooks/useSwap';
import { isNetworkEnabled } from './utils';

const NetworkObserver = () => {
  const { network } = useActiveWalletAccount();
  const prevNetowrk = usePrevious(network);
  useEffect(() => {
    if (network && isNetworkEnabled(network)) {
      if (prevNetowrk === undefined) {
        backgroundApiProxy.serviceSwap.setDefaultInputToken(network.id);
      }
    }
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

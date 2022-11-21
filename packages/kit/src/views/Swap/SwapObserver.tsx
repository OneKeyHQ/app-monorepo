import React, { useEffect } from 'react';

import { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';

const NetworkObserver = () => {
  useEffect(() => {
    backgroundApiProxy.serviceSwap.setDefaultInputToken();
  }, []);
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
  useEffect(() => {
    backgroundApiProxy.serviceSwap.getSwapTokens();
  }, []);
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

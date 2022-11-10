import React, { useCallback, useEffect } from 'react';

import { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { AppStatusActiveListener } from '../../components/AppStatusActiveListener';
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
  const onActive = useCallback(
    () => backgroundApiProxy.serviceSwap.getSwapTokens(),
    [],
  );
  useEffect(() => {
    onActive();
  }, [onActive]);
  return <AppStatusActiveListener onActive={onActive} />;
};

const SwapListener = () => (
  <>
    <NetworkObserver />
    <AccountsObserver />
    <TokenUpdater />
  </>
);

export default SwapListener;

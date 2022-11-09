import React, { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

const TokenUpdaterWeb  = () => {
  useEffect(() => {
    backgroundApiProxy.serviceSwap.getSwapTokens();
  }, []);
  return null;
};

const TokenUpdaterNative = () => {
  const appState = useRef(AppState.currentState);
  const onChange = useCallback((nextState: AppStateStatus) => {
    if (appState.current === 'background' && nextState === 'active') {
      backgroundApiProxy.serviceApp.checkLockStatus();
    }
    appState.current = nextState;
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      // AppState.addEventListener return subscription object in native, but return empty in web
      if (subscription) {
        subscription.remove();
      } else {
        AppState.removeEventListener('change', onChange);
      }
    };
  }, [onChange]);
  return null;
}

const SwapListener = () => (
  <>
    <NetworkObserver />
    <AccountsObserver />
    {platformEnv.isNative ? <TokenUpdaterNative /> : <TokenUpdaterWeb />}
  </>
);

export default SwapListener;

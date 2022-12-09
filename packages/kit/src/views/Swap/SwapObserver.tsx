import React, { useEffect } from 'react';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/types';

import { SwapRoutes } from './typings';

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

const WelcomeObserver = () => {
  const navigation = useNavigation();
  useEffect(() => {
    async function main() {
      const swapWelcomeShown = await simpleDb.setting.getSwapWelcomeShown();
      if (swapWelcomeShown) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Swap,
        params: {
          screen: SwapRoutes.Welcome,
        },
      });
    }
    main();
  }, [navigation]);
  return null;
};

const SwapListener = () => (
  <>
    <NetworkObserver />
    <AccountsObserver />
    <TokenUpdater />
    <WelcomeObserver />
  </>
);

export default SwapListener;

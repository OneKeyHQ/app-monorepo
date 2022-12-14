import { useEffect } from 'react';

import { Account } from '@onekeyhq/engine/src/types/account';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import { useIsFocused } from '@react-navigation/native';

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
  const isFocused = useIsFocused();
  useEffect(() => {
    async function main() {
      const swapWelcomeShown =
        await backgroundApiProxy.serviceSwap.getSwapWelcomeShown();
      if (swapWelcomeShown || !isFocused) {
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Swap,
        params: {
          screen: SwapRoutes.Welcome,
        },
      });
    }
    const timer = setTimeout(main, 1000);
    return () => clearTimeout(timer);
  }, [navigation, isFocused]);
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

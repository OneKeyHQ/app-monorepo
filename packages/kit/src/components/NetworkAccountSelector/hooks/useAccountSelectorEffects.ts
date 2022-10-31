/* eslint-disable @typescript-eslint/no-unused-vars */
import { useCallback, useEffect, useRef } from 'react';

import { InteractionManager } from 'react-native';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useEffectOnUpdate } from '../../../hooks/useEffectOnUpdate';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';

import { useAccountSelectorInfo } from './useAccountSelectorInfo';

const {
  updateIsLoading,
  updatePreloadingCreateAccount,
  updateSelectedWalletId,
  updateSelectedNetworkId,
} = reducerAccountSelector.actions;

function useAccountSelectorEffects() {
  const {
    isOpenDelay,
    isCloseFromOpen,
    preloadingCreateAccount,
    activeWallet, // useActiveWalletAccount
    activeNetwork, // useActiveWalletAccount
    activeAccount, // useActiveWalletAccount
    activeWalletRef,
    activeNetworkRef,
    isOpen,
  } = useAccountSelectorInfo();
  const { serviceAccountSelector, dispatch } = backgroundApiProxy;

  const isOpenDelayRef = useRef<boolean | undefined>();
  isOpenDelayRef.current = isOpenDelay && isOpen;

  const preloadingCreateAccountRef = useRef(preloadingCreateAccount);
  preloadingCreateAccountRef.current = preloadingCreateAccount;

  const setSelectedWalletToActive = useCallback(
    ({ runAfterInteractions }: { runAfterInteractions?: boolean } = {}) => {
      if (runAfterInteractions) {
        return InteractionManager.runAfterInteractions(() =>
          serviceAccountSelector.setSelectedWalletToActive(),
        );
      }
      return serviceAccountSelector.setSelectedWalletToActive();
    },
    [serviceAccountSelector],
  );

  useEffect(() => {
    debugLogger.accountSelector.info('useAccountSelectorEffects mount');
    return () => {
      debugLogger.accountSelector.info('useAccountSelectorEffects unmounted');
    };
  }, []);

  // ** update on WalletSelector change wallet
  // ** update on NetworkAccountSelectorTrigger mounted
  // ** update on External Account added at another chain
  // DO NOT deps `activeAccount` here, may cause cycle effects
  useEffect(() => {
    if (activeWallet) {
      setSelectedWalletToActive({ runAfterInteractions: true });
    }
  }, [activeWallet, setSelectedWalletToActive]);

  // ** update on NetworkAccountSelector closed
  //    change network & wallet, select other account, close and reopen
  useEffectOnUpdate(() => {
    // eslint-disable-next-line @typescript-eslint/require-await
    const resetSelectedWalletAndNetwork = async () => {
      if (!isOpenDelay) {
        const walletId = activeWalletRef.current?.id;
        const networkId = activeNetworkRef.current?.id;
        dispatch(
          // updateAccountsGroup([]), // clear section data in redux
          updateIsLoading(false),
          updatePreloadingCreateAccount(undefined),
          updateSelectedWalletId(walletId),
          updateSelectedNetworkId(networkId),
        );
        debugLogger.accountSelector.info(
          'Reset selected walletId & networkId after close',
          {
            networkId,
            walletId,
          },
        );
      }
    };

    // feedback slowly in Desktop
    // InteractionManager.runAfterInteractions(resetSelectedWalletAndNetwork);
    resetSelectedWalletAndNetwork();
  }, [isOpenDelay]);
}

export function NetworkAccountSelectorEffectsSingleton() {
  useAccountSelectorEffects();
  return null;
}

export { useAccountSelectorEffects };

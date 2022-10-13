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
    isCloseFromOpenDelay,
    preloadingCreateAccount,
    activeWallet, // useActiveWalletAccount
    activeNetwork, // useActiveWalletAccount
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
  useEffect(() => {
    if (activeWallet) {
      setSelectedWalletToActive({ runAfterInteractions: true });
    }
  }, [activeWallet, setSelectedWalletToActive]);

  // ** update on NetworkAccountSelector closed
  //    change network & wallet, close and reopen
  useEffectOnUpdate(() => {
    const walletId = activeWallet?.id;
    const networkId = activeNetwork?.id;
    // eslint-disable-next-line @typescript-eslint/require-await
    const resetSelectedWalletAndNetwork = async () => {
      if (isCloseFromOpenDelay) {
        dispatch(
          // updateAccountsGroup([]), // clear section data in redux
          updateIsLoading(false),
          updatePreloadingCreateAccount(undefined),
          updateSelectedWalletId(walletId),
          updateSelectedNetworkId(networkId),
        );
      }
    };

    // feedback slowly in Desktop
    // InteractionManager.runAfterInteractions(resetSelectedWalletAndNetwork);
    resetSelectedWalletAndNetwork();
  }, [activeWallet?.id, activeNetwork?.id, isCloseFromOpenDelay]);
}

export function NetworkAccountSelectorEffectsSingleton() {
  useAccountSelectorEffects();
  return null;
}

export { useAccountSelectorEffects };

import { useCallback, useEffect, useMemo } from 'react';

import { InteractionManager } from 'react-native';

import { INetwork, IWallet } from '@onekeyhq/engine/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
  useManageNetworks,
} from '../../../hooks';
import { useRuntimeWallets } from '../../../hooks/redux';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';

import {
  ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY,
  ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY,
} from './accountSelectorConsts';
import { useDeviceStatusOfHardwareWallet } from './useDeviceStatusOfHardwareWallet';

const { updateIsOpenDelay, updateAccountsGroup, updateIsLoading } =
  reducerAccountSelector.actions;

export function useAccountSelectorInfo({ isOpen }: { isOpen?: boolean }) {
  const { dispatch, serviceAccountSelector, engine } = backgroundApiProxy;

  // delay wait drawer closed animation done
  const isOpenDelay = useDebounce(
    isOpen,
    ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY,
  );
  const isOpenDelayForShow = useDebounce(
    isOpen,
    ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY,
  );

  useEffect(() => {
    dispatch(updateIsOpenDelay(Boolean(isOpenDelay)));
  }, [dispatch, isOpenDelay]);

  const { wallets } = useRuntimeWallets();

  const { enabledNetworks } = useManageNetworks();
  const { deviceStatus } = useDeviceStatusOfHardwareWallet();

  const {
    account: activeAccount,
    wallet: activeWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();

  const {
    networkId,
    walletId,
    accountsGroup,
    isLoading,
    preloadingCreateAccount,
  } = useAppSelector((s) => s.accountSelector);
  const { refreshAccountSelectorTs } = useAppSelector((s) => s.refresher);

  const refreshAccounts = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      if (isOpenDelay && isOpen) {
        serviceAccountSelector.refreshAccountsGroup();
      }
    });
  }, [isOpen, isOpenDelay, serviceAccountSelector]);

  const { result: selectedWallet } = usePromiseResult(
    (): Promise<IWallet | null | undefined> =>
      walletId ? engine.getWalletSafe(walletId) : Promise.resolve(null),
    [walletId],
  );
  const { result: selectedNetwork } = usePromiseResult(
    (): Promise<INetwork | null | undefined> =>
      networkId ? engine.getNetworkSafe(networkId) : Promise.resolve(null),
    [networkId],
  );

  const selectedNetworkId = networkId;
  useEffect(() => {
    debugLogger.accountSelector.info(
      'useEffect selectedNetworkId changed: ',
      selectedNetworkId,
    );
    if (!isOpenDelay) {
      return;
    }
    if (
      selectedNetworkId &&
      !enabledNetworks.find((item) => item.id === selectedNetworkId)
    ) {
      // update selected network to ALL
      serviceAccountSelector.updateSelectedNetwork(undefined);
    }
  }, [enabledNetworks, isOpenDelay, selectedNetworkId, serviceAccountSelector]);
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      if (isOpenDelay && !preloadingCreateAccount) {
        serviceAccountSelector.updateSelectedNetwork(activeNetwork?.id);
      }
    });
  }, [
    activeNetwork,
    preloadingCreateAccount,
    isOpenDelay,
    serviceAccountSelector,
  ]);

  const selectedWalletId = walletId;
  useEffect(() => {
    debugLogger.accountSelector.info(
      'useEffect selectedWalletId changed: ',
      selectedWalletId,
    );
    if (!isOpenDelay) {
      return;
    }
    if (
      wallets.length &&
      !wallets.find((item) => item.id === selectedWalletId)
    ) {
      const nextWallet = wallets?.[0];
      if (nextWallet) {
        serviceAccountSelector.updateSelectedWallet(nextWallet?.id);
      }
    }
  }, [isOpenDelay, selectedWalletId, serviceAccountSelector, wallets]);
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      if (isOpenDelay && !preloadingCreateAccount) {
        serviceAccountSelector.updateSelectedWallet(activeWallet?.id);
      }
    });
  }, [
    activeWallet,
    preloadingCreateAccount,
    isOpenDelay,
    serviceAccountSelector,
  ]);

  const refreshHookDeps = useMemo(
    () => ({
      isOpenDelay,
      refreshAccountSelectorTs,
      selectedNetworkId,
      selectedWalletId,
      activeAccount,
    }),
    [
      isOpenDelay,
      refreshAccountSelectorTs,
      selectedNetworkId,
      selectedWalletId,
      activeAccount,
    ],
  );

  useEffect(() => {
    refreshAccounts();
  }, [refreshHookDeps, refreshAccounts]);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      if (!isOpenDelay) {
        dispatch(updateAccountsGroup([]));
        dispatch(updateIsLoading(false));
        serviceAccountSelector.preloadingCreateAccountDone({ delay: 0 });
        serviceAccountSelector.setSelectedWalletToActive();
      }
    });
  }, [dispatch, isOpenDelay, serviceAccountSelector]);

  // InteractionManager.runAfterInteractions(() => {
  // });

  const isAccountsGroupEmpty = useMemo(() => {
    if (!accountsGroup?.length) {
      return true;
    }
    let dataLen = 0;
    accountsGroup.forEach((acc) => (dataLen += acc?.data?.length || 0));
    return dataLen <= 0;
  }, [accountsGroup]);

  return {
    deviceStatus,

    isOpenDelay,
    isOpenDelayForShow,

    selectedNetwork,
    selectedNetworkId,
    selectedWallet,
    selectedWalletId,

    accountsGroup,
    isLoading,
    isAccountsGroupEmpty,
    preloadingCreateAccount,

    refreshAccounts,
  };
}

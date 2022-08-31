import { useCallback, useEffect, useMemo, useRef } from 'react';

import { InteractionManager } from 'react-native';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { INetwork, IWallet } from '@onekeyhq/engine/src/types';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
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
import { wait } from '../../../utils/helper';

import {
  ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY,
  ACCOUNT_SELECTOR_IS_CLOSE_RESET_DELAY,
  ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY,
} from './accountSelectorConsts';
import { useDeviceStatusOfHardwareWallet } from './useDeviceStatusOfHardwareWallet';

const { updateIsLoading } = reducerAccountSelector.actions;

export function useAccountSelectorInfo({ isOpen }: { isOpen?: boolean }) {
  const { dispatch, serviceAccountSelector, engine } = backgroundApiProxy;
  const isVertical = useIsVerticalLayout();

  const isOpenDelayForShow = useDebounce(
    isOpen,
    isVertical
      ? ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY
      : ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY + 100,
  );

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
    isOpenDelay,
  } = useAppSelector((s) => s.accountSelector);
  const { refreshAccountSelectorTs } = useAppSelector((s) => s.refresher);

  const existsHardwareWallet = useMemo(
    () => wallets.some((w) => w.type === WALLET_TYPE_HW),
    [wallets],
  );

  useEffect(() => {
    debugLogger.accountSelector.info('useAccountSelectorInfo mount');
    return () => {
      debugLogger.accountSelector.info('useAccountSelectorInfo unmounted');
    };
  }, []);

  const isOpenDelayRef = useRef<boolean | undefined>();
  isOpenDelayRef.current = isOpenDelay && isOpen;

  const refreshAccounts = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      if (isOpenDelayRef.current) {
        // TODO dispatch loading action directly in UI?
        serviceAccountSelector.refreshAccountsGroup();
      }
    });
  }, [serviceAccountSelector]);

  const { result: selectedWallet } = usePromiseResult(
    (): Promise<IWallet | null | undefined> =>
      walletId ? engine.getWalletSafe(walletId) : Promise.resolve(null),
    [walletId, wallets],
  );
  const { result: selectedNetwork } = usePromiseResult(
    (): Promise<INetwork | null | undefined> =>
      networkId ? engine.getNetworkSafe(networkId) : Promise.resolve(null),
    [networkId, enabledNetworks],
  );

  const selectedNetworkId = networkId;
  useEffect(() => {
    debugLogger.accountSelector.info('useEffect selectedNetworkId changed: ', {
      selectedNetworkId,
      isOpenDelay,
    });
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
    debugLogger.accountSelector.info('useEffect selectedWalletId changed: ', {
      selectedWalletId,
      isOpenDelay,
    });
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
    InteractionManager.runAfterInteractions(async () => {
      if (!isOpenDelay) {
        await wait(ACCOUNT_SELECTOR_IS_CLOSE_RESET_DELAY);
        // dispatch(updateAccountsGroup([]));
        dispatch(updateIsLoading(false));
        await serviceAccountSelector.preloadingCreateAccountDone({ delay: 0 });
        await serviceAccountSelector.setSelectedWalletToActive();
      }
    });
  }, [dispatch, isOpenDelay, serviceAccountSelector]);

  useEffect(() => {
    if (isOpen && existsHardwareWallet) {
      // open account selector refresh device connect status
      deviceUtils.syncDeviceConnectStatus();
    }
  }, [existsHardwareWallet, isOpen]);

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

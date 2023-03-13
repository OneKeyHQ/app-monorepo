import { useCallback, useMemo, useRef } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import type { INetwork, IWallet } from '@onekeyhq/engine/src/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
  useManageNetworks,
  usePrevious,
} from '../../../hooks';
import { useRuntimeWallets } from '../../../hooks/redux';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY,
  ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY,
} from '../../Header/AccountSelectorChildren/accountSelectorConsts';

import { useDeviceStatusOfHardwareWallet } from './useDeviceStatusOfHardwareWallet';

export function useAccountSelectorInfo() {
  const { engine } = backgroundApiProxy;
  const isVertical = useIsVerticalLayout();

  const {
    networkId,
    walletId,
    accountsGroup,
    isLoading,
    preloadingCreateAccount,
    isOpenDelay,
    isOpen,
    accountSelectorMode,
  } = useAppSelector((s) => s.accountSelector);

  const isOpenDelayForShow = useDebounce(
    isOpen,
    isVertical
      ? ACCOUNT_SELECTOR_IS_OPEN_VISIBLE_DELAY
      : ACCOUNT_SELECTOR_EMPTY_VIEW_SHOW_DELAY + 100,
  );
  const isOpenPrev = usePrevious(isOpen);
  const isOpenFromClose = !isOpenPrev && isOpen;
  const isCloseFromOpen = isOpenPrev && !isOpen;

  const { wallets } = useRuntimeWallets();
  const { enabledNetworks } = useManageNetworks();
  const { devicesStatus } = useDeviceStatusOfHardwareWallet();

  const {
    account: activeAccount,
    wallet: activeWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();

  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;

  const activeWalletRef = useRef(activeWallet);
  activeWalletRef.current = activeWallet;

  const activeNetworkRef = useRef(activeNetwork);
  activeNetworkRef.current = activeNetwork;

  const refreshAccountSelectorTs = useAppSelector(
    (s) => s.refresher.refreshAccountSelectorTs,
  );

  const selectedNetworkId = networkId;
  const selectedWalletId = walletId;

  const refreshAccounts = useCallback(() => {
    // noop
  }, []);

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

  const isAccountsGroupEmpty = useMemo(() => {
    if (!accountsGroup?.length) {
      return true;
    }
    let dataLen = 0;
    accountsGroup.forEach((acc) => (dataLen += acc?.data?.length || 0));
    return dataLen <= 0;
  }, [accountsGroup]);

  return useMemo(
    () => ({
      wallets,
      refreshAccountSelectorTs,
      devicesStatus,

      isOpenFromClose,
      isCloseFromOpen,
      isOpenDelay,
      isOpenDelayForShow,
      isOpen,

      selectedNetwork, // TODO selectedNetworkLazy
      selectedNetworkId,
      selectedWallet, // TODO selectedWalletLazy
      selectedWalletId,

      accountsGroup,
      isLoading,
      isAccountsGroupEmpty,
      preloadingCreateAccount,

      refreshAccounts,
      activeAccount,
      activeWallet,
      activeNetwork,

      activeAccountRef,
      activeNetworkRef,
      activeWalletRef,
      accountSelectorMode,
    }),
    [
      wallets,
      refreshAccountSelectorTs,
      devicesStatus,
      isOpenFromClose,
      isCloseFromOpen,
      isOpenDelay,
      isOpenDelayForShow,
      isOpen,
      selectedNetwork,
      selectedNetworkId,
      selectedWallet,
      selectedWalletId,
      accountsGroup,
      isLoading,
      isAccountsGroupEmpty,
      preloadingCreateAccount,
      refreshAccounts,
      activeAccount,
      activeWallet,
      activeNetwork,
      accountSelectorMode,
    ],
  );
}

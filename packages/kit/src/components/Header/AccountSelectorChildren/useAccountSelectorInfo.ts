import { useCallback, useEffect, useMemo, useState } from 'react';

import { InteractionManager } from 'react-native';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { INetwork, IWallet } from '@onekeyhq/engine/src/types';
import { Device } from '@onekeyhq/engine/src/types/device';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
  useManageNetworks,
} from '../../../hooks';
import {
  useRuntime,
  useRuntimeWallets,
  useSettings,
} from '../../../hooks/redux';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';

import { AccountGroup } from './RightAccountSection/ItemSection';
import { AllNetwork } from './RightChainSelector';

export type DeviceStatusType = {
  isConnected: boolean;
  hasUpgrade: boolean;
};

function useDeviceStatusOfHardwareWallet() {
  const { hardwareWallets } = useRuntimeWallets();
  const { deviceUpdates } = useSettings();
  const { connected } = useAppSelector((s) => s.hardware);
  const { selectedNetwork, selectedWallet, isSelectorOpen } = useAppSelector(
    (s) => s.accountSelector,
  );
  const [deviceStatus, setDeviceStatus] =
    useState<Record<string, DeviceStatusType | undefined>>();

  const getStatus = useCallback(
    (connectId: string | undefined): DeviceStatusType | undefined => {
      if (!connectId) return undefined;

      return {
        isConnected: connected.includes(connectId),
        hasUpgrade:
          !!deviceUpdates?.[connectId]?.ble ||
          !!deviceUpdates?.[connectId]?.firmware,
      };
    },
    [connected, deviceUpdates],
  );

  useEffect(() => {
    console.log(
      'useEffect hardwareWallets changed >>> useDeviceStatusOfHardwareWallet',
    );
    if (!isSelectorOpen) {
      return;
    }
    (async () => {
      const hwDeviceRec = (
        await backgroundApiProxy.engine.getHWDevices()
      ).reduce((acc, device) => {
        acc[device.id] = device;
        return acc;
      }, {} as Record<string, Device>);

      setDeviceStatus(
        hardwareWallets.reduce((acc, wallet) => {
          if (!wallet.associatedDevice) return acc;

          const device = hwDeviceRec[wallet.associatedDevice];
          if (device) {
            acc[wallet.associatedDevice] = getStatus(device.mac);
          }
          return acc;
        }, {} as Record<string, DeviceStatusType | undefined>),
      );
    })();
  }, [getStatus, hardwareWallets, isSelectorOpen]);

  // for RightHeader
  // deviceStatus?.[activeSelectedWallet?.associatedDevice ?? ''] ??

  // for LeftSide
  // deviceStatus

  return {
    deviceStatus,
  };
}

export function useAccountSelectorInfo({ isOpen }: { isOpen?: boolean }) {
  const { engine, dispatch, serviceAccountSelector } = backgroundApiProxy;

  // delay wait drawer closed animation done
  const isOpenDelay = useDebounce(isOpen, 600);
  useEffect(() => {
    dispatch(
      reducerAccountSelector.actions.updateIsSelectorOpen(Boolean(isOpenDelay)),
    );
  }, [dispatch, isOpenDelay]);

  const { wallets } = useRuntimeWallets();

  // TODO sort enabledNetworks
  const { enabledNetworks } = useManageNetworks();
  const { deviceStatus } = useDeviceStatusOfHardwareWallet();

  const {
    account: activeAccount,
    wallet: activeWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();

  // TODO save to db networkId, walletId only
  const {
    selectedNetwork,
    selectedWallet,
    isSelectorOpen,

    accountsInGroupLoading,
    accountsInGroup,
  } = useAppSelector((s) => s.accountSelector);

  const rightChainSelectorNetworkId = useMemo(
    () => selectedNetwork?.id ?? AllNetwork,
    [selectedNetwork?.id],
  );

  const selectedNetworkId = selectedNetwork?.id;
  useEffect(() => {
    console.log('useEffect selectedNetworkId changed');
    if (!isSelectorOpen) {
      return;
    }
    if (
      selectedNetworkId &&
      !enabledNetworks.find((item) => item.id === selectedNetworkId)
    ) {
      // update selected network to ALL
      serviceAccountSelector.setSelectedNetwork(null);
    }
  }, [
    enabledNetworks,
    isSelectorOpen,
    selectedNetworkId,
    serviceAccountSelector,
  ]);
  // useEffect(() => {
  //   serviceAccountSelector.setSelectedNetwork(activeNetwork);
  // }, [activeNetwork, serviceAccountSelector]);

  const selectedWalletId = selectedWallet?.id;
  useEffect(() => {
    console.log('useEffect selectedWalletId changed');
    if (!isSelectorOpen) {
      return;
    }
    if (
      wallets.length &&
      !wallets.find((item) => item.id === selectedWalletId)
    ) {
      const nextWallet = wallets?.[0];
      if (nextWallet) {
        serviceAccountSelector.setSelectedWallet(nextWallet);
      }
    }
  }, [isSelectorOpen, selectedWalletId, serviceAccountSelector, wallets]);
  // useEffect(() => {
  //   serviceAccountSelector.setSelectedWallet(activeWallet);
  // }, [activeWallet, serviceAccountSelector]);

  const refreshHookMemo = useMemo(
    () => ({ isSelectorOpen, rightChainSelectorNetworkId, selectedWalletId }),
    [isSelectorOpen, rightChainSelectorNetworkId, selectedWalletId],
  );
  const refreshHook = useDebounce(refreshHookMemo, 0);

  useEffect(() => {
    if (isSelectorOpen && isOpen) {
      serviceAccountSelector.reloadAccountsByGroup();
    }
  }, [refreshHook, isSelectorOpen, isOpen, serviceAccountSelector]);

  useEffect(() => {
    if (!isSelectorOpen) {
      dispatch(
        reducerAccountSelector.actions.updateAccountsInGroup({
          payload: [],
        }),
      );
      dispatch(
        reducerAccountSelector.actions.updateAccountsInGroupLoading(false),
      );
      serviceAccountSelector.setSelectedWalletByActive();
    }
  }, [dispatch, isSelectorOpen, serviceAccountSelector]);

  // InteractionManager.runAfterInteractions(() => {
  // });

  // const activeSelectedWallet = useMemo(() => {
  //   const wallet =
  //     wallets.find((_wallet) => _wallet.id === selectedWallet?.id) ??
  //     wallets.find((_wallet) => _wallet.id === currentActiveWallet?.id) ??
  //     null;
  //   return wallet;
  // }, [selectedWallet?.id, wallets, currentActiveWallet]);

  return {
    deviceStatus,
    isSelectorOpen,

    selectedNetwork,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    setSelectedNetwork: serviceAccountSelector.setSelectedNetwork,

    selectedWallet,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    setSelectedWallet: serviceAccountSelector.setSelectedWallet,

    accountsInGroup,
    accountsInGroupLoading,

    rightChainSelectorNetworkId,
    setRightChainSelectorNetworkId:
      // eslint-disable-next-line @typescript-eslint/unbound-method
      serviceAccountSelector.setRightChainSelectorNetworkId,
  };
}

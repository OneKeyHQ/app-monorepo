import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { InteractionManager } from 'react-native';

import {
  Box,
  IconButton,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Device } from '@onekeyhq/engine/src/types/device';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks';
import {
  useActiveWalletAccount,
  useAppSelector,
  useRuntime,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';

import LeftSide from './LeftSide';
import RightAccountCreateButton from './RightAccountCreateButton';
import { RightAccountEmptyPanel } from './RightAccountEmptyPanel';
import AccountSection from './RightAccountSection';
import RightChainSelector, { AllNetwork } from './RightChainSelector';
import RightHeader from './RightHeader';

import type { AccountGroup } from './RightAccountSection/ItemSection';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';
export type DeviceStatusType = {
  isConnected: boolean;
  hasUpgrade: boolean;
};

const AccountSelectorChildren: FC<{
  isOpen?: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  toggleOpen?: (...args: any) => any;
}> = ({ isOpen }) => {
  const [loadingAccountWalletId, setLoadingAccountWalletId] =
    useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { RemoveAccountDialog } = useRemoveAccountDialog();

  const { engine } = backgroundApiProxy;
  const {
    account: currentSelectedAccount,
    wallet: defaultSelectedWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();
  const { wallets } = useRuntime();
  const { connected } = useAppSelector((s) => s.hardware);
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const { deviceUpdates } = useSettings();

  const [deviceStatus, setDeviceStatus] =
    useState<Record<string, DeviceStatusType | undefined>>();

  const previousIsOpen = usePrevious(isOpen);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(
    defaultSelectedWallet,
  );
  const [accountsMap, setAccountsMap] = useState<
    Record<string, AccountGroup[]>
  >({});

  const [selectedNetworkId, setSelectedNetworkId] = useState<string>(
    activeNetwork?.id ?? AllNetwork,
  );

  const activeWallet = useMemo(() => {
    const wallet =
      wallets.find((_wallet) => _wallet.id === selectedWallet?.id) ??
      wallets.find((_wallet) => _wallet.id === defaultSelectedWallet?.id) ??
      null;
    return wallet;
  }, [selectedWallet?.id, wallets, defaultSelectedWallet]);

  const refreshAccounts = useCallback(
    async (walletId: string, networkId: string) => {
      if (!walletId) {
        return;
      }
      const networksMap = new Map(
        (await engine.listNetworks()).map((key) => [key.id, key]),
      );

      let accountsGroup: AccountGroup[] = [];
      if (networkId === AllNetwork) {
        accountsGroup = (
          await engine.getWalletAccountsGroupedByNetwork(walletId)
        )
          .reduce((accumulate, current) => {
            const network = networksMap.get(current.networkId);
            if (!network) return accumulate;
            return [...accumulate, { title: network, data: current.accounts }];
          }, [] as AccountGroup[])
          .filter((group) => group.data.length > 0);
      } else {
        const network = networksMap.get(networkId);
        if (!network || !walletId) return;
        const currentWallet = await engine.getWallet(walletId);
        const data = await engine.getAccounts(
          currentWallet.accounts,
          network.id,
        );
        accountsGroup = [
          {
            title: network,
            data,
          },
        ];
      }

      setAccountsMap((prev) => ({
        ...prev,
        [walletId]: accountsGroup,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onLoadingAccount = useCallback(
    (walletId: string, networkId: string, ready?: boolean) => {
      if (!ready) {
        setSelectedNetworkId(networkId);
        setLoadingAccountWalletId(walletId ?? '');
      } else {
        setLoadingAccountWalletId('');
        const targetWallet =
          wallets.find((wallet) => wallet.id === walletId) ?? null;
        if (!targetWallet) return null;
        setSelectedWallet(targetWallet);
        setSelectedNetworkId(networkId);
        refreshAccounts(targetWallet.id, networkId);
      }
    },
    [wallets, refreshAccounts],
  );

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
    (async () => {
      const hardwareWallets = wallets.filter((w) => w.type === 'hw');
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
  }, [getStatus, wallets]);

  /** every time change active wallet */
  useEffect(() => {
    if (!activeWallet?.id || !selectedNetworkId) return;
    InteractionManager.runAfterInteractions(() => {
      refreshAccounts(activeWallet.id, selectedNetworkId);
    });
  }, [activeWallet?.id, refreshAccounts, selectedNetworkId]);

  useEffect(() => {
    if (!previousIsOpen && isOpen) {
      const targetWallet =
        wallets.find((wallet) => wallet.id === defaultSelectedWallet?.id) ??
        null;
      setSelectedWallet(targetWallet);
      setSelectedNetworkId(activeNetwork?.id ?? AllNetwork);
    }
  }, [
    previousIsOpen,
    isOpen,
    defaultSelectedWallet?.id,
    wallets,
    activeNetwork?.id,
  ]);

  const onLock = useCallback(() => {
    backgroundApiProxy.serviceApp.lock(true);
  }, []);

  const activeAccounts = useMemo(
    () => (activeWallet?.id ? accountsMap[activeWallet?.id] ?? [] : []),
    [accountsMap, activeWallet?.id],
  );

  const isActiveAccountsEmpty = useMemo(() => {
    if (!activeAccounts?.length) {
      return true;
    }
    let dataLen = 0;
    activeAccounts.forEach((acc) => (dataLen += acc?.data?.length || 0));
    return dataLen <= 0;
  }, [activeAccounts]);

  return (
    <>
      <LeftSide
        selectedWallet={activeWallet}
        setSelectedWallet={setSelectedWallet}
        deviceStatus={deviceStatus}
      />
      <VStack flex={1} pb={`${bottom}px`}>
        <RightHeader
          onLoadingAccount={onLoadingAccount}
          selectedWallet={activeWallet}
          deviceStatus={
            deviceStatus?.[activeWallet?.associatedDevice ?? ''] ?? undefined
          }
        />
        <Box
          testID="AccountSelectorChildren-RightChainSelector-Container"
          m={2}
        >
          <RightChainSelector
            activeWallet={activeWallet}
            selectedNetworkId={selectedNetworkId}
            setSelectedNetworkId={setSelectedNetworkId}
          />
        </Box>
        <Box flex={1}>
          {isActiveAccountsEmpty ? (
            <RightAccountEmptyPanel
              activeAccounts={activeAccounts}
              activeWallet={activeWallet}
              selectedNetworkId={selectedNetworkId}
            />
          ) : (
            <AccountSection
              activeAccounts={activeAccounts}
              activeWallet={activeWallet}
              activeNetwork={activeNetwork}
              activeAccount={currentSelectedAccount}
              loadingAccountWalletId={loadingAccountWalletId}
              refreshAccounts={refreshAccounts}
            />
          )}
        </Box>
        <Box p={2} flexDirection="row">
          <Box flex="1">
            {isOpen && (
              <RightAccountCreateButton
                onLoadingAccount={onLoadingAccount}
                isLoading={!!loadingAccountWalletId}
                activeNetwork={activeNetwork}
                selectedNetworkId={selectedNetworkId}
                activeWallet={activeWallet}
              />
            )}
          </Box>
          {isPasswordSet ? (
            <IconButton
              ml="3"
              name="LockOutline"
              size="lg"
              minW="50px"
              minH="50px"
              onPress={onLock}
            />
          ) : null}
        </Box>
      </VStack>
      {RemoveAccountDialog}
    </>
  );
};

export default memo(AccountSelectorChildren);

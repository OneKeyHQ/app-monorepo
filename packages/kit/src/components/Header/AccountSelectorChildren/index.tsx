import React, { FC, memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { InteractionManager } from 'react-native';

import {
  Box,
  Button,
  IconButton,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce, usePrevious } from '@onekeyhq/kit/src/hooks';
import {
  useActiveWalletAccount,
  useAppSelector,
  useRuntime,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { changeActiveAccount } from '../../../store/reducers/general';
import reducerAccountSelector from '../../../store/reducers/reducerAccountSelector';

import LeftSide from './LeftSide';
import RightAccountCreateButton from './RightAccountCreateButton';
import RightAccountEmptyPanel from './RightAccountEmptyPanel';
import RightAccountSection, {
  AccountSectionLoadingSkeleton,
} from './RightAccountSection';
import RightChainSelector, { AllNetwork } from './RightChainSelector';
import RightHeader from './RightHeader';
import { useAccountSelectorInfo } from './useAccountSelectorInfo';

import type { AccountGroup } from './RightAccountSection/ItemSection';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';
export type DeviceStatusType = {
  isConnected: boolean;
  hasUpgrade: boolean;
};

export type IAccountSelectorChildrenProps = {
  isOpen?: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  toggleOpen?: (...args: any) => any;
};
const AccountSelectorChildren: FC<IAccountSelectorChildrenProps> = ({
  isOpen,
}) => {
  const [loadingAccountWalletId, setLoadingAccountWalletId] =
    useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { RemoveAccountDialog } = useRemoveAccountDialog();

  const { engine, dispatch } = backgroundApiProxy;
  const {
    account: currentActiveAccount,
    wallet: currentActiveWallet,
    network: currentActiveNetwork,
  } = useActiveWalletAccount();
  const { wallets } = useRuntime();
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);

  const {
    selectedWallet,
    selectedNetwork,
    setSelectedNetwork,
    setSelectedWallet,
    rightChainSelectorNetworkId,
    setRightChainSelectorNetworkId,
    accountsInGroup,
    accountsInGroupLoading,
    deviceStatus,
    isSelectorOpen,
  } = useAccountSelectorInfo({ isOpen });

  const activeSelectedWallet = selectedWallet;

  const refreshAccounts = useCallback(() => null, []);

  const onLoadingAccount = useCallback(
    (walletId: string, networkId: string, ready?: boolean) => {
      if (!ready) {
        setRightChainSelectorNetworkId(networkId);
        setLoadingAccountWalletId(walletId ?? '');
      } else {
        setLoadingAccountWalletId('');
        const targetWallet =
          wallets.find((wallet) => wallet.id === walletId) ?? null;
        if (!targetWallet) return null;
        setSelectedWallet(targetWallet);
        setRightChainSelectorNetworkId(networkId);
        // refreshAccounts(targetWallet.id, networkId);
      }
    },
    [
      setRightChainSelectorNetworkId,
      wallets,
      setSelectedWallet,
      // refreshAccounts,
    ],
  );

  const onLock = useCallback(() => {
    backgroundApiProxy.serviceApp.lock(true);
  }, []);

  const accountsGroup = accountsInGroup.payload;
  const isActiveAccountsEmpty = useMemo(() => {
    if (!accountsGroup?.length) {
      return true;
    }
    let dataLen = 0;
    accountsGroup.forEach((acc) => (dataLen += acc?.data?.length || 0));
    return dataLen <= 0;
  }, [accountsGroup]);

  const activeSelectedWalletDeBounced = useDebounce(activeSelectedWallet, 600);

  const loadingSkeletonRef = useRef(
    <Box>
      <AccountSectionLoadingSkeleton isLoading />
      <AccountSectionLoadingSkeleton isLoading />
      <AccountSectionLoadingSkeleton isLoading />
    </Box>,
  );
  const rightContent = useMemo(() => {
    if (!isSelectorOpen) {
      // return null;
    }
    if (accountsInGroupLoading || !isSelectorOpen) {
      return loadingSkeletonRef.current;
    }

    if (isActiveAccountsEmpty)
      return (
        <RightAccountEmptyPanel
          activeWallet={activeSelectedWalletDeBounced}
          selectedNetworkId={rightChainSelectorNetworkId}
        />
      );

    return (
      <RightAccountSection
        activeAccounts={accountsGroup}
        activeWallet={activeSelectedWallet}
        activeNetwork={currentActiveNetwork}
        activeAccount={currentActiveAccount}
        loadingAccountWalletId={loadingAccountWalletId}
        refreshAccounts={refreshAccounts}
      />
    );
  }, [
    isSelectorOpen,
    accountsGroup,
    accountsInGroupLoading,
    activeSelectedWallet,
    activeSelectedWalletDeBounced,
    currentActiveAccount,
    currentActiveNetwork,
    isActiveAccountsEmpty,
    loadingAccountWalletId,
    refreshAccounts,
    rightChainSelectorNetworkId,
  ]);

  return (
    <>
      <LeftSide
        selectedWallet={activeSelectedWallet}
        setSelectedWallet={setSelectedWallet}
        deviceStatus={deviceStatus}
      />
      <VStack flex={1} pb={`${bottom}px`}>
        <RightHeader
          onLoadingAccount={onLoadingAccount}
          selectedWallet={activeSelectedWallet}
          deviceStatus={
            deviceStatus?.[activeSelectedWallet?.associatedDevice ?? ''] ??
            undefined
          }
        />
        <Box
          testID="AccountSelectorChildren-RightChainSelector-Container"
          m={2}
        >
          {platformEnv.isDev && (
            <Button
              onPress={() => {
                // dispatch(
                //   changeActiveAccount({
                //     activeAccountId: "hd-1--m/44'/60'/0'/0/1",
                //     activeWalletId: 'hello-world-0000',
                //   }),
                // );
                console.log({
                  accountsInGroup,
                  selectedWallet,
                  selectedNetwork,
                  rightChainSelectorNetworkId,

                  // setSelectedNetwork,
                  // setSelectedWallet,
                  // setRightChainSelectorNetworkId,
                });
              }}
            >
              Show
            </Button>
          )}
          <RightChainSelector
            activeWallet={activeSelectedWallet}
            selectedNetworkId={rightChainSelectorNetworkId}
            setSelectedNetworkId={setRightChainSelectorNetworkId}
          />
        </Box>
        <Box flex={1}>{rightContent}</Box>
        <Box p={2} flexDirection="row">
          <Box flex="1">
            <RightAccountCreateButton
              onLoadingAccount={onLoadingAccount}
              isLoading={!!loadingAccountWalletId}
              activeNetwork={currentActiveNetwork}
              selectedNetworkId={rightChainSelectorNetworkId}
              activeWallet={activeSelectedWallet}
            />
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

function AccountSelectorChildrenLazy(props: IAccountSelectorChildrenProps) {
  const { isOpen } = props;
  if (isOpen) {
    return <AccountSelectorChildren {...props} />;
  }
  return null;
}

export default memo(AccountSelectorChildren);

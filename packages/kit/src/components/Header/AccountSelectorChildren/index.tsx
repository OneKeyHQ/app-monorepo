import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Box, VStack, useSafeAreaInsets } from '@onekeyhq/components';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useRuntime,
} from '@onekeyhq/kit/src/hooks/redux';
import useRemoveAccountDialog from '@onekeyhq/kit/src/views/ManagerAccount/RemoveAccount';

import LeftSide from './LeftSide';
import RightAccountCreateButton from './RightAccountCreateButton';
import AccountSection from './RightAccountSection';
import RightChainSelector, { AllNetwork } from './RightChainSelector';
import RightHeader from './RightHeader';

import type { AccountGroup } from './RightAccountSection/ItemSection';

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';

const AccountSelectorChildren: FC<{
  isOpen?: boolean;
  toggleOpen?: (...args: any) => any;
}> = () => {
  const [loadingAccountWalletId, setLoadingAccountWalletId] =
    useState<string>('');

  const { bottom } = useSafeAreaInsets();
  const { RemoveAccountDialog } = useRemoveAccountDialog();

  const { engine } = backgroundApiProxy;
  const {
    account: currentSelectedAccount,
    wallet: defaultSelectedWallet,
    network: activeNetwork,
  } = useActiveWalletAccount();
  const { wallets } = useRuntime();

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
      wallets.find((_wallet) => _wallet.id === selectedWallet?.id) ?? null;
    return wallet;
  }, [selectedWallet?.id, wallets]);

  const refreshAccounts = useCallback(
    async (walletId?: string) => {
      if (!walletId) {
        return;
      }
      const networksMap = new Map(
        (await engine.listNetworks()).map((key) => [key.id, key]),
      );

      let accountsGroup: AccountGroup[] = [];
      if (selectedNetworkId === AllNetwork) {
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
        const network = networksMap.get(selectedNetworkId);
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

      setAccountsMap(() => ({
        [walletId]: accountsGroup,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedNetworkId],
  );

  const onLoadingAccount = useCallback(
    (walletId: string, networkId?: string) => {
      if (networkId) {
        setSelectedNetworkId(networkId);
        setLoadingAccountWalletId(walletId ?? '');
      } else {
        setLoadingAccountWalletId('');
        refreshAccounts(walletId);
      }
    },
    [refreshAccounts],
  );

  /** every time change active wallet */
  useEffect(() => {
    refreshAccounts(activeWallet?.id);
  }, [activeWallet?.id, refreshAccounts]);

  return (
    <>
      <LeftSide
        selectedWallet={activeWallet}
        setSelectedWallet={setSelectedWallet}
      />
      <VStack flex={1} pb={bottom}>
        <RightHeader selectedWallet={activeWallet} />
        <Box m={2}>
          <RightChainSelector
            activeWallet={activeWallet}
            selectedNetworkId={selectedNetworkId}
            setSelectedNetworkId={setSelectedNetworkId}
          />
        </Box>
        <AccountSection
          activeAccounts={
            activeWallet?.id ? accountsMap[activeWallet?.id] ?? [] : []
          }
          activeWallet={activeWallet}
          activeNetwork={activeNetwork}
          activeAccount={currentSelectedAccount}
          loadingAccountWalletId={loadingAccountWalletId}
          refreshAccounts={refreshAccounts}
        />
        <Box p={2}>
          <RightAccountCreateButton
            onLoadingAccount={onLoadingAccount}
            isLoading={!!loadingAccountWalletId}
            activeNetwork={activeNetwork}
            selectedNetworkId={selectedNetworkId}
            activeWallet={activeWallet}
          />
        </Box>
      </VStack>
      {RemoveAccountDialog}
    </>
  );
};

export default memo(AccountSelectorChildren);

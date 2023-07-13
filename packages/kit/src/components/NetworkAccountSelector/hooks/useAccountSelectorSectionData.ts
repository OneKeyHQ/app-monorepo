import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { debounce } from 'lodash';

import { generateFakeAllnetworksAccount } from '@onekeyhq/engine/src/managers/account';
import type { IAccount, IWallet } from '@onekeyhq/engine/src/types';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { AccountNameInfo } from '@onekeyhq/engine/src/types/network';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useIsMounted } from '../../../hooks/useIsMounted';

import type { useAccountSelectorInfo } from './useAccountSelectorInfo';

export type INetworkAccountSelectorAccountListSectionData = {
  wallet: IWallet;
  networkId: string;
  data: IAccount[];
  derivationInfo?: AccountNameInfo | null;
  collapsed: boolean;
};

export const useAllNetworksAccountsData = ({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) => {
  const [data, setData] = useState<Account[]>([]);

  const refresh = useCallback(async () => {
    const { selectedNetworkId, selectedWalletId } = accountSelectorInfo ?? {};
    if (!selectedNetworkId || !selectedWalletId) {
      setData([]);
      return;
    }
    const index =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccountIndex({
        walletId: accountSelectorInfo?.selectedWalletId ?? '',
      });

    if (index === -1) {
      setData([]);
      return;
    }

    const accounts = new Array(index + 1)
      .slice(0, 3)
      .fill(1)
      .map((_, i) =>
        generateFakeAllnetworksAccount({
          accountId: `${selectedWalletId}--${i}`,
        }),
      );

    const networksAccountMapList = await Promise.all(
      accounts.map((account) =>
        backgroundApiProxy.serviceAllNetwork.generateAllNetworksWalletAccounts({
          accountId: account?.id,
          walletId: accountSelectorInfo?.selectedWalletId ?? '',
          refreshCurrentAccount: false,
        }),
      ),
    );
    setData(
      accounts.filter(
        (_a, i) => Object.keys(networksAccountMapList[i])?.length > 0,
      ),
    );
  }, [accountSelectorInfo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, refresh };
};

// TODO $isLastItem in multiple wallet mode optimize
export const isListAccountsSingleWalletMode = true;

const buildData = debounce(
  async ({
    selectedNetworkId,
    selectedWallet,
    wallets,
    setData,
  }: {
    selectedNetworkId?: string;
    selectedWallet?: IWallet | null;
    wallets: IWallet[];
    setData: Dispatch<
      SetStateAction<INetworkAccountSelectorAccountListSectionData[]>
    >;
  }) => {
    const { engine, serviceDerivationPath } = backgroundApiProxy;
    const groupData: INetworkAccountSelectorAccountListSectionData[] = [];
    debugLogger.accountSelector.info(
      'rebuild NetworkAccountSelector accountList data',
      {
        selectedNetworkId,
        selectedWalletId: selectedWallet?.id,
      },
    );
    const pushWalletAccountsData = async (wallet: IWallet) => {
      if (!selectedNetworkId) {
        return;
      }

      const { networkDerivations, accountNameInfo } =
        await serviceDerivationPath.getNetworkDerivations(
          wallet.id,
          selectedNetworkId,
        );
      if (networkDerivations.length > 1) {
        // multiple derivation path mode
        const sequenceNetworkDerivations: typeof networkDerivations = [];
        Object.values(accountNameInfo).forEach((value) => {
          const derivation = networkDerivations.find(
            (d) => d.template === value.template,
          );
          if (derivation) {
            sequenceNetworkDerivations.push(derivation);
          }
        });
        const getAccountPromises = sequenceNetworkDerivations.map(
          async (derivation, index) => {
            const accounts = await engine.getAccounts(
              derivation.accounts,
              selectedNetworkId,
            );
            if (index === networkDerivations.length - 1 && accounts.length) {
              // @ts-ignore
              accounts[accounts.length - 1].$isLastItem = true;
            }
            const derivationInfo = Object.values(accountNameInfo).find(
              (i) => i.template === derivation.template,
            );
            return {
              wallet,
              networkId: selectedNetworkId,
              data: accounts || [],
              derivationInfo,
              collapsed: false,
            };
          },
        );
        const data = await Promise.all(getAccountPromises);
        groupData.push(...data);
      } else {
        // single derivation path mode
        const accounts = await engine.getAccounts(
          wallet.accounts,
          selectedNetworkId,
        );
        if (accounts.length) {
          // @ts-ignore
          accounts[accounts.length - 1].$isLastItem = true;
        }
        groupData.push({
          wallet,
          networkId: selectedNetworkId,
          data: accounts || [],
          derivationInfo: accountNameInfo.default,
          collapsed: false,
        });
      }
    };
    if (isListAccountsSingleWalletMode) {
      if (selectedWallet) {
        await pushWalletAccountsData(selectedWallet);
      }
    } else {
      let walletIndex = 0;
      for (const wallet of wallets) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        walletIndex += 1;
        await pushWalletAccountsData(wallet);
      }
    }
    setData(groupData);
  },
  150,
  {
    leading: false,
    trailing: true,
  },
);

let lastDataCache: INetworkAccountSelectorAccountListSectionData[] = [];
export function useAccountSelectorSectionData({
  accountSelectorInfo,
}: {
  accountSelectorInfo: ReturnType<typeof useAccountSelectorInfo>;
}) {
  const {
    wallets,
    selectedNetworkId,
    selectedWallet,
    refreshAccountSelectorTs,
    activeAccount,
    isOpenDelay,
    isOpen,
  } = accountSelectorInfo;
  const isMounted = useIsMounted();
  const [data, setData] =
    useState<INetworkAccountSelectorAccountListSectionData[]>(lastDataCache);
  useEffect(
    () => () => {
      // TODO cache is error in android, change HD wallet to imported wallet
      lastDataCache = data;
    },
    [data],
  );
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const ts = refreshAccountSelectorTs; // keep this for refresh deps
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const acc = activeAccount?.id; // keep this for refresh deps
    if (
      isMounted.current &&
      isOpenDelay &&
      isOpen &&
      selectedNetworkId &&
      selectedWallet
    ) {
      buildData({
        wallets,
        selectedNetworkId,
        selectedWallet,
        setData,
      });
    }
  }, [
    activeAccount?.id,
    isMounted,
    isOpenDelay,
    isOpen,
    refreshAccountSelectorTs,
    selectedNetworkId,
    selectedWallet,
    wallets,
  ]);
  return data;
}

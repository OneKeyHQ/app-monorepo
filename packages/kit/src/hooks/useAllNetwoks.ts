import { useCallback, useMemo } from 'react';

import { createSelector } from '@reduxjs/toolkit';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../routes/routesEnum';

import { useAccount, useWalletIdFromAccountIdWithFallback } from './useAccount';
import { useAppSelector } from './useAppSelector';
import { useManageNetworks } from './useManageNetworks';
import useNavigation from './useNavigation';
import { useNetwork } from './useNetwork';

import type { ManageNetworkRoutesParams } from '../routes';
import type { IAppState } from '../store';

export const useAllNetworkAccountInfo = ({
  accountId,
}: {
  accountId: string;
}) =>
  useMemo(() => {
    if (!allNetworksAccountRegex.test(accountId)) {
      return;
    }
    return generateFakeAllnetworksAccount({ accountId });
  }, [accountId]);

const selectAllNetworksAccountsMap = (state: IAppState) =>
  state.overview.allNetworksAccountsMap;

export const makeGetAllNetworksAccountsSelector = (accountId?: string | null) =>
  createSelector(
    [selectAllNetworksAccountsMap],
    (map) => map?.[accountId || ''] ?? {},
  );

export const useAllNetworksWalletAccounts = ({
  accountId,
}: {
  accountId?: string | null;
}) => {
  const getAllNetworksAccounts = useMemo(
    () => makeGetAllNetworksAccountsSelector(accountId),
    [accountId],
  );
  const data = useAppSelector(getAllNetworksAccounts);

  const loading = useAppSelector(
    useMemo(
      () =>
        createSelector(
          (s: IAppState) => s.overview.allNetworksAccountsLoading,
          (l) => l?.[accountId ?? ''],
        ),
      [accountId],
    ),
  );

  return {
    data,
    loading,
  };
};

export const useAllNetworksSelectNetworkAccount = ({
  accountId,
  networkId,
  filter: defaultFilter = () => true,
}: {
  accountId: string;
  networkId: string;
  filter?: ManageNetworkRoutesParams[ManageNetworkModalRoutes.AllNetworksNetworkSelector]['filter'];
}) => {
  const walletId = useWalletIdFromAccountIdWithFallback(accountId, '');
  const { enabledNetworks } = useManageNetworks();
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    networkId,
    accountId,
  });
  const { data: networkAccounts } = useAllNetworksWalletAccounts({
    accountId,
  });
  const navigation = useNavigation();

  const select = useCallback(
    (
      filter?: ManageNetworkRoutesParams[ManageNetworkModalRoutes.AllNetworksNetworkSelector]['filter'],
    ) =>
      new Promise<{
        network: Network;
        account: Account;
      }>((resolve) => {
        if (!isAllNetworks(networkId)) {
          if (network && account) {
            resolve({
              network,
              account,
            });
          }
          return;
        }
        const f = filter ?? defaultFilter;
        const filteredNetworks = enabledNetworks
          .map((item) => {
            const accounts = (networkAccounts[item.id] ?? []).filter(
              (a) => !f || f({ network: item, account: a }),
            );
            return {
              ...item,
              accounts,
            };
          })
          .filter((item) => {
            const { accounts } = item;
            if (!accounts.length) return false;
            if (f && !f({ network: item, account: accounts[0] })) return false;
            return true;
          });
        if (
          filteredNetworks.length === 1 &&
          filteredNetworks?.[0]?.accounts?.length === 1
        ) {
          resolve({
            network: filteredNetworks[0],
            account: filteredNetworks[0].accounts[0],
          });
        } else {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManageNetwork,
            params: {
              screen: ManageNetworkModalRoutes.AllNetworksNetworkSelector,
              params: {
                filter: f,
                walletId,
                accountId,
                onConfirm: (params) => {
                  if (params) {
                    resolve(params);
                  }
                },
              },
            },
          });
        }
      }),
    [
      networkAccounts,
      enabledNetworks,
      navigation,
      accountId,
      walletId,
      defaultFilter,
      network,
      account,
      networkId,
    ],
  );

  return select;
};

export const useActionForAllNetworks = ({
  networkId,
  accountId,
  filter,
  action,
}: {
  networkId: string;
  accountId: string;
  filter?: ManageNetworkRoutesParams[ManageNetworkModalRoutes.AllNetworksNetworkSelector]['filter'];
  action: (params: { network: Network; account: Account }) => unknown;
}) => {
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    networkId,
    accountId,
  });
  const { enabledNetworks } = useManageNetworks();
  const { data: networkAccountsMap } = useAllNetworksWalletAccounts({
    accountId,
  });

  const map = useMemo(() => {
    if (isAllNetworks(networkId)) {
      return networkAccountsMap;
    }
    return {
      [networkId]: [account],
    };
  }, [networkAccountsMap, networkId, account]);

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    networkId,
    accountId,
    filter,
  });

  const process = useCallback(() => {
    if (!isAllNetworks(networkId)) {
      if (network && account) {
        action({
          network,
          account,
        });
      }
      return;
    }
    selectNetworkAccount(filter).then(({ network: n, account: a }) => {
      if (n && a) {
        action({
          network: n,
          account: a,
        });
      }
    });
  }, [action, filter, selectNetworkAccount, network, account, networkId]);

  const visible = useMemo(() => {
    for (const [nid, accounts] of Object.entries(map)) {
      const n = enabledNetworks.find((i) => i.id === nid);
      if (n) {
        for (const a of accounts) {
          if (!filter || filter({ network: n, account: a })) {
            return true;
          }
        }
      }
    }
    return false;
  }, [enabledNetworks, filter, map]);

  return {
    visible,
    process,
  };
};

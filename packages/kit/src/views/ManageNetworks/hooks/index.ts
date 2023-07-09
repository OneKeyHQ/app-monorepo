import { useCallback, useEffect, useMemo, useState } from 'react';

import { uniq } from 'lodash';

import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useAccount,
  useAppSelector,
  useNavigation,
  useNetwork,
} from '../../../hooks';
import { useAllNetworksWalletAccounts } from '../../../hooks/useAllNetwoks';
import {
  getManageNetworks,
  useManageNetworks,
} from '../../../hooks/useManageNetworks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { getTimeDurationMs } from '../../../utils/helper';
import { showAllNetworksAccountDerivationsSelector } from '../../Overlay/Accounts/AllNetworksSelectAccountDerivations';
import { ManageNetworkModalRoutes } from '../types';

import type { IRpcStatus } from '../../../store/reducers/status';
import type { ManageNetworkRoutesParams } from '../types';

export const RpcSpeed = {
  Fast: {
    iconColor: 'icon-success',
    textColor: 'text-success',
    text: 'content__fast',
  },
  Slow: {
    iconColor: 'icon-warning',
    textColor: 'text-warning',
    text: 'content__slow',
  },
  Unavailable: {
    iconColor: 'icon-critical',
    textColor: 'text-critical',
    text: 'content__check_node',
  },
} as const;

export type MeasureResult = {
  responseTime?: number;
  latestBlock?: number;
  iconColor: 'icon-success' | 'icon-warning' | 'icon-critical';
  textColor: ThemeToken;
  text: 'content__fast' | 'content__slow' | 'content__check_node';
};

const getRpcStatusByResponseTime = (speed?: number) => {
  if (typeof speed === 'undefined') {
    return RpcSpeed.Unavailable;
  }
  if (speed <= 800) {
    return RpcSpeed.Fast;
  }
  return RpcSpeed.Slow;
};

export const measureRpc = async (
  networkId: string,
  url: string,
  useCache = true,
) => {
  try {
    const { responseTime, latestBlock } =
      await backgroundApiProxy.serviceNetwork.getRPCEndpointStatus(
        url,
        networkId,
        useCache,
      );

    return {
      latestBlock,
      responseTime,
      ...getRpcStatusByResponseTime(responseTime),
    };
  } catch (error) {
    // pass
  }
  return {
    latestBlock: undefined,
    responseTime: undefined,
    ...RpcSpeed.Unavailable,
  };
};

export const useRPCUrls = (networkId?: string) => {
  const [loading, setLoading] = useState(false);
  const [defaultRpc, setDefaultRpc] = useState<string>();
  const [preset, setPreset] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!networkId) {
      return;
    }
    setLoading(true);
    try {
      const { serviceNetwork } = backgroundApiProxy;
      const { urls = [], defaultRpcURL } =
        await serviceNetwork.getPresetRpcEndpoints(networkId);
      const customUrls = await serviceNetwork.getCustomRpcUrls(networkId);
      setDefaultRpc(defaultRpcURL);
      if (await serviceNetwork.networkIsPreset(networkId)) {
        setCustom(customUrls ?? []);
        setPreset(urls);
      } else {
        setCustom(uniq([...urls, ...customUrls]));
        setPreset([]);
      }
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    defaultRpc,
    preset,
    custom,
    refresh,
  };
};

export function getRpcMeasureStatus(status?: IRpcStatus) {
  const isOutofDated =
    Date.now() - (status?.updatedAt ?? 0) > getTimeDurationMs({ minute: 2 });
  if (!status || isOutofDated) {
    return {
      status: {
        latestBlock: undefined,
        responseTime: undefined,
        ...RpcSpeed.Unavailable,
      },
      loading: true,
    };
  }
  return {
    status: {
      ...status,
      ...getRpcStatusByResponseTime(status.responseTime),
    },
    loading: !status,
  };
}

export const useRpcMeasureStatus = (networkId?: string) => {
  const activeNetworkId = useAppSelector((s) => s.general.activeNetworkId);
  const status = useAppSelector(
    (s) => s.status.rpcStatus?.[networkId ?? activeNetworkId ?? ''],
  );
  return useMemo(() => getRpcMeasureStatus(status), [status]);
};

export const allNetworksSelectAccount = ({
  networkId,
  accounts,
}: {
  networkId: string;
  accounts: Account[];
}): Promise<{ network: Network; account: Account } | undefined> => {
  const { allNetworks } = getManageNetworks();

  const network = allNetworks.find((n) => n.id === networkId);
  return new Promise((resolve) => {
    if (!network) {
      return resolve(undefined);
    }
    if (!accounts.length) {
      return resolve(undefined);
    }
    if (accounts.length === 1) {
      return resolve({
        network,
        account: accounts[0],
      });
    }
    showAllNetworksAccountDerivationsSelector({
      network,
      accounts,
      onConfirm: (a) => {
        resolve({
          network,
          account: a,
        });
      },
    });
  });
};

export const useAllNetworksSelectNetworkAccount = ({
  walletId,
  accountId,
  networkId,
  filter: defaultFilter = () => true,
}: {
  walletId: string;
  accountId: string;
  networkId: string;
  filter?: ManageNetworkRoutesParams[ManageNetworkModalRoutes.AllNetworksNetworkSelector]['filter'];
}) => {
  const { allNetworks } = useManageNetworks();
  const { network } = useNetwork({ networkId });
  const { account } = useAccount({
    networkId,
    accountId,
  });
  const networkAccounts = useAllNetworksWalletAccounts({
    accountId,
    walletId,
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
        const filteredNetworks = allNetworks
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
      allNetworks,
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

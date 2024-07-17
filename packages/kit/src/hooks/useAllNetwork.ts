import { useEffect, useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  IMPL_ALLNETWORKS,
  getEnabledNFTNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { buildAllNetworkId } from '@onekeyhq/shared/src/utils/allnetworkUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

const enableNFTNetworkIds = getEnabledNFTNetworkIds();

function useAllNetworkRequests<T>(params: {
  account: INetworkAccount | undefined;
  network: IServerNetwork | undefined;
  wallet: IDBWallet | undefined;
  allNetworkRequests: ({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) => Promise<T | undefined>;
  clearAllNetworkData: () => void;
  abortAllNetworkRequests?: () => void;
  isNFTRequests?: boolean;
  disabled?: boolean;
  interval?: number;
}) {
  const {
    account,
    network,
    wallet,
    allNetworkRequests,
    abortAllNetworkRequests,
    clearAllNetworkData,
    isNFTRequests,
    disabled,
    interval = 0,
  } = params;
  const allNetworkId = useRef('');
  const allNetworkDataInit = useRef(false);
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);

  const { run, result } = usePromiseResult(async () => {
    if (disabled) return;
    if (!account || !network || !wallet) return;
    if (account.impl !== IMPL_ALLNETWORKS) return;

    if (!allNetworkDataInit.current) {
      clearAllNetworkData();
    }

    abortAllNetworkRequests?.();

    let resp: Array<T> | null = null;

    const allAccounts = (
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: account.indexedAccountId ?? '',
        },
      )
    ).filter((a) => a.impl !== IMPL_ALLNETWORKS);

    if (!allAccounts || isEmpty(allAccounts)) {
      setIsEmptyAccount(true);
      return;
    }

    const currentAllNetworkId = buildAllNetworkId({
      accountId: account.id,
      networkId: network.id,
      walletId: wallet.id,
    });

    // const requests: Array<() => Promise<T | undefined>> = [];
    const paramsGroup: {
      accountId: string;
      networkId: string;
      backendIndex?: boolean;
    }[] = [];

    const concurrentNetworks = new Set<string>();
    const sequentialNetworks = new Set<string>();

    for (const a of allAccounts) {
      if (currentAllNetworkId !== allNetworkId.current) return;
      const networks = (
        await backgroundApiProxy.serviceNetwork.getNetworksByImpls({
          impls: [a.impl],
        })
      ).networks.filter((i) => !i.isTestnet);

      for (const n of networks) {
        if (currentAllNetworkId !== allNetworkId.current) return;

        if (!isNFTRequests || enableNFTNetworkIds.includes(n.id)) {
          const networkData = { accountId: a.id, networkId: n.id };
          if (allNetworkDataInit.current) {
            if (n.backendIndex) {
              concurrentNetworks.add(JSON.stringify(networkData));
            } else {
              sequentialNetworks.add(JSON.stringify(networkData));
            }
          } else {
            paramsGroup.push({ ...networkData, backendIndex: n.backendIndex });
          }
        }
      }
    }

    if (
      concurrentNetworks.size === 0 &&
      sequentialNetworks.size === 0 &&
      isEmpty(paramsGroup)
    ) {
      setIsEmptyAccount(true);
      return;
    }

    setIsEmptyAccount(false);

    if (allNetworkDataInit.current) {
      // 处理并发请求的网络
      const concurrentRequests = Array.from(concurrentNetworks).map(
        (networkDataString) => {
          const { accountId, networkId } = JSON.parse(networkDataString);
          console.log('concurrentRequests: =====>>>>>: ', accountId, networkId);
          return allNetworkRequests({ accountId, networkId });
        },
      );
      const concurrentResp = await Promise.all(concurrentRequests);

      // 处理顺序请求的网络
      const sequentialResp = [];
      for (const networkDataString of sequentialNetworks) {
        if (currentAllNetworkId !== allNetworkId.current) return;
        const { accountId, networkId } = JSON.parse(networkDataString);
        const r = await allNetworkRequests({ accountId, networkId });
        sequentialResp.push(r);
        await waitAsync(interval);
      }
      resp = [...concurrentResp, ...sequentialResp].filter(Boolean);
    } else {
      // 直接根据 backendIndex 分组
      const concurrentParams = paramsGroup.filter((p) => p.backendIndex);
      const sequentialParams = paramsGroup.filter((p) => !p.backendIndex);

      // 处理并发请求
      await Promise.all(
        concurrentParams.map((p) =>
          allNetworkRequests({
            accountId: p.accountId,
            networkId: p.networkId,
          }),
        ),
      );

      // 处理顺序请求
      for (const p of sequentialParams) {
        if (currentAllNetworkId !== allNetworkId.current) return;
        await Promise.race([
          await allNetworkRequests({
            accountId: p.accountId,
            networkId: p.networkId,
          }),
          await waitAsync(interval),
        ]);
      }
    }

    allNetworkDataInit.current = true;

    return resp;
  }, [
    disabled,
    account,
    network,
    wallet,
    abortAllNetworkRequests,
    clearAllNetworkData,
    isNFTRequests,
    allNetworkRequests,
    interval,
  ]);

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      allNetworkId.current = buildAllNetworkId({
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
      });
    }
  }, [account?.id, network?.id, wallet?.id]);

  return {
    run,
    result,
    isEmptyAccount,
    allNetworkDataInit,
  };
}

export { useAllNetworkRequests };

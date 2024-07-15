import { useEffect, useRef } from 'react';

import { isEmpty } from 'lodash';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { IMPL_ALLNETWORKS } from '@onekeyhq/shared/src/engine/engineConsts';
import { buildAllNetworkId } from '@onekeyhq/shared/src/utils/allnetworkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';

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
  }) => Promise<T>;
  abortAllNetworkRequests?: () => void;
}) {
  const {
    account,
    network,
    wallet,
    allNetworkRequests,
    abortAllNetworkRequests,
  } = params;
  const allNetworkId = useRef('');
  const allNetworkInit = useRef(false);

  const { run, result } = usePromiseResult(async () => {
    if (!account || !network || !wallet) return;
    if (account.impl !== IMPL_ALLNETWORKS) return;

    abortAllNetworkRequests?.();

    let resp: T[] | null = null;

    const allAccounts = (
      await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
        {
          indexedAccountId: account.indexedAccountId ?? '',
        },
      )
    ).filter((a) => a.impl !== IMPL_ALLNETWORKS);

    if (!allAccounts || isEmpty(allAccounts)) {
      return;
    }

    const currentAllNetworkId = buildAllNetworkId({
      accountId: account.id,
      networkId: network.id,
      walletId: wallet.id,
    });

    const requests: Array<() => Promise<T>> = [];
    const paramsGroup: {
      accountId: string;
      networkId: string;
    }[] = [];

    for (const a of allAccounts) {
      if (currentAllNetworkId !== allNetworkId.current) break;
      const networks =
        await backgroundApiProxy.serviceNetwork.getNetworkIdsByImpls({
          impls: [a.impl],
        });

      for (const networkId of networks.networkIds) {
        if (allNetworkInit.current) {
          requests.push(() =>
            allNetworkRequests({ accountId: a.id, networkId }),
          );
        } else {
          paramsGroup.push({ accountId: a.id, networkId });
        }
      }
    }

    if (allNetworkInit.current) {
      resp = await Promise.all(requests.map((r) => r()));
    } else {
      for (const p of paramsGroup) {
        void allNetworkRequests({
          accountId: p.accountId,
          networkId: p.networkId,
        });
        await waitAsync(0);
      }
      allNetworkInit.current = true;
    }

    return resp;
  }, [abortAllNetworkRequests, account, allNetworkRequests, network, wallet]);

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
    allNetworkInit,
  };
}

export { useAllNetworkRequests };

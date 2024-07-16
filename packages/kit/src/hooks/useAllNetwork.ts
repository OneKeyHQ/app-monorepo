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
}) {
  const {
    account,
    network,
    wallet,
    allNetworkRequests,
    abortAllNetworkRequests,
    clearAllNetworkData,
    isNFTRequests,
  } = params;
  const allNetworkId = useRef('');
  const allNetworkDataInit = useRef(false);
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);

  const { run, result } = usePromiseResult(async () => {
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

    const requests: Array<() => Promise<T | undefined>> = [];
    const paramsGroup: {
      accountId: string;
      networkId: string;
    }[] = [];

    for (const a of allAccounts) {
      if (currentAllNetworkId !== allNetworkId.current) return;
      const networks =
        await backgroundApiProxy.serviceNetwork.getNetworkIdsByImpls({
          impls: [a.impl],
        });

      for (const networkId of networks.networkIds) {
        if (currentAllNetworkId !== allNetworkId.current) return;

        if (!isNFTRequests || enableNFTNetworkIds.includes(networkId)) {
          if (allNetworkDataInit.current) {
            requests.push(() =>
              allNetworkRequests({ accountId: a.id, networkId }),
            );
          } else {
            paramsGroup.push({ accountId: a.id, networkId });
          }
        }
      }
    }

    if (isEmpty(requests) && isEmpty(paramsGroup)) {
      setIsEmptyAccount(true);
      return;
    }

    setIsEmptyAccount(false);

    if (allNetworkDataInit.current) {
      resp = (await Promise.all(requests.map((r) => r()))).filter(Boolean);
    } else {
      for (const p of paramsGroup) {
        if (currentAllNetworkId !== allNetworkId.current) return;
        void allNetworkRequests({
          accountId: p.accountId,
          networkId: p.networkId,
        });
        await waitAsync(0);
      }
    }

    allNetworkDataInit.current = true;

    return resp;
  }, [
    account,
    network,
    wallet,
    abortAllNetworkRequests,
    clearAllNetworkData,
    isNFTRequests,
    allNetworkRequests,
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

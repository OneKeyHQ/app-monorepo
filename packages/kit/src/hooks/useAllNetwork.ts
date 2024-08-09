import { useEffect, useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

// useRef not working as expected, so use a global object
const currentRequestsUUID = { current: '' };

// const reorderByPinnedNetworkIds = async (items: IAllNetworkAccountInfo[]) => {
//   const priorityNetworkIds =
//     await backgroundApiProxy.serviceNetwork.getNetworkSelectorPinnedNetworkIds();

//   const priorityNetworkIdsMap = priorityNetworkIds.reduce(
//     (acc, item, index) => {
//       acc[item] = index;
//       return acc;
//     },
//     {} as Record<string, number>,
//   );

//   const priorityItems: IAllNetworkAccountInfo[] = [];
//   const normalItems: IAllNetworkAccountInfo[] = [];
//   for (let i = 0; i < items.length; i += 1) {
//     if (priorityNetworkIdsMap[items[i].networkId] !== undefined) {
//       priorityItems.push(items[i]);
//     } else {
//       normalItems.push(items[i]);
//     }
//   }
//   priorityItems.sort(
//     (a, b) =>
//       priorityNetworkIdsMap[a.networkId] - priorityNetworkIdsMap[b.networkId],
//   );
//   return [...priorityItems, ...normalItems];
// };

function useAllNetworkRequests<T>(params: {
  account: INetworkAccount | undefined;
  network: IServerNetwork | undefined;
  wallet: IDBWallet | undefined;
  allNetworkRequests: ({
    accountId,
    networkId,
    allNetworkDataInit,
  }: {
    accountId: string;
    networkId: string;
    allNetworkDataInit?: boolean;
  }) => Promise<T | undefined>;
  clearAllNetworkData: () => void;
  abortAllNetworkRequests?: () => void;
  isNFTRequests?: boolean;
  disabled?: boolean;
  interval?: number;
  shouldAlwaysFetch?: boolean;
  onStarted?: ({
    accountId,
    networkId,
  }: {
    accountId?: string;
    networkId?: string;
  }) => void;
  onFinished?: ({
    accountId,
    networkId,
  }: {
    accountId?: string;
    networkId?: string;
  }) => void;
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
    shouldAlwaysFetch,
    onStarted,
    onFinished,
  } = params;
  const allNetworkDataInit = useRef(false);
  const isFetching = useRef(false);
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);

  const { run, result } = usePromiseResult(
    async () => {
      const requestsUUID = generateUUID();

      if (disabled) return;
      if (isFetching.current) return;
      if (!account || !network || !wallet) return;
      if (!network.isAllNetworks) return;
      isFetching.current = true;

      if (!allNetworkDataInit.current) {
        clearAllNetworkData();
      }

      abortAllNetworkRequests?.();

      const {
        accountsInfo,
        // accountsInfoBackendIndexed,
        // accountsInfoBackendNotIndexed,
      } = await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: account.id,
        networkId: network.id,
        deriveType: undefined,
        nftEnabledOnly: isNFTRequests,
      });

      if (!accountsInfo || isEmpty(accountsInfo)) {
        setIsEmptyAccount(true);
        isFetching.current = false;
        return;
      }

      // const concurrentNetworks = accountsInfoBackendIndexed;

      // const sequentialNetworks = await reorderByPinnedNetworkIds(
      //   accountsInfoBackendNotIndexed,
      // );

      let resp: Array<T> | null = [];

      // if (concurrentNetworks.length === 0 && sequentialNetworks.length === 0) {
      if (accountsInfo.length === 0) {
        setIsEmptyAccount(true);
        isFetching.current = false;
        return;
      }

      setIsEmptyAccount(false);

      onStarted?.({
        accountId: account.id,
        networkId: network.id,
      });

      currentRequestsUUID.current = requestsUUID;
      console.log(
        'currentRequestsUUID set: =====>>>>>: ',
        currentRequestsUUID.current,
      );

      if (allNetworkDataInit.current) {
        const allNetworks = accountsInfo;

        const requests = allNetworks.map((networkDataString) => {
          const { accountId, networkId } = networkDataString;
          return allNetworkRequests({
            accountId,
            networkId,
            allNetworkDataInit: allNetworkDataInit.current,
          });
        });

        try {
          resp = (await Promise.all(requests)).filter(Boolean);
        } catch (e) {
          console.error(e);
          resp = null;
          abortAllNetworkRequests?.();
        }
      } else {
        // 处理并发请求的网络
        const concurrentRequests = Array.from(accountsInfo).map(
          (networkDataString) => {
            const { accountId, networkId, apiAddress } = networkDataString;
            console.log(
              'concurrentRequests: =====>>>>>: ',
              accountId,
              networkId,
              apiAddress,
            );
            return allNetworkRequests({
              accountId,
              networkId,
              allNetworkDataInit: allNetworkDataInit.current,
            });
          },
        );
        try {
          await Promise.all(concurrentRequests);
        } catch (e) {
          console.error(e);
          // pass
        }

        // // 处理顺序请求的网络
        // await (async (uuid: string) => {
          // for (const networkDataString of sequentialNetworks) {
          //   console.log(
          //     'currentRequestsUUID for: =====>>>>>: ',
          //     currentRequestsUUID.current,
          //     uuid,
          //     networkDataString.networkId,
          //     networkDataString.apiAddress,
          //   );
          //   if (
          //     currentRequestsUUID.current &&
          //     currentRequestsUUID.current !== uuid
          //   ) {
          //     break;
          //   }
          //   const { accountId, networkId } = networkDataString;
          //   try {
          //     await allNetworkRequests({
          //       accountId,
          //       networkId,
          //       allNetworkDataInit: allNetworkDataInit.current,
          //     });
          //   } catch (e) {
          //     console.error(e);
          //     // pass
          //   }
          //   await waitAsync(interval);
          // }
        // })(requestsUUID);
      }

      allNetworkDataInit.current = true;
      isFetching.current = false;
      onFinished?.({
        accountId: account.id,
        networkId: network.id,
      });

      return resp;
    },
    [
      disabled,
      account,
      network,
      wallet,
      abortAllNetworkRequests,
      isNFTRequests,
      onStarted,
      onFinished,
      clearAllNetworkData,
      allNetworkRequests,
      interval,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused || !!shouldAlwaysFetch,
    },
  );

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      allNetworkDataInit.current = false;
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

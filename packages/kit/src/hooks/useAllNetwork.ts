import { useEffect, useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ICustomTokenDBStruct } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityCustomTokens';
import type { ISimpleDBLocalTokens } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { perfTokenListView } from '../components/TokenListView/perfTokenListView';

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
  accountId: string | undefined;
  networkId: string | undefined;
  walletId: string | undefined;
  isAllNetworks: boolean | undefined;
  allNetworkRequests: ({
    accountId,
    networkId,
    dbAccount,
    allNetworkDataInit,
    customTokensRawData,
  }: {
    accountId: string;
    networkId: string;
    dbAccount?: IDBAccount;
    allNetworkDataInit?: boolean;
    customTokensRawData: ICustomTokenDBStruct | undefined;
  }) => Promise<T | undefined>;
  allNetworkCacheRequests?: ({
    dbAccount,
    accountId,
    networkId,
    accountAddress,
    xpub,
    simpleDbLocalTokensRawData,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
    simpleDbLocalTokensRawData?: ISimpleDBLocalTokens;
  }) => Promise<any>;
  allNetworkCacheData?: ({
    data,
    accountId,
    networkId,
  }: {
    data: any;
    accountId: string;
    networkId: string;
  }) => void;
  allNetworkAccountsData?: ({
    accounts,
    allAccounts,
  }: {
    accounts: IAllNetworkAccountInfo[];
    allAccounts: IAllNetworkAccountInfo[];
  }) => void;
  clearAllNetworkData: () => void;
  abortAllNetworkRequests?: () => void;
  isNFTRequests?: boolean;
  disabled?: boolean;
  interval?: number;
  shouldAlwaysFetch?: boolean;
  onStarted?: ({
    accountId,
    networkId,
    allNetworkDataInit,
  }: {
    accountId?: string;
    networkId?: string;
    allNetworkDataInit?: boolean;
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
    accountId: currentAccountId,
    networkId: currentNetworkId,
    walletId: currentWalletId,
    isAllNetworks,
    allNetworkRequests,
    allNetworkCacheRequests,
    allNetworkCacheData,
    allNetworkAccountsData,
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

  useEffect(() => {
    if (currentAccountId && currentNetworkId && currentWalletId) {
      perfTokenListView.markStart('useAllNetworkRequestsRun_debounceDelay');
    }
  }, [currentAccountId, currentNetworkId, currentWalletId]);

  const { run, result } = usePromiseResult(
    async () => {
      perfTokenListView.markEnd(
        'useAllNetworkRequestsRun_debounceDelay',
        '执行 useAllNetworkRequests 的 usePromiseResult debounced 延迟: POLLING_DEBOUNCE_INTERVAL',
      );

      const perf = perfUtils.createPerf({
        name: EPerformanceTimerLogNames.allNetwork__useAllNetworkRequests,
      });

      perfTokenListView.markStart('useAllNetworkRequestsRun');

      console.log('useAllNetworkRequestsRun >>>>>>>>>>>>>>');
      const requestsUUID = generateUUID();

      if (disabled) return;
      if (isFetching.current) return;
      if (!currentAccountId || !currentNetworkId || !currentWalletId) return;
      if (!isAllNetworks) return;
      isFetching.current = true;

      if (!allNetworkDataInit.current) {
        clearAllNetworkData();
      }

      abortAllNetworkRequests?.();

      perf.markStart('getAllNetworkAccountsWithEnabledNetworks');
      const {
        accountsInfo,
        accountsInfoBackendIndexed,
        accountsInfoBackendNotIndexed,
        allAccountsInfo,
      } =
        await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccountsWithEnabledNetworks(
          {
            accountId: currentAccountId,
            networkId: currentNetworkId,
            deriveType: undefined,
            nftEnabledOnly: isNFTRequests,
          },
        );
      perf.markEnd('getAllNetworkAccountsWithEnabledNetworks');

      allNetworkAccountsData?.({
        accounts: accountsInfo,
        allAccounts: allAccountsInfo,
      });

      if (!accountsInfo || isEmpty(accountsInfo)) {
        setIsEmptyAccount(true);
        isFetching.current = false;
      }

      let resp: Array<T> | null = null;

      // if (concurrentNetworks.length === 0 && sequentialNetworks.length === 0) {
      if (accountsInfo.length === 0) {
        setIsEmptyAccount(true);
        isFetching.current = false;
      }

      setIsEmptyAccount(false);

      onStarted?.({
        accountId: currentAccountId,
        networkId: currentNetworkId,
      });

      if (!allNetworkDataInit.current) {
        try {
          perf.markStart('localTokens_getRawData');
          const simpleDbLocalTokensRawData =
            (await backgroundApiProxy.simpleDb.localTokens.getRawData()) ??
            undefined;
          perf.markEnd('localTokens_getRawData');

          perf.markStart('allNetworkCacheRequests', {
            localTokensExists: Boolean(simpleDbLocalTokensRawData),
          });

          const cachedData = (
            await Promise.all(
              Array.from(accountsInfo).map(
                async (networkDataString: IAllNetworkAccountInfo) => {
                  const {
                    accountId,
                    networkId,
                    accountXpub,
                    apiAddress,
                    dbAccount,
                  } = networkDataString;
                  const cachedDataResult = await allNetworkCacheRequests?.({
                    dbAccount,
                    accountId,
                    networkId,
                    xpub: accountXpub,
                    accountAddress: apiAddress,
                    simpleDbLocalTokensRawData,
                  });
                  return cachedDataResult as unknown;
                },
              ),
            )
          ).filter(Boolean);
          perf.markEnd('allNetworkCacheRequests');

          if (cachedData && !isEmpty(cachedData)) {
            allNetworkDataInit.current = true;
            perf.done();
            perfTokenListView.markEnd(
              'useAllNetworkRequestsRun',
              '执行时间明细请查看 EPerformanceTimerLogNames.allNetwork__useAllNetworkRequests',
            );
            allNetworkCacheData?.({
              data: cachedData,
              accountId: currentAccountId,
              networkId: currentNetworkId,
            });
          }
        } catch (e) {
          console.error(e);
          // pass
        }
      }

      currentRequestsUUID.current = requestsUUID;
      console.log(
        'currentRequestsUUID set: =====>>>>>: ',
        currentRequestsUUID.current,
      );
      const customTokensRawData =
        (await backgroundApiProxy.simpleDb.customTokens.getRawData()) ??
        undefined;

      if (allNetworkDataInit.current) {
        const allNetworks = accountsInfo;
        const requests = allNetworks.map((networkDataString) => {
          const { accountId, networkId, dbAccount } = networkDataString;
          return allNetworkRequests({
            customTokensRawData,
            accountId,
            networkId,
            dbAccount,
            allNetworkDataInit: allNetworkDataInit.current,
          });
        });

        try {
          resp = (
            await promiseAllSettledEnhanced(requests, {
              continueOnError: true,
            })
          ).filter(Boolean);
        } catch (e) {
          console.error(e);
          resp = null;
          abortAllNetworkRequests?.();
        }
      } else {
        try {
          const promises = Array.from(accountsInfoBackendIndexed).map(
            (networkDataString) => {
              const { accountId, networkId, apiAddress } = networkDataString;
              console.log(
                'accountsBackedIndexedRequests: =====>>>>>: ',
                accountId,
                networkId,
                apiAddress,
              );
              return allNetworkRequests({
                accountId,
                networkId,
                allNetworkDataInit: allNetworkDataInit.current,
                customTokensRawData,
              });
            },
          );
          await promiseAllSettledEnhanced(promises, {
            continueOnError: true,
          });
        } catch (e) {
          console.error(e);
          // pass
        }

        try {
          const promises = Array.from(accountsInfoBackendNotIndexed).map(
            (networkDataString) => {
              const { accountId, networkId, apiAddress } = networkDataString;
              console.log(
                'accountsBackedNotIndexedRequests: =====>>>>>: ',
                accountId,
                networkId,
                apiAddress,
              );
              return allNetworkRequests({
                accountId,
                networkId,
                allNetworkDataInit: allNetworkDataInit.current,
                customTokensRawData,
              });
            },
          );
          await promiseAllSettledEnhanced(promises, {
            continueOnError: true,
          });
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
        accountId: currentAccountId,
        networkId: currentNetworkId,
      });

      return resp;
    },
    [
      disabled,
      currentAccountId,
      currentNetworkId,
      currentWalletId,
      isAllNetworks,
      abortAllNetworkRequests,
      isNFTRequests,
      allNetworkAccountsData,
      onStarted,
      onFinished,
      clearAllNetworkData,
      allNetworkCacheRequests,
      allNetworkCacheData,
      allNetworkRequests,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      // debounced: 0,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused || !!shouldAlwaysFetch,
    },
  );

  useEffect(() => {
    if (currentAccountId && currentNetworkId && currentWalletId) {
      allNetworkDataInit.current = false;
    }
  }, [currentAccountId, currentNetworkId, currentWalletId]);

  return {
    run,
    result,
    isEmptyAccount,
    allNetworkDataInit,
  };
}

export { useAllNetworkRequests };

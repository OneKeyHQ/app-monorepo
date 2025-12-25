import { useEffect, useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

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
  }: {
    accountId: string;
    networkId: string;
    dbAccount?: IDBAccount;
    allNetworkDataInit?: boolean;
  }) => Promise<T | undefined>;
  allNetworkCacheRequests?: ({
    dbAccount,
    accountId,
    networkId,
    accountAddress,
    xpub,
  }: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
    accountAddress: string;
    xpub?: string;
  }) => Promise<any>;
  allNetworkCacheData?: ({
    data,
    accountId,
    networkId,
  }: {
    data: any;
    accountId: string;
    networkId: string;
  }) => Promise<void>;
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
  isDeFiRequests?: boolean;
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
  }) => Promise<void>;
  onFinished?: ({
    accountId,
    networkId,
  }: {
    accountId?: string;
    networkId?: string;
  }) => Promise<void>;
  revalidateOnFocus?: boolean;
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
    isDeFiRequests,
    disabled,
    shouldAlwaysFetch,
    onStarted,
    onFinished,
    revalidateOnFocus = false,
  } = params;
  const allNetworkDataInit = useRef(false);
  const isFetching = useRef(false);
  const [isEmptyAccount, setIsEmptyAccount] = useState(false);
  const [isLocked] = useAppIsLockedAtom();

  useEffect(() => {
    if (currentAccountId && currentNetworkId && currentWalletId) {
      allNetworkDataInit.current = false;
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
      } = await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: currentAccountId,
        networkId: currentNetworkId,
        deriveType: undefined,
        nftEnabledOnly: isNFTRequests,
        DeFiEnabledOnly: isDeFiRequests,
        // disable test network in all networks
        excludeTestNetwork: true,
        // For single network accounts, display all available network data without filtering
        networksEnabledOnly: !accountUtils.isOthersAccount({
          accountId: currentAccountId,
        }),
      });
      perf.markEnd('getAllNetworkAccountsWithEnabledNetworks');

      setIsEmptyAccount(false);

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

      await onStarted?.({
        accountId: currentAccountId,
        networkId: currentNetworkId,
      });

      if (!allNetworkDataInit.current) {
        try {
          perf.markStart('allNetworkCacheRequests');
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
            await allNetworkCacheData?.({
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
      // console.log(
      //   'currentRequestsUUID set: =====>>>>>: ',
      //   currentRequestsUUID.current,
      // );
      if (allNetworkDataInit.current) {
        const allNetworks = accountsInfo;
        const requests = allNetworks.map((networkDataString) => {
          const { accountId, networkId, dbAccount } = networkDataString;
          return allNetworkRequests({
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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { accountId, networkId, apiAddress } = networkDataString;
              return allNetworkRequests({
                accountId,
                networkId,
                allNetworkDataInit: allNetworkDataInit.current,
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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { accountId, networkId, apiAddress } = networkDataString;
              return allNetworkRequests({
                accountId,
                networkId,
                allNetworkDataInit: allNetworkDataInit.current,
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
      if (accountsInfo.length && accountsInfo.length > 0) {
        allNetworkDataInit.current = true;
      }
      isFetching.current = false;
      await onFinished?.({
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
      isDeFiRequests,
      allNetworkAccountsData,
      onStarted,
      onFinished,
      clearAllNetworkData,
      allNetworkCacheRequests,
      allNetworkCacheData,
      allNetworkRequests,
    ],
    {
      revalidateOnFocus,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      // debounced: 0,
      overrideIsFocused: (isPageFocused) =>
        (isPageFocused || !!shouldAlwaysFetch) && !isLocked,
    },
  );

  return {
    run,
    result,
    isEmptyAccount,
    allNetworkDataInit,
  };
}

function useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
  walletId,
  networkId,
  filterNetworksWithoutAccount,
  indexedAccountId,
  withNetworksInfo = false,
}: {
  walletId: string;
  networkId?: string;
  filterNetworksWithoutAccount?: boolean;
  indexedAccountId?: string;
  withNetworksInfo?: boolean;
}) {
  const { result, run } = usePromiseResult(
    async () => {
      const networkInfoMap: Record<
        string,
        { deriveType: IAccountDeriveTypes; mergeDeriveAssetsEnabled: boolean }
      > = {};
      if (networkId && !networkUtils.isAllNetwork({ networkId })) {
        return {
          networkInfoMap,
          compatibleNetworks: [],
          compatibleNetworksWithoutAccount: [],
        };
      }

      const { enabledNetworks, disabledNetworks } =
        await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getAllNetworks({
          excludeTestNetwork: true,
          excludeAllNetworkItem: true,
        });
      const enabledNetworkIds = networks
        .filter((n) =>
          isEnabledNetworksInAllNetworks({
            networkId: n.id,
            disabledNetworks,
            enabledNetworks,
            isTestnet: n.isTestnet,
          }),
        )
        .map((n) => n.id);

      const compatibleNetworks =
        await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          {
            walletId,
            networkIds: enabledNetworkIds,
          },
        );

      const compatibleNetworksWithoutAccount: IServerNetwork[] = [];

      const mainnetItems = compatibleNetworks.mainnetItems;

      if (withNetworksInfo) {
        for (const network of mainnetItems) {
          const [globalDeriveType, vaultSettings] = await Promise.all([
            backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
              networkId: network.id,
            }),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: network.id,
            }),
          ]);
          networkInfoMap[network.id] = {
            deriveType: globalDeriveType,
            mergeDeriveAssetsEnabled: !!vaultSettings.mergeDeriveAssetsEnabled,
          };
        }
      }

      if (filterNetworksWithoutAccount && indexedAccountId) {
        const networksByImpl = compatibleNetworks.mainnetItems.reduce(
          (acc, network) => {
            if (!acc[network.impl]) {
              acc[network.impl] = [];
            }
            acc[network.impl].push(network);
            return acc;
          },
          {} as Record<string, IServerNetwork[]>,
        );

        const { accounts: allDbAccounts } =
          await backgroundApiProxy.serviceAccount.getAllAccounts();

        // Process networks by implementation group
        for (const [_, networksInGroup] of Object.entries(networksByImpl)) {
          const firstNetwork = networksInGroup[0];

          const [{ networkAccounts }, vaultSettings] = await Promise.all([
            backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
              {
                allDbAccounts,
                skipDbQueryIfNotFoundFromAllDbAccounts: true,
                indexedAccountId,
                networkId: firstNetwork.id,
                excludeEmptyAccount: true,
              },
            ),
            backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: firstNetwork.id,
            }),
          ]);

          if (vaultSettings.mergeDeriveAssetsEnabled) {
            if (!networkAccounts || networkAccounts.length === 0) {
              compatibleNetworksWithoutAccount.push(...networksInGroup);
            }
          } else {
            const currentDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: firstNetwork.id,
                },
              );

            if (!networkAccounts || networkAccounts.length === 0) {
              compatibleNetworksWithoutAccount.push(...networksInGroup);
            } else if (
              !networkAccounts.some(
                (account) => account.deriveType === currentDeriveType,
              )
            ) {
              compatibleNetworksWithoutAccount.push(...networksInGroup);
            }
          }
        }
      }

      return {
        networkInfoMap,
        compatibleNetworks: mainnetItems,
        compatibleNetworksWithoutAccount,
      };
    },
    [
      walletId,
      networkId,
      filterNetworksWithoutAccount,
      indexedAccountId,
      withNetworksInfo,
    ],
    {
      initResult: {
        networkInfoMap: {},
        compatibleNetworks: [],
        compatibleNetworksWithoutAccount: [],
      },
    },
  );

  const enabledNetworksCompatibleWithWalletId =
    result?.compatibleNetworks ?? [];
  const enabledNetworksWithoutAccount =
    result?.compatibleNetworksWithoutAccount ?? [];

  return {
    networkInfoMap: result?.networkInfoMap ?? {},
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    run,
  };
}

export {
  useAllNetworkRequests,
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks,
};

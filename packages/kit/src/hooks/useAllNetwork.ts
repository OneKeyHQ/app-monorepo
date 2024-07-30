import { useRef, useState } from 'react';

import { isEmpty } from 'lodash';

import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { POLLING_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import { getEnabledNFTNetworkIds } from '@onekeyhq/shared/src/engine/engineConsts';
import { waitAsync } from '@onekeyhq/shared/src/utils/promiseUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

const enableNFTNetworkIds = getEnabledNFTNetworkIds();

function useAllNetworkRequests<T>(params: {
  allNetworkDbAccounts?: IDBAccount[] | undefined;
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
  onStarted?: () => void;
  onFinished?: () => void;
}) {
  const {
    allNetworkDbAccounts,
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
      if (disabled) return;
      if (isFetching.current) return;
      if (!allNetworkDbAccounts?.length || !network || !wallet) return;
      if (!network.isAllNetworks) return;
      isFetching.current = true;

      if (!allNetworkDataInit.current) {
        clearAllNetworkData();
      }

      abortAllNetworkRequests?.();

      const allAccounts = allNetworkDbAccounts;

      if (!allAccounts || isEmpty(allAccounts)) {
        setIsEmptyAccount(true);
        isFetching.current = false;
        return;
      }

      const concurrentNetworks = new Set<string>();
      const sequentialNetworks = new Set<string>();
      let resp: Array<T> = [];

      for (const a of allAccounts) {
        const networks = (
          await backgroundApiProxy.serviceNetwork.getNetworksByImpls({
            impls: [a.impl],
          })
        ).networks.filter((i) => !i.isTestnet);

        for (const n of networks) {
          if (!isNFTRequests || enableNFTNetworkIds.includes(n.id)) {
            const networkData = { accountId: a.id, networkId: n.id };
            if (n.backendIndex) {
              concurrentNetworks.add(JSON.stringify(networkData));
            } else {
              sequentialNetworks.add(JSON.stringify(networkData));
            }
          }
        }
      }

      if (concurrentNetworks.size === 0 && sequentialNetworks.size === 0) {
        setIsEmptyAccount(true);
        isFetching.current = false;
        return;
      }

      setIsEmptyAccount(false);

      onStarted?.();

      if (allNetworkDataInit.current) {
        const allNetworks = [
          ...Array.from(sequentialNetworks),
          ...Array.from(concurrentNetworks),
        ];

        const requests = allNetworks.map((networkDataString) => {
          const { accountId, networkId } = JSON.parse(networkDataString);
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
          // pass
        }
      } else {
        // 处理并发请求的网络
        const concurrentRequests = Array.from(concurrentNetworks).map(
          (networkDataString) => {
            const { accountId, networkId } = JSON.parse(networkDataString);
            console.log(
              'concurrentRequests: =====>>>>>: ',
              accountId,
              networkId,
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

        // 处理顺序请求的网络
        for (const networkDataString of sequentialNetworks) {
          const { accountId, networkId } = JSON.parse(networkDataString);
          try {
            await allNetworkRequests({ accountId, networkId });
          } catch (e) {
            console.error(e);
            // pass
          }
          await waitAsync(interval);
        }
      }

      allNetworkDataInit.current = true;
      isFetching.current = false;
      onFinished?.();

      return resp;
    },
    [
      disabled,
      allNetworkDbAccounts,
      network,
      wallet,
      abortAllNetworkRequests,
      onStarted,
      onFinished,
      clearAllNetworkData,
      isNFTRequests,
      allNetworkRequests,
      interval,
    ],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      overrideIsFocused: (isPageFocused) =>
        isPageFocused || !!shouldAlwaysFetch,
    },
  );

  return {
    run,
    result,
    isEmptyAccount,
    allNetworkDataInit,
  };
}

export { useAllNetworkRequests };

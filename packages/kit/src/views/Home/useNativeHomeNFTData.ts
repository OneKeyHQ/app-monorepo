import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { uniqBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { POLLING_INTERVAL_FOR_NFT } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  type IEventBusPayloadAccountDataUpdate,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IAccountNFT,
  IFetchAccountNFTsResp,
} from '@onekeyhq/shared/types/nft';

import { useAllNetworkRequests } from '../../hooks/useAllNetwork';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';

export interface INativeHomeNFTData {
  data: IAccountNFT[];
  errorCode: string | undefined;
  initialized: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const getNFTKey = (nft: IAccountNFT) =>
  `${nft.networkId ?? ''}:${nft.collectionAddress}:${nft.itemId}`;

export function useNativeHomeNFTData({
  enabled,
  visible,
}: {
  enabled: boolean;
  visible: boolean;
}): INativeHomeNFTData {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const [data, setData] = useState<IAccountNFT[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const requestIdRef = useRef(0);
  const allNetworkGenerationRef = useRef(0);
  const allNetworkManualRef = useRef(false);
  const accountId = account?.id;
  const networkId = network?.id;
  const walletId = wallet?.id;
  const isAllNetworks = Boolean(network?.isAllNetworks);

  const loadSingle = useCallback(
    async (manual: boolean) => {
      if (!enabled || !accountId || !networkId || isAllNetworks) {
        return;
      }
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setIsRefreshing(true);
      setErrorCode(undefined);
      try {
        const result = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
          accountId,
          networkId,
          isManualRefresh: manual,
          saveToLocal: true,
        });
        if (requestIdRef.current === requestId) {
          setData(result.data);
          setInitialized(true);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorCode('nft_fetch_failed');
          setInitialized(true);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsRefreshing(false);
        }
      }
    },
    [accountId, enabled, isAllNetworks, networkId],
  );

  const fetchAllNetwork = useCallback(
    async ({
      accountId: childAccountId,
      networkId: childNetworkId,
      dbAccount,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
    }) =>
      backgroundApiProxy.serviceNFT.fetchAccountNFTs({
        accountId: childAccountId,
        networkId: childNetworkId,
        dbAccount,
        isAllNetworks: true,
        isManualRefresh: allNetworkManualRef.current,
        allNetworksAccountId: accountId,
        allNetworksNetworkId: networkId,
        saveToLocal: true,
      }),
    [accountId, networkId],
  );

  const readAllNetworkCache = useCallback(
    ({
      accountId: childAccountId,
      networkId: childNetworkId,
      dbAccount,
    }: {
      accountId: string;
      networkId: string;
      dbAccount?: IDBAccount;
    }) =>
      backgroundApiProxy.serviceNFT.getAccountLocalNFTs({
        accountId: childAccountId,
        networkId: childNetworkId,
        dbAccount,
      }),
    [],
  );

  const applyAllNetworkCache = useCallback(
    async ({ data: cached }: { data: IAccountNFT[][] }) => {
      const next = uniqBy(cached.flat(), getNFTKey);
      if (next.length > 0) {
        setData(next);
        setInitialized(true);
      }
    },
    [],
  );

  const handleAllNetworkSettled = useCallback(
    (result: IFetchAccountNFTsResp, generation: number) => {
      if (result.isSameAllNetworksAccountData === false) {
        return;
      }
      if (generation < allNetworkGenerationRef.current) {
        return;
      }
      allNetworkGenerationRef.current = generation;
      setData((previous) => uniqBy([...result.data, ...previous], getNFTKey));
      setInitialized(true);
    },
    [],
  );
  const clearAllNetworkData = useCallback(() => setData([]), []);
  const handleAllNetworkStarted = useCallback(async () => {
    setIsRefreshing(true);
    setErrorCode(undefined);
  }, []);
  const handleAllNetworkFinished = useCallback(async () => {
    allNetworkManualRef.current = false;
    setIsRefreshing(false);
    setInitialized(true);
  }, []);

  const {
    run: runAllNetwork,
    result: allNetworkResult,
    isEmptyAccount,
  } = useAllNetworkRequests<IFetchAccountNFTsResp>({
    accountId,
    networkId,
    walletId,
    isAllNetworks,
    allNetworkRequests: fetchAllNetwork,
    allNetworkCacheRequests: readAllNetworkCache,
    allNetworkCacheData: applyAllNetworkCache,
    clearAllNetworkData,
    disabled: !enabled,
    isNFTRequests: true,
    onRequestSettled: handleAllNetworkSettled,
    onStarted: handleAllNetworkStarted,
    onFinished: handleAllNetworkFinished,
  });

  useEffect(() => {
    if (!allNetworkResult) {
      return;
    }
    setData(
      uniqBy(
        allNetworkResult.flatMap((result) => result.data),
        getNFTKey,
      ),
    );
    setInitialized(true);
  }, [allNetworkResult]);

  useEffect(() => {
    requestIdRef.current += 1;
    allNetworkGenerationRef.current = 0;
    setData([]);
    setInitialized(false);
    setErrorCode(undefined);
    if (!enabled || !accountId || !networkId || !walletId) {
      return;
    }
    void backgroundApiProxy.serviceNFT.updateCurrentAccount({
      accountId,
      networkId,
    });
    if (isAllNetworks) {
      return;
    }
    void (async () => {
      const requestId = requestIdRef.current;
      try {
        const cached = await backgroundApiProxy.serviceNFT.getAccountLocalNFTs({
          accountId,
          networkId,
        });
        if (requestIdRef.current === requestId && cached.length > 0) {
          setData(cached);
          setInitialized(true);
        }
      } catch {
        // The live request below remains authoritative when cache hydration fails.
      }
      await loadSingle(false);
    })();
  }, [accountId, enabled, isAllNetworks, loadSingle, networkId, walletId]);

  useEffect(() => {
    if (enabled && isAllNetworks && isEmptyAccount) {
      setData([]);
      setInitialized(true);
    }
  }, [enabled, isAllNetworks, isEmptyAccount]);

  const refresh = useCallback(async () => {
    if (isAllNetworks) {
      allNetworkManualRef.current = true;
      await runAllNetwork({ alwaysSetState: true });
    } else {
      await loadSingle(true);
    }
  }, [isAllNetworks, loadSingle, runAllNetwork]);

  useEffect(() => {
    if (!enabled || !visible) {
      return;
    }
    const reload = () => {
      void refresh();
    };
    const reloadAccountData = (payload: IEventBusPayloadAccountDataUpdate) => {
      if (payload?.refreshSource === 'pull-to-refresh') return;
      reload();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    const timer = setInterval(reload, POLLING_INTERVAL_FOR_NFT);
    return () => {
      clearInterval(timer);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, reloadAccountData);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, reload);
    };
  }, [enabled, refresh, visible]);

  return useMemo(
    () => ({ data, errorCode, initialized, isRefreshing, refresh }),
    [data, errorCode, initialized, isRefreshing, refresh],
  );
}

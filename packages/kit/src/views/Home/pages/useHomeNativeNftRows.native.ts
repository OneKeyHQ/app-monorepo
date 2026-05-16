import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isEmpty, uniqBy } from 'lodash';
import { useIntl } from 'react-intl';

import type { IHomeNativeNftRow, IHomeNativeRow } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  PROMISE_CONCURRENCY_LIMIT,
  promiseAllSettledEnhanced,
} from '@onekeyhq/shared/src/utils/promiseUtils';
import { EHomeTab } from '@onekeyhq/shared/types';
import type {
  IAccountNFT,
  IFetchAccountNFTsResp,
} from '@onekeyhq/shared/types/nft';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountOverviewActions } from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const NATIVE_NFT_ROW_PREFIX = 'nft:item:';

function getNftIdentity(nft: IAccountNFT) {
  return `${nft.networkId ?? ''}_${nft.collectionAddress}_${nft.itemId}`;
}

function getNftRowKey(nft: IAccountNFT) {
  return `${NATIVE_NFT_ROW_PREFIX}${getNftIdentity(nft)}`;
}

function getNftIdentityFromNativeRowKey(rowKey: string) {
  return rowKey.startsWith(NATIVE_NFT_ROW_PREFIX)
    ? rowKey.slice(NATIVE_NFT_ROW_PREFIX.length)
    : '';
}

function addNftOwner({
  nft,
  accountId,
  networkId,
}: {
  nft: IAccountNFT;
  accountId: string;
  networkId: string;
}): IAccountNFT {
  return {
    ...nft,
    accountId: nft.accountId ?? accountId,
    networkId: nft.networkId ?? networkId,
  };
}

function addNftResponseOwner({
  response,
  accountId,
  networkId,
}: {
  response: IFetchAccountNFTsResp | null;
  accountId: string;
  networkId: string;
}): IFetchAccountNFTsResp | null {
  if (!response) {
    return null;
  }
  return {
    ...response,
    data: response.data.map((nft) =>
      addNftOwner({
        nft,
        accountId,
        networkId,
      }),
    ),
  };
}

function isNFTResponse(
  response: IFetchAccountNFTsResp | null,
): response is IFetchAccountNFTsResp {
  return !!response;
}

function isNFTList(list: IAccountNFT[] | null): list is IAccountNFT[] {
  return !!list;
}

function buildNativeNftRow({
  nft,
  networkName,
}: {
  nft: IAccountNFT;
  networkName?: string;
}): IHomeNativeNftRow {
  const amount = Number(nft.amount ?? 1);
  const amountText =
    Number.isFinite(amount) && amount > 1 ? `x${nft.amount}` : '';
  const subtitle = [nft.collectionName || nft.collectionSymbol, amountText]
    .filter(Boolean)
    .join('  ');

  return {
    type: 'nft',
    key: getNftRowKey(nft),
    nftKey: getNftIdentity(nft),
    title: nft.metadata?.name || nft.itemId || '-',
    subtitle,
    imageUri: nft.metadata?.image,
    networkName,
    estimatedHeight: 72,
  };
}

export function useHomeNativeNftRows({
  enabled = true,
}: {
  enabled?: boolean;
} = {}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { updateAllNetworksState } = useAccountOverviewActions().current;
  const [nftList, setNftList] = useState<IAccountNFT[]>([]);
  const [nftListState, setNftListState] = useState({
    initialized: false,
    isRefreshing: false,
  });
  const [networkNameMap, setNetworkNameMap] = useState<Record<string, string>>(
    {},
  );
  const isAllNetworkManualRefreshRef = useRef(false);
  const requestIdRef = useRef(0);

  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const isSupported = !!(enabled && account?.id && network?.id && wallet?.id);
  const ownerKey = `${account?.id ?? ''}__${network?.id ?? ''}`;

  const getAllNetworkAccounts = useCallback(async () => {
    if (!account?.id || !network?.id) {
      return [] as IAllNetworkAccountInfo[];
    }
    const result =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: account.id,
        networkId: network.id,
        deriveType: undefined,
        nftEnabledOnly: true,
        excludeTestNetwork: true,
        networksEnabledOnly: !accountUtils.isOthersAccount({
          accountId: account.id,
        }),
      });
    updateAllNetworksState({
      visibleCount: uniqBy(result.accountsInfo, 'networkId').length,
    });
    return result.accountsInfo;
  }, [account?.id, network?.id, updateAllNetworksState]);

  const refreshNetworkNameMap = useCallback(async () => {
    const { networks } = await backgroundApiProxy.serviceNetwork.getAllNetworks(
      {
        excludeAllNetworkItem: true,
        excludeTestNetwork: true,
      },
    );
    setNetworkNameMap(
      networks.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.name;
        return acc;
      }, {}),
    );
  }, []);

  const hydrateAllNetworkLocalNFTs = useCallback(async () => {
    const allNetworkAccounts = await getAllNetworkAccounts();
    const localNFTs = await promiseAllSettledEnhanced(
      allNetworkAccounts.map((networkAccount) => async () => {
        const nfts = await backgroundApiProxy.serviceNFT.getAccountLocalNFTs({
          dbAccount: networkAccount.dbAccount,
          accountId: networkAccount.accountId,
          networkId: networkAccount.networkId,
        });
        return nfts.map((nft) =>
          addNftOwner({
            nft,
            accountId: networkAccount.accountId,
            networkId: networkAccount.networkId,
          }),
        );
      }),
      {
        continueOnError: true,
        concurrency: PROMISE_CONCURRENCY_LIMIT,
      },
    );
    return uniqBy(localNFTs.filter(isNFTList).flat(), getNftIdentity);
  }, [getAllNetworkAccounts]);

  const fetchAllNetworkNFTs = useCallback(async () => {
    const allNetworkAccounts = await getAllNetworkAccounts();
    const responses = (
      await promiseAllSettledEnhanced(
        allNetworkAccounts.map((networkAccount) => async () => {
          const response = await backgroundApiProxy.serviceNFT.fetchAccountNFTs(
            {
              dbAccount: networkAccount.dbAccount,
              accountId: networkAccount.accountId,
              networkId: networkAccount.networkId,
              isAllNetworks: true,
              isManualRefresh: isAllNetworkManualRefreshRef.current,
              allNetworksAccountId: account?.id,
              allNetworksNetworkId: network?.id,
              saveToLocal: true,
            },
          );
          return addNftResponseOwner({
            response,
            accountId: networkAccount.accountId,
            networkId: networkAccount.networkId,
          });
        }),
        {
          continueOnError: true,
          concurrency: PROMISE_CONCURRENCY_LIMIT,
        },
      )
    ).filter(isNFTResponse);
    return uniqBy(
      responses.flatMap((response) => response.data),
      getNftIdentity,
    );
  }, [account?.id, getAllNetworkAccounts, network?.id]);

  const refreshNativeNFTs = useCallback(async () => {
    if (!isSupported || !account?.id || !network?.id) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setNftListState((prev) => ({
      initialized: prev.initialized,
      isRefreshing: true,
    }));
    appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
      isRefreshing: true,
      type: EHomeTab.NFT,
      accountId: account.id,
      networkId: network.id,
    });

    try {
      await backgroundApiProxy.serviceNFT.abortFetchAccountNFTs();
      let nextList: IAccountNFT[];
      if (network.isAllNetworks) {
        nextList = await fetchAllNetworkNFTs();
      } else {
        const response = await backgroundApiProxy.serviceNFT.fetchAccountNFTs({
          accountId: account.id,
          networkId: network.id,
          saveToLocal: true,
        });
        nextList = response.data.map((nft) =>
          addNftOwner({
            nft,
            accountId: account.id,
            networkId: network.id,
          }),
        );
      }

      if (requestIdRef.current !== requestId) {
        return;
      }
      setNftList(nextList);
      setNftListState({
        initialized: true,
        isRefreshing: false,
      });
    } catch (error) {
      console.error(error);
      setNftListState({
        initialized: true,
        isRefreshing: false,
      });
    } finally {
      isAllNetworkManualRefreshRef.current = false;
      appEventBus.emit(EAppEventBusNames.TabListStateUpdate, {
        isRefreshing: false,
        type: EHomeTab.NFT,
        accountId: account.id,
        networkId: network.id,
      });
    }
  }, [
    account?.id,
    fetchAllNetworkNFTs,
    isSupported,
    network?.id,
    network?.isAllNetworks,
  ]);

  useEffect(() => {
    void refreshNetworkNameMap();
  }, [refreshNetworkNameMap]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupported || !account?.id || !network?.id) {
      setNftList([]);
      setNftListState({
        initialized: true,
        isRefreshing: false,
      });
      return undefined;
    }

    const initNFTs = async () => {
      setNftListState({
        initialized: false,
        isRefreshing: true,
      });
      try {
        void backgroundApiProxy.serviceNFT.updateCurrentAccount({
          networkId: network.id,
          accountId: account.id,
        });

        let localNFTs: IAccountNFT[] = [];
        if (network.isAllNetworks) {
          localNFTs = await hydrateAllNetworkLocalNFTs();
        } else {
          localNFTs = (
            await backgroundApiProxy.serviceNFT.getAccountLocalNFTs({
              accountId: account.id,
              networkId: network.id,
            })
          ).map((nft) =>
            addNftOwner({
              nft,
              accountId: account.id,
              networkId: network.id,
            }),
          );
        }

        if (cancelled) {
          return;
        }

        if (!isEmpty(localNFTs)) {
          setNftList(localNFTs);
          setNftListState({
            initialized: true,
            isRefreshing: false,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          void refreshNativeNFTs();
        }
      }
    };

    void initNFTs();

    return () => {
      cancelled = true;
    };
  }, [
    account?.id,
    hydrateAllNetworkLocalNFTs,
    isSupported,
    network?.id,
    network?.isAllNetworks,
    ownerKey,
    refreshNativeNFTs,
  ]);

  useEffect(() => {
    const refresh = () => {
      isAllNetworkManualRefreshRef.current = true;
      void refreshNativeNFTs();
    };
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    };
  }, [refreshNativeNFTs]);

  const nftRows = useMemo<IHomeNativeRow[]>(() => {
    const titleRow: IHomeNativeRow = {
      type: 'sectionHeader',
      key: 'nft:title',
      title: intl.formatMessage({
        id: ETranslations.global_nft,
      }),
    };

    if (!isSupported) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'nft:no-wallet',
          title: intl.formatMessage({ id: ETranslations.global_no_wallet }),
          estimatedHeight: 88,
        },
      ];
    }

    if (nftListState.isRefreshing && nftList.length === 0) {
      return [
        titleRow,
        {
          type: 'loading',
          key: 'nft:loading',
          rows: 6,
          estimatedHeight: 72,
        },
      ];
    }

    if (nftListState.initialized && nftList.length === 0) {
      return [
        titleRow,
        {
          type: 'empty',
          key: 'nft:empty',
          title: intl.formatMessage({ id: ETranslations.global_no_data }),
          estimatedHeight: 88,
        },
      ];
    }

    return [
      titleRow,
      ...nftList.map((nft) =>
        buildNativeNftRow({
          nft,
          networkName: nft.networkId
            ? networkNameMap[nft.networkId]
            : undefined,
        }),
      ),
    ];
  }, [
    intl,
    isSupported,
    networkNameMap,
    nftList,
    nftListState.initialized,
    nftListState.isRefreshing,
  ]);

  const nftByIdentity = useMemo(() => {
    const result: Record<string, IAccountNFT> = {};
    for (const nft of nftList) {
      result[getNftIdentity(nft)] = nft;
    }
    return result;
  }, [nftList]);

  const handleNftRowPress = useCallback(
    (rowKey: string) => {
      const nftIdentity = getNftIdentityFromNativeRowKey(rowKey);
      const nft = nftByIdentity[nftIdentity];

      if (!nft || !account || !network || !wallet) {
        return;
      }

      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.NFTDetails,
        params: {
          networkId: nft.networkId ?? network.id,
          accountId: nft.accountId ?? account.id,
          walletId: wallet.id,
          collectionAddress: nft.collectionAddress,
          itemId: nft.itemId,
        },
      });
    },
    [account, navigation, network, nftByIdentity, wallet],
  );

  const refreshNativeNFTsManually = useCallback(async () => {
    isAllNetworkManualRefreshRef.current = true;
    await refreshNativeNFTs();
  }, [refreshNativeNFTs]);

  return {
    handleNftRowPress,
    isRefreshing: nftListState.isRefreshing,
    nftRows,
    refreshNativeNFTs: refreshNativeNFTsManually,
  };
}

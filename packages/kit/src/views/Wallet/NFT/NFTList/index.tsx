import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import {
  Box,
  Empty,
  HStack,
  IconButton,
  VStack,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { DebugRenderTracker } from '@onekeyhq/components/src/DebugRenderTracker';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';
import type { CoinControlItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNFTIsLoading,
} from '@onekeyhq/kit/src/hooks';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { AppUIEventBusNames } from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useIsFocusedAllInOne } from '../../../../hooks/useIsFocusedAllInOne';
import { useOnUIEventBus } from '../../../../hooks/useOnUIEventBus';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { TabRoutes } from '../../../../routes/routesEnum';
import { appSelector } from '../../../../store';
import { WalletHomeTabEnum } from '../../type';
import { navigateToNFTCollection, navigateToNFTDetail } from '../utils';

import { getNFTListComponent, getNFTListMeta } from './getNFTListMeta';
import NFTListHeader from './NFTListHeader';
import {
  atomHomeOverviewNFTList,
  atomHomeOverviewNFTListLoading,
  useAtomNFTList,
  withProviderNFTList,
} from './overviewNFTContext';
import { NFTCardType } from './type';

import type { ListDataType, ListItemType } from './type';

export type IAccountNFTListDataFromSimpleDBOptions = {
  networkId: string;
  accountId: string;
};

type IEmptyProps = IAccountNFTListDataFromSimpleDBOptions & {
  fetchData: () => Promise<unknown>;
};

const EmptyView: FC<IEmptyProps> = ({ networkId, accountId, fetchData }) => {
  const intl = useIntl();
  const isNFTSupport = isCollectibleSupportedChainId(networkId);
  const nftIsLoading = useNFTIsLoading({ networkId, accountId });

  const [isLoading] = useAtomNFTList(atomHomeOverviewNFTListLoading);

  if (!isNFTSupport) {
    return (
      <Empty
        pr="16px"
        emoji="🖼️"
        title={intl.formatMessage({ id: 'empty__not_supported' })}
        subTitle={intl.formatMessage({ id: 'empty__not_supported_desc' })}
      />
    );
  }

  return (
    <Empty
      pr="16px"
      emoji="🖼️"
      title={intl.formatMessage({
        id: 'asset__collectibles_empty_title',
      })}
      subTitle={intl.formatMessage({
        id: 'asset__collectibles_empty_desc',
      })}
      actionTitle={intl.formatMessage({ id: 'action__refresh' })}
      handleAction={fetchData}
      isLoading={isLoading || nftIsLoading}
    />
  );
};
const MemoEmpty = memo(EmptyView);

export function HandleRefreshNFTData({
  accountId,
  networkId,
  fetchData,
}: IEmptyProps) {
  const isUnlock = useAppSelector((s) => s.status.isUnlock);
  const isNFTSupport = isCollectibleSupportedChainId(networkId);
  const [, setNFTIsLoading] = useAtomNFTList(atomHomeOverviewNFTListLoading);
  const { isFocused, homeTabFocused, rootTabFocused } = useIsFocusedAllInOne({
    focusDelay: 1000,
    rootTabName: TabRoutes.Home,
    homeTabName: WalletHomeTabEnum.Tokens,
  });

  const shouldDoRefresh = useMemo((): boolean => {
    if (!isUnlock) {
      return false;
    }
    if (!accountId || !networkId || !isNFTSupport) {
      return false;
    }
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      return false;
    }
    if (!isFocused || !rootTabFocused || !homeTabFocused) {
      return false;
    }
    return true;
  }, [
    isUnlock,
    accountId,
    isFocused,
    isNFTSupport,
    networkId,
    homeTabFocused,
    rootTabFocused,
  ]);

  const swrKey = 'fetchNFTList';
  const { mutate, isValidating: isLoading } = useSWR(swrKey, fetchData, {
    refreshInterval: 30 * 1000,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    isPaused() {
      return !shouldDoRefresh;
    },
  });

  useEffect(() => {
    if (shouldDoRefresh) {
      mutate();
    }
  }, [mutate, shouldDoRefresh]);

  useEffect(() => {
    setNFTIsLoading(isLoading);
  }, [isLoading, setNFTIsLoading]);

  return null;
}

function useAccountNFTListDataFromSimpleDB({
  networkId,
  accountId,
}: IAccountNFTListDataFromSimpleDBOptions) {
  const refresherTs = useAppSelector((s) => s.refresher.refreshAccountNFTTs);

  const result = usePromiseResult(
    () => {
      if (refresherTs) {
        //
      }
      const r = backgroundApiProxy.serviceOverview.buildAccountNFTList({
        networkId,
        accountId,
      });
      return r;
    },
    [accountId, networkId, refresherTs],
    {
      debounced: 600,
      watchLoading: true,
    },
  );

  return result;
}

const HandleRebuildNFTListData = (
  options: IAccountNFTListDataFromSimpleDBOptions,
) => {
  const result = useAccountNFTListDataFromSimpleDB(options);
  const [nftList, setNFTList] = useAtomNFTList(atomHomeOverviewNFTList);

  useEffect(() => {
    const data = result.result;
    if (!data) {
      return;
    }
    if (data.nftKeys) {
      if (!isEqual(nftList.nftKeys, data.nftKeys)) {
        setNFTList(data);
      }
    } else {
      setNFTList(data);
    }
  }, [nftList.nftKeys, result.result, setNFTList]);

  return null;
};

const pageSize = 20;
const NFTListContainer: FC = () => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [page, setPage] = useState(1);

  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));

  const { accountId, networkId, account } = useActiveWalletAccount();

  const [recycleUtxos, setRecycleUtxos] = useState<CoinControlItem[]>([]);

  const [nfts] = useAtomNFTList(atomHomeOverviewNFTList);

  const onSelect = useCallback(
    (data: ListDataType, type: NFTCardType) => {
      if (!accountId || !networkId) return;
      switch (type) {
        case NFTCardType.EVMCollection:
        case NFTCardType.SOLCollection:
          navigateToNFTCollection({
            networkId,
            accountId,
            collection: data as any,
          });
          break;
        case NFTCardType.EVMAsset:
        case NFTCardType.SOLAsset:
          navigateToNFTDetail({ networkId, accountId, asset: data as any });
          break;
        case NFTCardType.BTCAsset:
          navigateToNFTDetail({ networkId, accountId, asset: data as any });
          break;
        default:
          break;
      }
    },
    [accountId, networkId],
  );

  const fetchData = useCallback(async () => {
    const isNFTSupport = isCollectibleSupportedChainId(networkId);
    if (accountId && networkId && isNFTSupport && !isAllNetworks(networkId)) {
      const result = await backgroundApiProxy.serviceNFT.fetchNFT({
        accountId,
        networkId,
      });
      return result;
    }
  }, [accountId, networkId]);

  const collections = useMemo(() => {
    let array: ListItemType<ListDataType>[] = [];

    nfts.nfts.forEach(({ type, data }) => {
      data.forEach((item) => {
        const items = getNFTListMeta({
          data: item,
          type,
        });
        if (type === NFTAssetType.BTC) {
          const asset = items[0].data as NFTBTCAssetModel;

          if (
            !recycleUtxos.find((utxo) => {
              const [txId, vout] = utxo.key.split('_');
              const [assetTxId, assetVout] = asset.output.split(':');
              return assetTxId === txId && assetVout === vout;
            })
          ) {
            array = array.concat(items as any[]);
          }
        } else {
          array = array.concat(items as any[]);
        }
      });
    });
    return array;
  }, [nfts.nfts, recycleUtxos]);

  const hasMore = useMemo(
    () => page * pageSize < collections.length,
    [page, collections.length],
  );

  const fetchCoinControlList = useCallback(async () => {
    let archivedUtxos: CoinControlItem[] = [];
    if (networkId) {
      if (isAllNetworks(networkId)) {
        const networkAccountsMap =
          appSelector((s) => s.overview.allNetworksAccountsMap)?.[accountId] ||
          {};

        for (const [nid, accounts] of Object.entries(
          networkAccountsMap ?? {},
        )) {
          const xpubs: string[] = [];

          if (nid === OnekeyNetwork.btc || nid === OnekeyNetwork.tbtc) {
            xpubs.push(...accounts.map((item) => item.xpub).filter(Boolean));

            archivedUtxos = archivedUtxos.concat(
              await backgroundApiProxy.serviceUtxos.getArchivedUtxos(
                nid,
                xpubs,
              ),
            );
          }
        }
      } else if (account?.xpub) {
        archivedUtxos = await backgroundApiProxy.serviceUtxos.getArchivedUtxos(
          networkId,
          [account.xpub],
        );
      }
      setRecycleUtxos(archivedUtxos.filter((utxo) => utxo.recycle));
    }
  }, [account?.xpub, accountId, networkId]);

  useOnUIEventBus(
    AppUIEventBusNames.InscriptionRecycleChanged,
    fetchCoinControlList,
  );

  useEffect(() => {
    fetchCoinControlList();
  }, [fetchCoinControlList]);

  const renderItem = useCallback<
    NonNullable<FlatListProps<ListItemType<ListDataType>>['renderItem']>
  >(
    ({ item, index }) => {
      const { type, ...props } = item;
      if (!type) {
        return null;
      }
      if (index > page * pageSize - 1) {
        return null;
      }
      const { Component, cardType } = getNFTListComponent({
        type,
      });
      return (
        <DebugRenderTracker>
          <Component
            {...props}
            onSelect={(data) => {
              if (onSelect) {
                onSelect(data, cardType);
              }
            }}
            mr="16px"
          />
        </DebugRenderTracker>
      );
    },
    [onSelect, page],
  );

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const loadMore = useMemo(() => {
    if (!collections?.length) {
      return null;
    }
    const button = hasMore ? (
      <HStack justifyContent="center">
        <IconButton
          name="ChevronDownMini"
          w={isVertical ? 'full' : '130px'}
          onPress={handleLoadMore}
        >
          {intl.formatMessage({ id: 'action__load_more' })}
        </IconButton>
      </HStack>
    ) : null;
    return (
      <VStack pr="4">
        {button}
        <Box h="24px" w="full" />
      </VStack>
    );
  }, [intl, isVertical, handleLoadMore, hasMore, collections?.length]);

  const keyExtractor = useCallback(
    (item: ListItemType<ListDataType>, index: number) =>
      getNFTListComponent({
        type: item.type,
      }).keyExtractor(item, index),
    [],
  );

  const style = useMemo(
    () => ({
      paddingLeft: 16,
      paddingBottom: collections.length ? 16 : 0,
      marginTop: 24,
    }),
    [collections.length],
  );

  const empty = useMemo(
    () => (
      <MemoEmpty
        accountId={accountId}
        networkId={networkId}
        fetchData={fetchData}
      />
    ),
    [accountId, networkId, fetchData],
  );

  const header = useMemo(() => <NFTListHeader />, []);

  return (
    <>
      <HandleRebuildNFTListData accountId={accountId} networkId={networkId} />
      <HandleRefreshNFTData
        accountId={accountId}
        networkId={networkId}
        fetchData={fetchData}
      />
      <Tabs.FlatList
        contentContainerStyle={style}
        key={
          platformEnv.isNative && !platformEnv.isNativeIOSPad
            ? undefined
            : `NFTList${numColumns}`
        }
        data={collections}
        renderItem={renderItem}
        ListFooterComponent={loadMore}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={empty}
        numColumns={numColumns}
        ListHeaderComponent={header}
        keyExtractor={keyExtractor}
      />
    </>
  );
};

export default memo(withProviderNFTList(NFTListContainer));

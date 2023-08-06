import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
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
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import type {
  NFTAssetMeta,
  NFTBTCAssetModel,
} from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';
import type { CoinControlItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAccountPortfolios, useNFTIsLoading } from '../../../../hooks';
import { useHomeTabName } from '../../../../hooks/useHomeTabName';
import { EOverviewScanTaskType } from '../../../Overview/types';
import { WalletHomeTabEnum } from '../../type';
import { navigateToNFTCollection, navigateToNFTDetail } from '../utils';

import { getNFTListComponent, getNFTListMeta } from './getNFTListMeta';
import { NFTListContentProvider } from './NFTListContent';
import NFTListHeader from './NFTListHeader';
import { NFTCardType } from './type';

import type { ListDataType, ListItemType } from './type';

type NFTListProps = {
  listData: NFTAssetMeta[];
  onSelect: (data: ListDataType, cardType: NFTCardType) => void;
  fetchData?: () => void;
  isNFTSupport?: boolean;
  isLoading?: boolean;
  networkId?: string;
};

const EmptyView: FC<
  Pick<NFTListProps, 'isNFTSupport' | 'fetchData' | 'isLoading'>
> = ({ isNFTSupport, fetchData, isLoading }) => {
  const intl = useIntl();
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
      isLoading={isLoading}
    />
  );
};

const MemoEmpty = memo(EmptyView);

const NFTList: FC<NFTListProps> = ({
  listData,
  fetchData,
  isNFTSupport,
  isLoading,
  onSelect,
}) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [page, setPage] = useState(1);
  const { accountId, networkId, account } = useActiveWalletAccount();
  const [recycleUtxos, setRecycleUtxos] = useState<CoinControlItem[]>([]);
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));

  const pageSize = 20;

  const listItems = useMemo(() => {
    let array: ListItemType<ListDataType>[] = [];
    listData.forEach(({ type, data }) => {
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
              return (
                asset.tx_hash === txId && asset.output.split(':')[1] === vout
              );
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
  }, [listData, recycleUtxos]);

  const { data: collections, hasMore } = useMemo(() => {
    const list = listItems.slice(0, page * pageSize);
    return {
      data: list,
      hasMore: list.length < listItems.length,
    };
  }, [listItems, page]);

  const renderItem = useCallback<
    NonNullable<FlatListProps<ListItemType<ListDataType>>['renderItem']>
  >(
    ({ item }) => {
      const { type, ...props } = item;
      if (!type) {
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
    [onSelect],
  );

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [accountId, networkId]);

  const fetchCoinControlList = useCallback(async () => {
    if (account?.xpub && networkId) {
      const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
        networkId,
        isTaprootXpubSegwit(account.xpub ?? '')
          ? getTaprootXpub(account.xpub ?? '')
          : account.xpub ?? '',
      );
      setRecycleUtxos(archivedUtxos.filter((utxo) => utxo.recycle));
    }
  }, [account?.xpub, networkId]);

  useEffect(() => {
    appUIEventBus.on(
      AppUIEventBusNames.InscriptionRecycleChanged,
      fetchCoinControlList,
    );
    return () => {
      appUIEventBus.off(
        AppUIEventBusNames.InscriptionRecycleChanged,
        fetchCoinControlList,
      );
    };
  }, [fetchCoinControlList]);

  useEffect(() => {
    fetchCoinControlList();
  }, [fetchCoinControlList]);

  const flatListKey =
    platformEnv.isNative && !platformEnv.isNativeIOSPad
      ? undefined
      : `NFTList${numColumns}`;

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

  return (
    <Tabs.FlatList
      contentContainerStyle={{
        paddingLeft: 16,
        paddingBottom: listItems.length ? 16 : 0,
        marginTop: 24,
      }}
      key={flatListKey}
      data={collections}
      renderItem={renderItem}
      ListFooterComponent={loadMore}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <MemoEmpty
          fetchData={fetchData}
          isNFTSupport={isNFTSupport}
          isLoading={isLoading}
        />
      }
      numColumns={numColumns}
      ListHeaderComponent={<NFTListHeader isNFTSupport={isNFTSupport} />}
      keyExtractor={(item: ListItemType<ListDataType>, index: number) =>
        getNFTListComponent({
          type: item.type,
        }).keyExtractor(item, index)
      }
    />
  );
};

function NFTListContainer() {
  const { accountId, networkId } = useActiveWalletAccount();

  const isNFTSupport = isCollectibleSupportedChainId(networkId);
  const { serviceNFT } = backgroundApiProxy;
  const homeTabName = useHomeTabName();
  const isFocused = useIsFocused();

  const [listData, updateListData] = useState<NFTAssetMeta[]>([]);

  const nftIsLoading = useNFTIsLoading({
    accountId,
    networkId,
  });

  const { updatedAt } = useAccountPortfolios({
    networkId,
    accountId,
    type: EOverviewScanTaskType.nfts,
  });

  useEffect(() => {
    backgroundApiProxy.serviceNFT
      .getNftListWithAssetType({
        networkId,
        accountId,
      })
      .then((res) => updateListData(res))
      .catch((e) => {
        debugLogger.common.error('getNftListWithAssetType Error', e);
      });
  }, [updatedAt, networkId, accountId]);

  const fetchData = useCallback(async () => {
    if (accountId && networkId && isNFTSupport && !isAllNetworks(networkId)) {
      const result = await serviceNFT.fetchNFT({
        accountId,
        networkId,
      });
      return result;
    }
  }, [accountId, isNFTSupport, networkId, serviceNFT]);

  const shouldDoRefresh = useMemo((): boolean => {
    if (!accountId || !networkId || !isNFTSupport) {
      return false;
    }
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      return false;
    }
    if (!isFocused) {
      return false;
    }
    if (homeTabName !== WalletHomeTabEnum.Collectibles) {
      return false;
    }
    return true;
  }, [accountId, homeTabName, isFocused, isNFTSupport, networkId]);

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
  }, [mutate, shouldDoRefresh, accountId, networkId]);

  const handleSelect = useCallback(
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

  return (
    <NFTListContentProvider>
      <NFTList
        listData={listData}
        onSelect={handleSelect}
        fetchData={mutate}
        isNFTSupport={isNFTSupport}
        isLoading={isLoading || nftIsLoading}
      />
    </NFTListContentProvider>
  );
}

export default memo(NFTListContainer);

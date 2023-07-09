import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import {
  Box,
  Empty,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { RenderTracker } from '@onekeyhq/components/src/RenderTracker';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import type { NFTAssetMeta } from '@onekeyhq/engine/src/types/nft';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAccountPortfolios } from '../../../../hooks';
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
  networkId,
}) => {
  const [expand, setExpand] = useState(false);

  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));

  const listItems = useMemo(() => {
    let array: ListItemType<ListDataType>[] = [];
    listData.forEach(({ type, data }) => {
      data.forEach((item) => {
        const items = getNFTListMeta({
          data: item,
          type,
          expand,
        });
        array = array.concat(items as any[]);
      });
    });
    return array;
  }, [listData, expand]);

  const renderItem = useCallback<
    NonNullable<FlatListProps<ListItemType<ListDataType>>['renderItem']>
  >(
    ({ item }) => {
      const { type, ...props } = item;
      if (!type) {
        return null;
      }
      const { Component, cardType } = getNFTListComponent({
        expand,
        type,
      });
      return (
        <RenderTracker>
          <Component
            {...props}
            onSelect={(data) => {
              if (onSelect) {
                onSelect(data, cardType);
              }
            }}
            mr="16px"
          />
        </RenderTracker>
      );
    },
    [onSelect, expand],
  );

  const flatListKey =
    platformEnv.isNative && !platformEnv.isNativeIOSPad
      ? undefined
      : `NFTList${numColumns}`;
  const sharedProps = useMemo(
    () => ({
      contentContainerStyle: {
        paddingLeft: 16,
        paddingBottom: listItems.length ? 16 : 0,
        marginTop: 24,
      },
      key: flatListKey,
      data: listItems,
      renderItem,
      ListFooterComponent: <Box h="24px" w="full" />,
      showsVerticalScrollIndicator: false,
      ListEmptyComponent: (
        <MemoEmpty
          fetchData={fetchData}
          isNFTSupport={isNFTSupport}
          isLoading={isLoading}
        />
      ),
      numColumns,
      ListHeaderComponent: (
        <NFTListHeader
          expandEnable={networkId !== OnekeyNetwork.btc}
          isNFTSupport={isNFTSupport}
          expand={expand}
          onPress={() => {
            setExpand((prev) => !prev);
          }}
        />
      ),
      keyExtractor: (item: ListItemType<ListDataType>, index: number) =>
        getNFTListComponent({
          expand,
          type: item.type,
        }).keyExtractor(item, index),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      listItems,
      renderItem,
      fetchData,
      isNFTSupport,
      isLoading,
      numColumns,
      expand,
    ],
  );

  return (
    // @ts-ignore
    <Tabs.FlatList {...sharedProps} />
  );
};

function NFTListContainer() {
  const { account, network, accountId, networkId } = useActiveWalletAccount();

  const isNFTSupport = isCollectibleSupportedChainId(networkId);
  const { serviceNFT } = backgroundApiProxy;
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const isFocused = useIsFocused();

  const [listData, updateListData] = useState<NFTAssetMeta[]>([]);

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
    if (accountId && networkId && isNFTSupport) {
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
  }, [mutate, shouldDoRefresh, account, networkId]);

  const handleSelect = useCallback(
    (data: ListDataType, type: NFTCardType) => {
      if (!account || !network) return;
      switch (type) {
        case NFTCardType.EVMCollection:
        case NFTCardType.SOLCollection:
          navigateToNFTCollection({
            account,
            network,
            collection: data as any,
          });
          break;
        case NFTCardType.EVMAsset:
        case NFTCardType.SOLAsset:
          navigateToNFTDetail({ account, network, asset: data as any });
          break;
        case NFTCardType.BTCAsset:
          navigateToNFTDetail({ account, network, asset: data as any });
          break;
        default:
          break;
      }
    },
    [account, network],
  );

  return (
    <NFTListContentProvider>
      <NFTList
        listData={listData}
        onSelect={handleSelect}
        fetchData={mutate}
        isNFTSupport={isNFTSupport}
        isLoading={isLoading}
      />
    </NFTListContentProvider>
  );
}

export default memo(NFTListContainer);

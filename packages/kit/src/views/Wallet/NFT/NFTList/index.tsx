import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Empty,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { FlatListProps } from '@onekeyhq/components/src/FlatList';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import IconNFT from '@onekeyhq/kit/assets/3d_nft.png';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  CollectiblesModalRoutes,
  CollectiblesRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Collectibles';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { MAX_PAGE_CONTAINER_WIDTH } from '../../../../config';

import CollectionCard from './CollectionCard';
import NFTListAssetCard from './NFTListAssetCard';
import { NFTListContentProvider } from './NFTListContent';
import NFTListHeader from './NFTListHeader';

type NFTListProps = {
  collectibles: Collection[];
  onSelectCollection?: (cols: Collection) => void;
  onSelectAsset?: (asset: NFTAsset) => void;
  fetchData?: () => void;
  isNFTSupport?: boolean;
  isLoading?: boolean;
};

const stringAppend = (...args: Array<string | null | undefined>) =>
  args.filter(Boolean).join('');

const EmptyView: FC<
  Pick<NFTListProps, 'isNFTSupport' | 'fetchData' | 'isLoading'>
> = ({ isNFTSupport, fetchData, isLoading }) => {
  const intl = useIntl();
  if (!isNFTSupport) {
    return (
      <Empty
        pr="16px"
        imageUrl={IconNFT}
        title={intl.formatMessage({ id: 'empty__not_supported' })}
        subTitle={intl.formatMessage({ id: 'empty__not_supported_desc' })}
      />
    );
  }
  return (
    <Empty
      pr="16px"
      imageUrl={IconNFT}
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

const MemoEmpty = React.memo(EmptyView);

const NFTList: FC<NFTListProps> = ({
  collectibles,
  onSelectAsset,
  onSelectCollection,
  fetchData,
  isNFTSupport,
  isLoading,
}) => {
  const [expand, setExpand] = React.useState(false);

  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();
  const MARGIN = isSmallScreen ? 16 : 20;
  const pageWidth = isSmallScreen
    ? screenWidth
    : Math.min(MAX_PAGE_CONTAINER_WIDTH, screenWidth - 224);
  const numColumns = isSmallScreen ? 2 : Math.floor(pageWidth / (177 + MARGIN));
  const allAssets = useMemo(
    () => collectibles.map((collection) => collection.assets).flat(),
    [collectibles],
  );

  const renderCollectionItem = React.useCallback<
    NonNullable<FlatListProps<Collection>['renderItem']>
  >(
    ({ item }) => (
      <CollectionCard
        collectible={item}
        mr="16px"
        onSelectCollection={onSelectCollection}
      />
    ),
    [onSelectCollection],
  );

  const renderAssetItem = React.useCallback<
    NonNullable<FlatListProps<NFTAsset>['renderItem']>
  >(
    ({ item }) => (
      <NFTListAssetCard
        key={stringAppend(item.contractAddress, item.tokenId)}
        marginRight="16px"
        asset={item}
        onSelectAsset={onSelectAsset}
      />
    ),
    [onSelectAsset],
  );
  const flatListKey =
    platformEnv.isNative && !platformEnv.isNativeIOSPad
      ? undefined
      : `NFTList${numColumns}`;
  const sharedProps = React.useMemo(
    () => ({
      contentContainerStyle: {
        paddingLeft: 16,
        paddingBottom: collectibles.length ? 16 : 0,
        marginTop: 24,
      },
      key: flatListKey,
      data: expand ? allAssets : collectibles,
      renderItem: expand ? renderAssetItem : renderCollectionItem,
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
          isNFTSupport={isNFTSupport}
          expand={expand}
          onPress={() => {
            setExpand((prev) => !prev);
          }}
        />
      ),
      keyExtractor: expand
        ? (item: NFTAsset, index: number) => {
            if (item.contractAddress && item.tokenId) {
              return item.contractAddress + item.tokenId;
            }
            if (item.tokenAddress) {
              return item.tokenAddress;
            }
            return `NFTAsset ${index}`;
          }
        : (item: Collection, index: number) => {
            if (item.contractAddress) {
              return `Collection ${item.contractAddress}`;
            }
            if (item.contractName) {
              return `Collection ${item.contractName}`;
            }
            return `Collection ${index}`;
          },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      collectibles,
      expand,
      allAssets,
      renderAssetItem,
      renderCollectionItem,
      numColumns,
      fetchData,
      isNFTSupport,
      isLoading,
    ],
  );

  return (
    // @ts-ignore
    <Tabs.FlatList {...sharedProps} />
  );
};

type NavigationProps = ModalScreenProps<CollectiblesRoutesParams>;

function NFTListContainer() {
  const { account, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isNFTSupport = isCollectibleSupportedChainId(network?.id);
  const { serviceNFT } = backgroundApiProxy;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [price, updatePrice] = useState<number>(0);
  const [collectibles, updateListData] = useState<Collection[]>([]);

  const [refresh, setRefresh] = useState(0);

  const fetchData = () => {
    setRefresh((prev) => prev + 1);
  };

  useEffect(() => {
    let isCancel = false;
    (async () => {
      if (account && network?.id) {
        setIsLoading(true);
        const localData = await serviceNFT.getLocalNFTs({
          networkId: network.id,
          accountId: account.address,
        });
        updateListData(localData);
        const result = await serviceNFT.fetchNFT({
          accountId: account.address,
          networkId: network?.id,
        });
        if (!isCancel) {
          updateListData(result);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isCancel = true;
    };
  }, [account, network, serviceNFT, refresh]);

  useEffect(() => {
    let isCancel = false;
    (async () => {
      if (network?.id) {
        const data = await serviceNFT.fetchSymbolPrice(network.id);
        if (!isCancel && data) {
          updatePrice(data);
        }
      }
    })();
    return () => {
      isCancel = true;
    };
  }, [network, serviceNFT]);

  const handleSelectAsset = useCallback(
    (asset: NFTAsset) => {
      if (!network) return;
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectibleDetailModal,
          params: {
            asset,
            network,
          },
        },
      });
    },
    [navigation, network],
  );

  // Open Collection modal
  const handleSelectCollectible = useCallback(
    (collectible: Collection) => {
      if (!account || !network) return;
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.CollectionModal,
          params: {
            collectible,
            network,
          },
        },
      });
    },
    [account, navigation, network],
  );

  return (
    <NFTListContentProvider price={price}>
      <NFTList
        collectibles={collectibles}
        onSelectCollection={handleSelectCollectible}
        onSelectAsset={handleSelectAsset}
        fetchData={fetchData}
        isNFTSupport={isNFTSupport}
        isLoading={isLoading}
      />
    </NFTListContentProvider>
  );
}

export default React.memo(NFTListContainer);

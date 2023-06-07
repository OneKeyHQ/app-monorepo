import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/native';
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
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import { isCollectibleSupportedChainId } from '@onekeyhq/engine/src/managers/nft';
import type { Collection, NFTAsset } from '@onekeyhq/engine/src/types/nft';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks/redux';
import type { CollectiblesRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Collectibles';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { MAX_PAGE_CONTAINER_WIDTH } from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useIsMounted } from '../../../../hooks/useIsMounted';
import { CollectiblesModalRoutes } from '../../../../routes/routesEnum';
import { WalletHomeTabEnum } from '../../type';

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
  collectibles,
  onSelectAsset,
  onSelectCollection,
  fetchData,
  isNFTSupport,
  isLoading,
}) => {
  const [expand, setExpand] = useState(false);

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

  const renderCollectionItem = useCallback<
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

  const renderAssetItem = useCallback<
    NonNullable<FlatListProps<NFTAsset>['renderItem']>
  >(
    ({ item }) => (
      <NFTListAssetCard
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
  const sharedProps = useMemo(
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
  const { account, networkId, accountId, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isNFTSupport = isCollectibleSupportedChainId(networkId);
  const { serviceNFT } = backgroundApiProxy;
  const isMountedRef = useIsMounted();
  const homeTabName = useAppSelector((s) => s.status.homeTabName);
  const isFocused = useIsFocused();
  const [collectibles, updateListData] = useState<Collection[]>([]);

  const fetchData = async () => {
    if (account && networkId && isNFTSupport) {
      const result = await serviceNFT.fetchNFT({
        accountId: account.address,
        networkId,
      });
      return result;
    }
    return [];
  };

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
    onSuccess(data) {
      if (isMountedRef.current) {
        updateListData(data);
      }
    },
  });

  useEffect(() => {
    (async () => {
      if (account && networkId) {
        const localData = await serviceNFT.getLocalNFTs({
          networkId,
          accountId: account.address,
        });
        if (isMountedRef.current) {
          updateListData(localData);
        }
      }
    })();
  }, [account, isMountedRef, networkId, serviceNFT]);

  useEffect(() => {
    if (shouldDoRefresh) {
      mutate();
    }
  }, [mutate, shouldDoRefresh, account, networkId]);

  const handleSelectAsset = useCallback(
    (asset: NFTAsset) => {
      if (!network) return;
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Collectibles,
        params: {
          screen: CollectiblesModalRoutes.NFTDetailModal,
          params: {
            asset,
            network,
            isOwner: true,
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
    <NFTListContentProvider>
      <NFTList
        collectibles={collectibles}
        onSelectCollection={handleSelectCollectible}
        onSelectAsset={handleSelectAsset}
        fetchData={mutate}
        isNFTSupport={isNFTSupport}
        isLoading={isLoading}
      />
    </NFTListContentProvider>
  );
}

export default memo(NFTListContainer);

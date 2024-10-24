import { useCallback, useMemo } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import {
  ListView,
  Stack,
  renderNestedScrollView,
  useMedia,
} from '@onekeyhq/components';
import { EmptyNFT, EmptySearch } from '@onekeyhq/kit/src/components/Empty';
import { NFTListLoadingView } from '@onekeyhq/kit/src/components/Loading';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useTabListScroll } from '@onekeyhq/kit/src/hooks/useTabListScroll';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSearchKeyAtom } from '@onekeyhq/kit/src/states/jotai/contexts/nftList';
import useActiveTabDAppInfo from '@onekeyhq/kit/src/views/DAppConnection/hooks/useActiveTabDAppInfo';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { getFilteredNftsBySearchKey } from '@onekeyhq/shared/src/utils/nftUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { NFTListHeader } from './NFTListHeader';
import { NFTListItem } from './NFTListItem';

import type { ListRenderItemInfo } from 'react-native';

type IProps = {
  data: IAccountNFT[];
  isLoading?: boolean;
  inTabList?: boolean;
  initialized?: boolean;
  onRefresh?: () => void;
  isAllNetworks?: boolean;
};

const useMumColumns: () => {
  numColumns: number;
  flexBasis: IStackProps['flexBasis'];
} = () => {
  const { gtSm, gtLg, gtXl, gt2xl } = useMedia();
  return useMemo(() => {
    if (gt2xl) {
      return {
        flexBasis: '14.2857142857%',
        numColumns: 7,
      };
    }

    if (gtXl) {
      return {
        flexBasis: '16.666666%',
        numColumns: 6,
      };
    }

    if (gtLg) {
      return {
        flexBasis: '25%',
        numColumns: 4,
      };
    }

    if (gtSm) {
      return {
        flexBasis: '33.333333%',
        numColumns: 3,
      };
    }

    return {
      flexBasis: '50%',
      numColumns: 2,
    };
  }, [gt2xl, gtLg, gtSm, gtXl]);
};

function NFTListView(props: IProps) {
  const {
    data,
    isLoading,
    initialized,
    inTabList = false,
    isAllNetworks,
  } = props;

  const [searchKey] = useSearchKeyAtom();

  const filteredNfts = getFilteredNftsBySearchKey({ nfts: data, searchKey });

  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const handleOnPressNFT = useCallback(
    (nft: IAccountNFT) => {
      if (!account || !network || !wallet) return;
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
    [account, navigation, network, wallet],
  );

  const { flexBasis, numColumns } = useMumColumns();

  const handleRenderItem = useCallback(
    ({ item }: ListRenderItemInfo<IAccountNFT>) => (
      <NFTListItem
        nft={item}
        flexBasis={flexBasis}
        key={`${item.collectionAddress}-${item.itemId}`}
        onPress={handleOnPressNFT}
        isAllNetworks={isAllNetworks}
      />
    ),
    [flexBasis, handleOnPressNFT, isAllNetworks],
  );

  const { listViewProps, listViewRef, onLayout } =
    useTabListScroll<IAccountNFT>({
      inTabList,
    });
  const contentContainerStyle = useMemo(
    () => ({
      pb: '$6',
      px: '$2.5',
    }),
    [],
  );

  const { result: extensionActiveTabDAppInfo } = useActiveTabDAppInfo();
  const addPaddingOnListFooter = useMemo(
    () => !!extensionActiveTabDAppInfo?.showFloatingPanel,
    [extensionActiveTabDAppInfo?.showFloatingPanel],
  );

  if (!initialized && isLoading) {
    return <NFTListLoadingView />;
  }

  return (
    <ListView
      {...listViewProps}
      ref={listViewRef}
      renderScrollComponent={renderNestedScrollView}
      // Changing numColumns on the fly is not supported.
      //  Change the key prop in FlatList when changing the number of columns to force a fresh render of the component.
      key={numColumns}
      onLayout={onLayout}
      contentContainerStyle={contentContainerStyle}
      numColumns={numColumns}
      data={filteredNfts}
      renderItem={handleRenderItem}
      ListHeaderComponent={<NFTListHeader filteredNfts={filteredNfts} />}
      ListEmptyComponent={searchKey ? <EmptySearch /> : <EmptyNFT />}
      ListFooterComponent={
        <>{addPaddingOnListFooter ? <Stack h="$16" /> : null}</>
      }
    />
  );
}

export { NFTListView };

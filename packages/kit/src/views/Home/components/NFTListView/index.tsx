import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';

import type { IStackProps, ListView } from '@onekeyhq/components';
import { Stack, Tabs, useMedia, useStyle } from '@onekeyhq/components';
import { EmptyNFT, EmptySearch } from '@onekeyhq/kit/src/components/Empty';
import { NFTListLoadingView } from '@onekeyhq/kit/src/components/Loading';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSearchKeyAtom } from '@onekeyhq/kit/src/states/jotai/contexts/nftList';
import useActiveTabDAppInfo from '@onekeyhq/kit/src/views/DAppConnection/hooks/useActiveTabDAppInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { getFilteredNftsBySearchKey } from '@onekeyhq/shared/src/utils/nftUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { PullToRefresh } from '../PullToRefresh';

import { NFTListItem } from './NFTListItem';

import type { ListRenderItemInfo } from 'react-native';

type IProps = {
  data: IAccountNFT[];
  isLoading?: boolean;
  inTabList?: boolean;
  initialized?: boolean;
  onRefresh?: () => void;
  isAllNetworks?: boolean;
  listViewStyleProps?: Pick<
    ComponentProps<typeof ListView>,
    | 'ListHeaderComponentStyle'
    | 'ListFooterComponentStyle'
    | 'contentContainerStyle'
  >;
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
    isAllNetworks,
    listViewStyleProps,
    onRefresh,
  } = props;

  const [searchKey] = useSearchKeyAtom();

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
  const filteredNfts: (IAccountNFT | null)[] = useMemo(() => {
    const list: (IAccountNFT | null)[] = getFilteredNftsBySearchKey({
      nfts: data,
      searchKey,
    });
    const placeholderCount = numColumns - (list.length % numColumns);
    if (list?.length && placeholderCount) {
      return [
        ...list,
        ...Array(placeholderCount).fill(null),
      ] as (IAccountNFT | null)[];
    }
    return list;
  }, [data, searchKey, numColumns]);

  const handleRenderItem = useCallback(
    ({ item }: ListRenderItemInfo<IAccountNFT | null>) =>
      item ? (
        <NFTListItem
          nft={item}
          flexBasis={flexBasis}
          key={`${item.collectionAddress}-${item.itemId}`}
          onPress={handleOnPressNFT}
          isAllNetworks={isAllNetworks}
        />
      ) : (
        <Stack flex={1} />
      ),
    [flexBasis, handleOnPressNFT, isAllNetworks],
  );
  const contentContainerStyle = useMemo(
    () => ({
      mt: '$3',
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

  const style = useStyle(
    { ...contentContainerStyle, ...listViewStyleProps?.contentContainerStyle },
    {
      resolveValues: 'auto',
    },
  );

  const { ListHeaderComponentStyle, ListFooterComponentStyle } =
    listViewStyleProps || {};
  const resolvedListHeaderComponentStyle = useStyle(
    ListHeaderComponentStyle || {},
    {
      resolveValues: 'auto',
    },
  );
  const resolvedListFooterComponentStyle = useStyle(
    ListFooterComponentStyle || {},
    {
      resolveValues: 'auto',
    },
  );

  const EmptyComponentElement = useMemo(() => {
    if (!initialized && isLoading) {
      return <NFTListLoadingView />;
    }
    if (searchKey) {
      return <EmptySearch flex={1} />;
    }
    return <EmptyNFT />;
  }, [initialized, isLoading, searchKey]);

  return (
    <Tabs.FlatList
      // @ts-ignore
      horizontalPadding={20}
      nestedScrollEnabled={platformEnv.isNativeAndroid}
      refreshControl={
        !platformEnv.isNativeAndroid && onRefresh ? (
          <PullToRefresh onRefresh={onRefresh} />
        ) : undefined
      }
      key={platformEnv.isNative ? numColumns : undefined}
      contentContainerStyle={style as any}
      ListHeaderComponentStyle={resolvedListHeaderComponentStyle as any}
      ListFooterComponentStyle={resolvedListFooterComponentStyle as any}
      numColumns={numColumns}
      data={filteredNfts || []}
      renderItem={handleRenderItem}
      ListEmptyComponent={EmptyComponentElement}
      ListFooterComponent={
        <>{addPaddingOnListFooter ? <Stack h="$16" /> : null}</>
      }
    />
  );
}

export { NFTListView };

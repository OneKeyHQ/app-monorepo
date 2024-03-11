import { useCallback, useState } from 'react';

import { ScrollView, XStack } from '@onekeyhq/components';
import { EmptyNFT, EmptySearch } from '@onekeyhq/kit/src/components/Empty';
import { NFTListLoadingView } from '@onekeyhq/kit/src/components/Loading';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getFilteredNftsBySearchKey } from '@onekeyhq/shared/src/utils/nftUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { EModalAssetDetailRoutes } from '../../../AssetDetails/router/types';

import { NFTListHeader } from './NFTListHeader';
import { NFTListItem } from './NFTListItem';

type IProps = {
  data: IAccountNFT[];
  isLoading?: boolean;
  initialized?: boolean;
  onRefresh?: () => void;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function NFTListView(props: IProps) {
  const { data, isLoading, initialized, onContentSizeChange } = props;
  const [searchKey, setSearchKey] = useState('');

  const filteredNfts = getFilteredNftsBySearchKey({ nfts: data, searchKey });

  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const handleOnPressNFT = useCallback(
    (nft: IAccountNFT) => {
      if (!account || !network) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.NFTDetails,
        params: {
          networkId: network.id,
          accountId: account.id,
          accountAddress: account.address,
          collectionAddress: nft.collectionAddress,
          itemId: nft.itemId,
        },
      });
    },
    [account, navigation, network],
  );

  const renderNFTListView = useCallback(() => {
    if (!filteredNfts || filteredNfts.length === 0)
      return searchKey ? <EmptySearch /> : <EmptyNFT />;

    return (
      <XStack flexWrap="wrap" px="$2.5" pb="$5" py="$0.5">
        {filteredNfts.map((item) => (
          <NFTListItem
            nft={item}
            key={item.itemId}
            onPress={handleOnPressNFT}
          />
        ))}
      </XStack>
    );
  }, [filteredNfts, handleOnPressNFT, searchKey]);

  if (!initialized && isLoading) {
    return <NFTListLoadingView onContentSizeChange={onContentSizeChange} />;
  }

  return (
    <ScrollView
      h="100%"
      py="$3"
      scrollEnabled={platformEnv.isWebTouchable}
      disableScrollViewPanResponder
      onContentSizeChange={onContentSizeChange}
    >
      <NFTListHeader
        nfts={data}
        filteredNfts={filteredNfts}
        searchKey={searchKey}
        setSearchKey={setSearchKey}
      />
      {renderNFTListView()}
    </ScrollView>
  );
}

export { NFTListView };

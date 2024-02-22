import { useCallback } from 'react';

import { ScrollView, Stack, XStack } from '@onekeyhq/components';
import { EmptyNFT } from '@onekeyhq/kit/src/components/Empty';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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

  if (!initialized && isLoading) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  if (!data || data.length === 0)
    return (
      <Stack mt="$8">
        <EmptyNFT />
      </Stack>
    );

  return (
    <ScrollView h="100%">
      <NFTListHeader />
      <XStack flexWrap="wrap" px="$2.5" pb="$5">
        {data.map((item) => (
          <NFTListItem
            nft={item}
            key={item.itemId}
            onPress={handleOnPressNFT}
          />
        ))}
      </XStack>
    </ScrollView>
  );
}

export { NFTListView };

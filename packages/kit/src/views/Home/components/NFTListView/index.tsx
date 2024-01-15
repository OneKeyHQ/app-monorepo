import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Stack, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { NFTListHeader } from './NFTListHeader';
import { NFTListItem } from './NFTListItem';
import { EModalAssetDetailRoutes } from '../../../AssetDetails/router/types';

type IProps = {
  data: IAccountNFT[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function NFTListEmpty() {
  const intl = useIntl();

  return (
    <Stack height="100%" alignItems="center" justifyContent="center">
      <Empty
        title={intl.formatMessage({ id: 'empty__no_nfts' })}
        description={intl.formatMessage({
          id: 'content__you_dont_have_any_nft_in_your_wallet',
        })}
      />
    </Stack>
  );
}

function NFTListView(props: IProps) {
  const { data } = props;

  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const handleOnPressNFT = useCallback(
    (nft: IAccountNFT) => {
      if (!account || !network) return;
      navigation.pushModal(EModalRoutes.AssetDetailsModal, {
        screen: EModalAssetDetailRoutes.NFTDetails,
        params: {
          networkId: network.id,
          accountAddress: account.address,
          collectionAddress: nft.collectionAddress,
          itemId: nft.itemId,
        },
      });
    },
    [account, navigation, network],
  );

  if (!data || data.length === 0) return <NFTListEmpty />;

  return (
    <Stack>
      <NFTListHeader />
      <XStack flexWrap="wrap" px="$2.5">
        {data.map((item) => (
          <NFTListItem
            nft={item}
            key={item.itemId}
            onPress={handleOnPressNFT}
          />
        ))}
      </XStack>
    </Stack>
  );
}

export { NFTListView };

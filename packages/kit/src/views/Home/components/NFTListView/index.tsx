import { useIntl } from 'react-intl';

import { Empty, ListView, Stack } from '@onekeyhq/components';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { NFTListHeader } from './NFTListHeader';
import { NFTListItem } from './NFTListItem';

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
  const { data, onContentSizeChange } = props;

  return (
    <ListView
      h="100%"
      estimatedItemSize={76}
      scrollEnabled={false}
      data={data}
      ListHeaderComponent={NFTListHeader}
      ListHeaderComponentStyle={{
        mt: '$4',
        mb: '$2',
      }}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={NFTListEmpty}
      renderItem={({ item }) => <NFTListItem nft={item} key={item.itemId} />}
    />
  );
}

export { NFTListView };

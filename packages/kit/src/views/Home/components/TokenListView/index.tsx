import { useIntl } from 'react-intl';

import { Empty, ListView, Stack } from '@onekeyhq/components';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';

type IProps = {
  data: IAccountToken[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TokenListEmpty() {
  const intl = useIntl();

  return (
    <Stack height="100%" alignItems="center" justifyContent="center">
      <Empty
        title={intl.formatMessage({ id: 'empty__no_tokens' })}
        description={intl.formatMessage({
          id: 'content__deposit_tokens_to_your_wallet',
        })}
      />
    </Stack>
  );
}

function TokenListView(props: IProps) {
  const { data, onContentSizeChange } = props;

  return (
    <ListView
      h="100%"
      estimatedItemSize={76}
      scrollEnabled={false}
      data={data}
      ListHeaderComponent={TokenListHeader}
      ListHeaderComponentStyle={{
        mt: '$4',
        mb: '$2',
      }}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={TokenListEmpty}
      renderItem={({ item }) => <TokenListItem token={item} key={item.id} />}
    />
  );
}

export { TokenListView };

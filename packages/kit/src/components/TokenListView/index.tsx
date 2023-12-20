import { useIntl } from 'react-intl';

import { Empty, ListView, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenListAtom } from '../../states/jotai/contexts/token-list';

import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';

type IProps = {
  isLoading?: boolean;
  onRefresh?: () => void;
  onPress?: (token: IAccountToken) => void;
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
  const { onContentSizeChange, onPress } = props;

  const [tokenList] = useTokenListAtom();
  const { tokens } = tokenList;

  return (
    <ListView
      h="100%"
      estimatedItemSize={76}
      scrollEnabled={platformEnv.isWebTouchable}
      data={tokens}
      ListHeaderComponent={TokenListHeader}
      ListHeaderComponentStyle={{
        p: '$5',
      }}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={TokenListEmpty}
      renderItem={({ item }) => (
        <TokenListItem token={item} key={item.$key} onPress={onPress} />
      )}
    />
  );
}

export { TokenListView };

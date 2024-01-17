import { useIntl } from 'react-intl';

import { Divider, Empty, ListView } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenListAtom } from '../../states/jotai/contexts/token-list';

import { TokenListFooter } from './TokenListFooter';
import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';

type IProps = {
  tableLayout?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  onPressToken?: (token: IAccountToken) => void;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  withHeader?: boolean;
  withFooter?: boolean;
};

function TokenListEmpty() {
  const intl = useIntl();

  return (
    <Empty
      icon="CryptoCoinOutline"
      title={intl.formatMessage({ id: 'empty__no_tokens' })}
      description={intl.formatMessage({
        id: 'content__deposit_tokens_to_your_wallet',
      })}
    />
  );
}

const ItemSeparatorComponent = () => <Divider mx="$5" />;

function TokenListView(props: IProps) {
  const {
    onContentSizeChange,
    onPressToken,
    tableLayout,
    withHeader,
    withFooter,
  } = props;

  const [tokenList] = useTokenListAtom();
  const { tokens } = tokenList;

  return (
    <ListView
      estimatedItemSize={60}
      scrollEnabled={platformEnv.isWebTouchable}
      data={tokens}
      ListHeaderComponent={
        withHeader ? <TokenListHeader tableLayout={tableLayout} /> : null
      }
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={TokenListEmpty}
      renderItem={({ item }) => (
        <TokenListItem
          token={item}
          key={item.$key}
          onPress={onPressToken}
          tableLayout={tableLayout}
        />
      )}
      ListFooterComponent={
        withFooter ? <TokenListFooter tableLayout={tableLayout} /> : null
      }
      {...(tableLayout && {
        ItemSeparatorComponent,
      })}
    />
  );
}

export { TokenListView };

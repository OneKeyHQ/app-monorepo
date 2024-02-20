import { useIntl } from 'react-intl';

import { Divider, Empty, ListView, Spinner, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenListAtom } from '../../states/jotai/contexts/tokenList';

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
  withPrice?: boolean;
  withName?: boolean;
  initialized?: boolean;
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

function TokenListView(props: IProps) {
  const {
    onContentSizeChange,
    onPressToken,
    tableLayout,
    withHeader,
    withFooter,
    withName,
    withPrice,
    isLoading,
    initialized,
  } = props;

  const [tokenList] = useTokenListAtom();
  const { tokens } = tokenList;

  if (!initialized && isLoading) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        mt="$24"
        onLayout={(event) =>
          onContentSizeChange?.(
            event.nativeEvent.layout.width,
            event.nativeEvent.layout.height,
          )
        }
      >
        <Spinner size="large" />
      </Stack>
    );
  }

  return (
    <ListView
      estimatedItemSize={48}
      scrollEnabled={platformEnv.isWebTouchable}
      data={tokens}
      ListHeaderComponent={
        withHeader ? (
          <TokenListHeader tokens={tokens} tableLayout={tableLayout} />
        ) : null
      }
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={TokenListEmpty}
      renderItem={({ item, index }) => (
        <TokenListItem
          token={item}
          key={item.$key}
          index={index}
          onPress={onPressToken}
          tableLayout={tableLayout}
          withName={withName}
          withPrice={withPrice}
        />
      )}
      ListFooterComponent={
        withFooter ? <TokenListFooter tableLayout={tableLayout} /> : null
      }
    />
  );
}

export { TokenListView };

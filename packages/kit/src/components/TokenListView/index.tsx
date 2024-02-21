import { ListView } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenListAtom } from '../../states/jotai/contexts/tokenList';
import { EmptyToken } from '../Empty/EmptyToken';
import { ListLoading } from '../Loading';

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
  initialized?: boolean;
};

function TokenListView(props: IProps) {
  const {
    onContentSizeChange,
    onPressToken,
    tableLayout,
    withHeader,
    withFooter,
    withPrice,
    isLoading,
    initialized,
  } = props;

  const [tokenList] = useTokenListAtom();
  const { tokens } = tokenList;

  if (!initialized && isLoading) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  return (
    <ListView
      estimatedItemSize={48}
      scrollEnabled={platformEnv.isWebTouchable}
      data={tokens}
      ListHeaderComponent={
        withHeader && tokens.length > 0 ? (
          <TokenListHeader tokens={tokens} tableLayout={tableLayout} />
        ) : null
      }
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={EmptyToken}
      renderItem={({ item, index }) => (
        <TokenListItem
          token={item}
          key={item.$key}
          index={index}
          onPress={onPressToken}
          tableLayout={tableLayout}
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

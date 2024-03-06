import { ListView, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getFilteredTokenBySearchKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  useSearchKeyAtom,
  useTokenListAtom,
  useTokenListInitializedAtom,
} from '../../states/jotai/contexts/tokenList';
import { EmptySearch } from '../Empty';
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
  } = props;

  const [tokenList] = useTokenListAtom();
  const [initialized] = useTokenListInitializedAtom();
  const [searchKey] = useSearchKeyAtom();
  const { tokens } = tokenList;

  const filteredTokens = getFilteredTokenBySearchKey({ tokens, searchKey });

  if (!initialized && isLoading) {
    return <ListLoading onContentSizeChange={onContentSizeChange} />;
  }

  return (
    <ListView
      py="$3"
      estimatedItemSize={48}
      scrollEnabled={platformEnv.isWebTouchable}
      data={filteredTokens}
      ListHeaderComponent={
        withHeader && tokens.length > 0 ? (
          <TokenListHeader
            filteredTokens={filteredTokens}
            tokens={tokens}
            tableLayout={tableLayout}
          />
        ) : null
      }
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={searchKey ? EmptySearch : EmptyToken}
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
        <Stack pb="$5">
          {withFooter ? <TokenListFooter tableLayout={tableLayout} /> : null}
        </Stack>
      }
    />
  );
}

export { TokenListView };

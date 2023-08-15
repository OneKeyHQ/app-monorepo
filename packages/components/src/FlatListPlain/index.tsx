import { Fragment, memo } from 'react';

import { isArray } from 'lodash';

import Box from '../Box';
import { createFlatListDefaultProps } from '../FlatList';

import type { FlatListProps } from '../FlatList';

function FlatListPlainCmp<T>(props: FlatListProps<T>) {
  const {
    testID,
    style,
    contentContainerStyle,
    data,
    renderItem,
    ListHeaderComponent,
    ItemSeparatorComponent,
    ListEmptyComponent,
    ListFooterComponent,
    keyExtractor,
    extraData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    showsVerticalScrollIndicator,
  } = props;
  const isEmpty = !data || data?.length <= 0;

  return (
    <Box testID={testID} style={style} key={extraData}>
      <Box
        style={
          //   undefined
          contentContainerStyle
        }
      >
        {ListHeaderComponent}

        {isEmpty ? ListEmptyComponent : null}

        {isArray(data) && data
          ? data.map((item: T, index) => (
              <Fragment key={keyExtractor?.(item, index)}>
                {index !== 0 ? (
                  // @ts-ignore
                  <ItemSeparatorComponent />
                ) : null}
                <Box>
                  {renderItem?.({
                    item,
                    index,
                    separators: undefined as any,
                  })}
                </Box>
              </Fragment>
            ))
          : null}

        {ListFooterComponent}
      </Box>
    </Box>
  );
}
FlatListPlainCmp.defaultProps = createFlatListDefaultProps({
  testID: 'FlatListPlain-default',
});

export const FlatListPlain = memo(FlatListPlainCmp);

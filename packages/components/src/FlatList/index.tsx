import { FlatList } from 'native-base';

import type { IFlatListProps } from 'native-base/lib/typescript/components/basic/FlatList/types';

export type FlatListProps<T = unknown> = IFlatListProps<T>;

export function createFlatListDefaultProps({ testID }: { testID: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    // @ts-ignore
    ...(FlatList.defaultProps || {}),
    testID,
  };
}

// @ts-ignore
FlatList.defaultProps = createFlatListDefaultProps({
  testID: 'FlatList-default',
});

export default FlatList;
export const FlatListRef = FlatList;

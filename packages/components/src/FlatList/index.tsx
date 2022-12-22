import { FlatList } from 'native-base';

import type { IFlatListProps } from 'native-base/lib/typescript/components/basic/FlatList/types';

export type FlatListProps<T = unknown> = IFlatListProps<T>;
// @ts-ignore
FlatList.defaultProps = {
  testID: 'FlatList-default',
  // @ts-ignore
  ...(FlatList.defaultProps || {}),
};

export default FlatList;
export const FlatListRef = FlatList;

import { FlatList } from 'native-base';

import type { IFlatListProps } from 'native-base/lib/typescript/components/basic/FlatList/types';

export type FlatListProps<T = unknown> = IFlatListProps<T>;
export default FlatList;
export const FlatListRef = FlatList;

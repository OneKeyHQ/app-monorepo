import { FlatList } from 'native-base';
import { IFlatListProps } from 'native-base/lib/typescript/components/basic/FlatList/types';

// TODO need update native-base to >= 3.4 to use generic type on IFlatListProps
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type FlatListProps<T = unknown> = IFlatListProps;
export default FlatList;
export const FlatListRef = FlatList;

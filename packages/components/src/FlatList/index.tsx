import React from 'react';

import { FlatList as NBFlatList, StyledProps } from 'native-base';

import type { FlatListProps as RNFlatListProps } from 'react-native';

export type FlatListProps<T> = StyledProps & RNFlatListProps<T>;

function FlatList<T>(props: FlatListProps<T>) {
  return <NBFlatList {...props} />;
}

// TODO ts 类型推断不生效, 生效后可合并为一个。
function FlatListInner<T>(
  props: FlatListProps<T>,
  ref: React.ForwardedRef<FlatListProps<T>>,
) {
  return <NBFlatList ref={ref} {...props} />;
}

const FlatListRef = React.forwardRef(FlatListInner);
FlatListRef.displayName = 'FlatList';

export default FlatList;
export { FlatListRef };

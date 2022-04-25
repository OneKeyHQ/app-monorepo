import React from 'react';

import { FlatList as NBFlatList, StyledProps } from 'native-base';

import type { FlatListProps } from 'react-native';

type Props<T> = StyledProps & FlatListProps<T>;

function FlatList<T>(props: Props<T>) {
  return <NBFlatList {...props} />;
}

// TODO ts 类型推断不生效, 生效后可合并为一个。
function FlatListInner<T>(props: Props<T>, ref: React.ForwardedRef<Props<T>>) {
  return <NBFlatList ref={ref} {...props} />;
}

const FlatListRef = React.forwardRef(FlatListInner);
FlatListRef.displayName = 'FlatList';

export default FlatList;
export { FlatListRef };

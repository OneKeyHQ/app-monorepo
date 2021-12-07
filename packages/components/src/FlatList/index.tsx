import React from 'react';
import { FlatList as NBFlatList, StyledProps } from 'native-base';
import type { FlatListProps } from 'react-native';

type Props<T> = StyledProps & FlatListProps<T>;

function FlatList<T>(props: Props<T>) {
  return <NBFlatList {...props} />;
}

export default FlatList;

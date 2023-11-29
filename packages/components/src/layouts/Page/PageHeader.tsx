import { useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Stack } from '../../primitives';

import type { IStackNavigationOptions } from '../Navigation';

export type IPageHeaderProps = IStackNavigationOptions;

export function PageHeader(props: IPageHeaderProps) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions(props);
  }, [navigation, props]);

  return <Stack />;
}

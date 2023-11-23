import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { IStackNavigationOptions } from '../Navigation';

export type IPageHeaderProps = IStackNavigationOptions;

export function PageHeader(props: IPageHeaderProps) {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions(props);
  }, [navigation, props]);
  return null;
}

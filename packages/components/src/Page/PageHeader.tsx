import { useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { StackNavigationOptions } from '@react-navigation/stack';

export type IPageHeaderProps = StackNavigationOptions;

export function PageHeader(props: IPageHeaderProps) {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions(props);
  }, [props]);

  return null;
}

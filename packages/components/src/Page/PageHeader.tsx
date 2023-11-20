import { useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';

import { navigationRef } from '../Navigation/Navigator/NavigationContainer';

import type { StackNavigationOptions } from '@react-navigation/stack';

export type IPageHeaderProps = StackNavigationOptions;

export function PageHeader(props: IPageHeaderProps) {
  const navigation = useNavigation();
  const ref = useRef<object | undefined>();
  useEffect(() => {
    if (!ref.current) {
      ref.current = navigationRef.current?.getCurrentOptions();
    }
    navigation.setOptions(props);
    return () => {
      if (ref.current) {
        navigation.setOptions(ref.current);
      }
    };
  }, [navigation, props]);

  return null;
}

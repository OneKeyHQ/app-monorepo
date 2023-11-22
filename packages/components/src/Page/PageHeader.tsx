import { useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';

import { navigationRef } from '../Navigation/Navigator/NavigationContainer';

import type { IStackNavigationOptions } from '../Navigation';

export type IPageHeaderProps = IStackNavigationOptions;

export function PageHeader(props: IPageHeaderProps) {
  const navigation = useNavigation();
  const ref = useRef<IPageHeaderProps | undefined>();
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
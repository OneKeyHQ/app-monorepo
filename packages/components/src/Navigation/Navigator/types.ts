import type { ComponentType } from 'react';

import type { RouteProp } from '@react-navigation/core/lib/typescript/src/types';
import type { NavigationProp } from '@react-navigation/native';
import type { ParamListBase } from '@react-navigation/routers';

export type CommonScreenOptions = {
  showHeader?: boolean;
};

export interface ScreenProps<P extends ParamListBase> {
  route: RouteProp<P, keyof P>;
  navigation: NavigationProp<P>;
}

export interface CommonNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> {
  name: RouteName;
  component: (() => JSX.Element) | ComponentType<any>;
  options?:
    | CommonScreenOptions
    | ((props: {
        route: RouteProp<P, RouteName>;
        navigation: any;
      }) => CommonScreenOptions);
}

import type { ComponentType } from 'react';

import type { RouteProp } from '@react-navigation/core/lib/typescript/src/types';
import type { ParamListBase } from '@react-navigation/routers';

export type CommonScreenOptions = {
  showHeader?: boolean;
};

export interface CommonNavigatorConfig<P extends ParamListBase> {
  name: keyof P;
  component: ComponentType;
  options?:
    | CommonScreenOptions
    | ((props: {
        route: RouteProp<any>;
        navigation: any;
      }) => CommonScreenOptions);
}

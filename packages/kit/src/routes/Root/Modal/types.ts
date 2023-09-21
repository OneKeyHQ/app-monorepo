import type { ComponentType } from 'react';

import type { RouteProp } from '@react-navigation/core';

export type ModalRoutesType<T> = {
  name: T;
  component:
    | ComponentType<{
        route: RouteProp<any, any>;
        navigation: any;
      }>
    | ComponentType<any>;
}[];

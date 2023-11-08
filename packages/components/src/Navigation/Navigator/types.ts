import type { ComponentType } from 'react';

import type { IICON_NAMES } from '../../Icon';
import type { LocaleIds } from '../../locale';
import type { RouteProp } from '@react-navigation/core/lib/typescript/src/types';
import type { ParamListBase } from '@react-navigation/routers';

export type CommonScreenOptions = {
  showHeader?: boolean;
};

export interface TabSubNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase = ParamListBase,
> extends CommonNavigatorConfig<RouteName, P> {
  translationId?: LocaleIds;
  headerShown?: boolean;
  disable?: boolean;
}

export interface TabNavigatorConfig<RouteName extends string> {
  name: RouteName;
  tabBarIcon: (focused?: boolean) => IICON_NAMES;
  translationId: LocaleIds;
  children: TabSubNavigatorConfig<any, any>[];
  freezeOnBlur?: boolean;
  disable?: boolean;
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

export interface ITabNavigatorExtraConfig<RouteName extends string> {
  name: RouteName;
  children: TabSubNavigatorConfig<any, any>[];
  freezeOnBlur?: boolean;
}

export interface TabNavigatorProps<RouteName extends string> {
  config: TabNavigatorConfig<RouteName>[];
  extraConfig?: ITabNavigatorExtraConfig<RouteName>;
}

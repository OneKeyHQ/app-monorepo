import type { ComponentType } from 'react';

import type { IActionListSection } from '../../ActionList';
import type { IICON_NAMES } from '../../Icon';
import type { ILocaleIds } from '../../locale';
import type { RouteProp } from '@react-navigation/core/lib/typescript/src/types';
import type { ParamListBase } from '@react-navigation/routers';
import type { Animated, StyleProp, ViewStyle } from 'react-native';

export type ICommonScreenOptions = {
  showHeader?: boolean;
};

export interface ITabSubNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase = ParamListBase,
> extends ICommonNavigatorConfig<RouteName, P> {
  translationId?: ILocaleIds;
  headerShown?: boolean;
  disable?: boolean;
}

export interface ITabNavigatorConfig<RouteName extends string> {
  name: RouteName;
  tabBarIcon: (focused?: boolean) => IICON_NAMES;
  translationId: ILocaleIds;
  children: ITabSubNavigatorConfig<any, any>[];
  freezeOnBlur?: boolean;
  disable?: boolean;
  tabBarStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  actionList?: IActionListSection[];
}

export interface ICommonNavigatorConfig<
  RouteName extends string,
  P extends ParamListBase,
> {
  name: RouteName;
  component: (() => JSX.Element) | ComponentType<any>;
  options?:
    | ICommonScreenOptions
    | ((props: {
        route: RouteProp<P, RouteName>;
        navigation: any;
      }) => ICommonScreenOptions);
}

export interface ITabNavigatorExtraConfig<RouteName extends string> {
  name: RouteName;
  children: ITabSubNavigatorConfig<any, any>[];
  freezeOnBlur?: boolean;
}

export interface ITabNavigatorProps<RouteName extends string> {
  config: ITabNavigatorConfig<RouteName>[];
  extraConfig?: ITabNavigatorExtraConfig<RouteName>;
}

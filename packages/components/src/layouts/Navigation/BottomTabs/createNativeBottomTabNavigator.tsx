/* eslint-disable @typescript-eslint/naming-convention */
import {
  type DefaultNavigatorOptions,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type StaticConfig,
  type TabActionHelpers,
  type TabNavigationState,
  TabRouter,
  type TabRouterOptions,
  type TypedNavigator,
  createNavigatorFactory,
  useNavigationBuilder,
  useTheme,
} from '@react-navigation/native';

import { NativeBottomTabView } from './NativeBottomTabView';

import type {
  NativeBottomTabNavigationConfig,
  NativeBottomTabNavigationEventMap,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationProp,
} from './types';

export type NativeBottomTabNavigatorProps = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationEventMap,
  NativeBottomTabNavigationProp<ParamListBase>
> &
  TabRouterOptions &
  NativeBottomTabNavigationConfig;

function NativeBottomTabNavigator({
  id,
  initialRouteName,
  backBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  tabBarActiveTintColor: customActiveTintColor,
  tabBarInactiveTintColor: customInactiveTintColor,
  ...rest
}: NativeBottomTabNavigatorProps) {
  const { colors } = useTheme();
  const activeTintColor =
    customActiveTintColor === undefined
      ? colors.primary
      : customActiveTintColor;

  const inactiveTintColor =
    customInactiveTintColor === undefined
      ? colors.text
      : customInactiveTintColor;

  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder<
      TabNavigationState<ParamListBase>,
      TabRouterOptions,
      TabActionHelpers<ParamListBase>,
      NativeBottomTabNavigationOptions,
      NativeBottomTabNavigationEventMap
    >(TabRouter, {
      id,
      initialRouteName,
      backBehavior,
      children,
      layout,
      screenListeners,
      screenOptions,
    });

  return (
    <NavigationContent>
      <NativeBottomTabView
        {...rest}
        tabBarActiveTintColor={activeTintColor}
        tabBarInactiveTintColor={inactiveTintColor}
        state={state}
        navigation={navigation}
        descriptors={descriptors}
      />
    </NavigationContent>
  );
}

export function createNativeBottomTabNavigator<
  const ParamList extends ParamListBase,
  const NavigatorID extends string | undefined = undefined,
  const TypeBag extends NavigatorTypeBagBase = {
    ParamList: ParamList;
    NavigatorID: NavigatorID;
    State: TabNavigationState<ParamList>;
    ScreenOptions: NativeBottomTabNavigationOptions;
    EventMap: NativeBottomTabNavigationEventMap;
    NavigationList: {
      [RouteName in keyof ParamList]: NativeBottomTabNavigationProp<
        ParamList,
        RouteName,
        NavigatorID
      >;
    };
    Navigator: typeof NativeBottomTabNavigator;
  },
  const Config extends StaticConfig<TypeBag> = StaticConfig<TypeBag>,
>(config?: Config): TypedNavigator<TypeBag, Config> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return createNavigatorFactory(NativeBottomTabNavigator)(config);
}

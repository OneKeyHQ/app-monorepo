/* eslint-disable @typescript-eslint/naming-convention */
import type TabView from '@onekeyfe/react-native-tab-view';
import type { AppleIcon, TabRole } from '@onekeyfe/react-native-tab-view';
import type {
  Descriptor,
  NavigationHelpers,
  NavigationProp,
  ParamListBase,
  RouteProp,
  TabActionHelpers,
  TabNavigationState,
} from '@react-navigation/native';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

export type NativeBottomTabNavigationEventMap = {
  /**
   * Event which fires on tapping on the tab in the tab bar.
   */
  tabPress: { data: undefined; canPreventDefault: true };
  /**
   * Event which fires on long press on tab bar.
   */
  tabLongPress: { data: undefined };
};

export type NativeBottomTabNavigationHelpers = NavigationHelpers<
  ParamListBase,
  NativeBottomTabNavigationEventMap
> &
  TabActionHelpers<ParamListBase>;

export type NativeBottomTabNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
  NavigatorID extends string | undefined = undefined,
> = NavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  TabNavigationState<ParamList>,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationEventMap
> &
  TabActionHelpers<ParamList>;

export type NativeBottomTabScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: NativeBottomTabNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type NativeBottomTabNavigationOptions = {
  /**
   * Title text for the screen.
   */
  title?: string;

  /**
   * Label text of the tab displayed in the navigation bar. When undefined, scene title is used.
   */
  tabBarLabel?: string;

  /**
   * Function that given { focused: boolean } returns ImageSource or AppleIcon to display in the navigation bar.
   */
  tabBarIcon?: (props: { focused: boolean }) => ImageSourcePropType | AppleIcon;

  /**
   * Whether the tab bar item is visible. Defaults to true.
   */
  tabBarItemHidden?: boolean;

  /**
   * Badge to show on the tab icon.
   */
  tabBarBadge?: string;

  /**
   * Badge background color. (Android only)
   */
  tabBarBadgeBackgroundColor?: string;

  /**
   * Badge text color. (Android only)
   */
  tabBarBadgeTextColor?: string;

  /**
   * Whether this screens should render the first time it's accessed. Defaults to true. Set it to false if you want to render the screen on initial render.
   */
  lazy?: boolean;

  /**
   * Active tab color.
   */
  tabBarActiveTintColor?: string;

  /**
   * TestID for the tab.
   */
  tabBarButtonTestID?: string;

  /**
   * Role for the tab. (iOS only)
   */
  role?: TabRole;

  /**
   * Whether inactive screens should be suspended from re-rendering. Defaults to `false`.
   */
  freezeOnBlur?: boolean;

  /**
   * Style object for the component wrapping the screen content.
   */
  sceneStyle?: StyleProp<ViewStyle>;
  /**
   * Whether to prevent default action of the tab. Defaults to `false`.
   */
  preventsDefault?: boolean;
};

export type NativeBottomTabDescriptor = Descriptor<
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationProp<ParamListBase>,
  RouteProp<ParamListBase>
>;

export type NativeBottomTabDescriptorMap = Record<
  string,
  NativeBottomTabDescriptor
>;

export type BottomTabBarProps = {
  state: TabNavigationState<ParamListBase>;
  descriptors: NativeBottomTabDescriptorMap;
  navigation: NavigationHelpers<
    ParamListBase,
    NativeBottomTabNavigationEventMap
  >;
};

export type NativeBottomTabNavigationConfig = Partial<
  Omit<
    React.ComponentProps<typeof TabView>,
    | 'navigationState'
    | 'onIndexChange'
    | 'renderScene'
    | 'getLazy'
    | 'getIcon'
    | 'getLabelText'
    | 'getBadge'
    | 'getBadgeBackgroundColor'
    | 'getBadgeTextColor'
    | 'onTabLongPress'
    | 'getActiveTintColor'
    | 'getHidden'
    | 'getTestID'
    | 'getRole'
    | 'tabBar'
    | 'getFreezeOnBlur'
    | 'getSceneStyle'
    | 'getPreventsDefault'
  >
> & {
  /**
   * Whether the tab bar is hidden.
   */
  tabBarHidden?: boolean;
  tabBar?: (props: BottomTabBarProps) => React.ReactNode;
};

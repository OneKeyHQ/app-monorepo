import type {
  IPageNavigationProp,
  IStackNavigationOptions,
} from '../ScreenProps';
import type {
  Descriptor,
  NavigationHelpers,
  ParamListBase,
  Route,
  RouteProp,
} from '@react-navigation/native';

export type IScene = {
  route: Route<string>;
  focused: boolean;
  color?: string;
};

export type IModalNavigationConfig = NonNullable<unknown>;

export type IModalNavigationOptions = IStackNavigationOptions & {
  shouldPopOnClickBackdrop?: boolean;
  dismissOnOverlayPress?: boolean;
  /**
   * Web-only. When true, the modal enter/exit animation skips the
   * `scale(0.95) -> scale(1)` transform and keeps only the opacity fade.
   * Use for modals that visually behave like popovers where the scale
   * animation causes child elements (e.g. avatars, right-edge buttons)
   * to appear to "jump" outward during the bouncy easing.
   *
   * Only consumed by `createWebModalNavigator` (desktop/web). On native,
   * this flag is ignored because the modal uses translateY-based
   * animation instead of scale.
   */
  disableEnterScaleAnimation?: boolean;
};

export type IModalNavigationEventMap = {
  /**
   * Event which fires when the orientation changes while the modal is being displayed.
   * The orientation provided is only 'portrait' or 'landscape'.
   * This event also fires on initial render, regardless of the current orientation.
   * Only supported on iOS.
   */
  orientationChange: {
    data: {
      orientation: 'portrait' | 'landscape';
    };
  };
};

export type IModalNavigationHelpers = NavigationHelpers<
  ParamListBase,
  IModalNavigationEventMap
>;

export type IModalNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = IPageNavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  IModalNavigationOptions
>;

export type IModalScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: IModalNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type IModalDescriptor = Descriptor<
  ParamListBase,
  IModalNavigationProp<ParamListBase>,
  RouteProp<ParamListBase>
>;

export type IModalDescriptorMap = {
  [key: string]: IModalDescriptor;
};

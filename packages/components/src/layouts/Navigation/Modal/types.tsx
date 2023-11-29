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
  allowDisableClose?: boolean;
  disableClose?: boolean;
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

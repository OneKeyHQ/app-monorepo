import type {
  PageNavigationProp,
  StackNavigationOptions,
} from '../ScreenProps';
import type {
  Descriptor,
  NavigationHelpers,
  ParamListBase,
  Route,
  RouteProp,
} from '@react-navigation/native';

export type Scene = {
  route: Route<string>;
  focused: boolean;
  color?: string;
};

export type ModalNavigationConfig = NonNullable<unknown>;

export type ModalNavigationOptions = StackNavigationOptions & {
  disableClose?: boolean;
};

export type ModalNavigationEventMap = {
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

export type ModalNavigationHelpers = NavigationHelpers<
  ParamListBase,
  ModalNavigationEventMap
>;

export type ModalNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = PageNavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  ModalNavigationOptions
>;

export type ModalScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: ModalNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type ModalDescriptor = Descriptor<
  ParamListBase,
  ModalNavigationProp<ParamListBase>,
  RouteProp<ParamListBase>
>;

export type ModalDescriptorMap = {
  [key: string]: ModalDescriptor;
};

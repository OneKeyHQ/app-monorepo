import type { ComponentProps } from 'react';

import type {
  Descriptor,
  NavigationHelpers,
  NavigationProp,
  ParamListBase,
  Route,
  RouteProp,
  StackActionHelpers,
  StackNavigationState,
} from '@react-navigation/native';
import type { Modal } from 'react-native';

export type Scene = {
  route: Route<string>;
  focused: boolean;
  color?: string;
};

export type ModalNavigationConfig = NonNullable<unknown>;

export type ModalNavigationOptions = Omit<
  ComponentProps<typeof Modal>,
  'visible' | 'onDismiss' | 'onOrientationChange' | 'onRequestClose' | 'onShow'
> & {
  key: string;
  name: string;
  path?: string;
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
> = NavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  StackNavigationState<ParamList>,
  ModalNavigationOptions,
  ModalNavigationEventMap
> &
  StackActionHelpers<ParamList>;

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
  ModalNavigationOptions
>;

export type ModalDescriptorMap = {
  [key: string]: ModalDescriptor;
};

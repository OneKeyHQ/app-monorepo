import type { ComponentProps, ReactElement } from 'react';

import type { HeaderButtonGroup } from './Header';
import type HeaderButtonIcon from './Header/HeaderButtonIcon';
import type {
  NavigationProp,
  StackActionHelpers,
  StackNavigationState,
} from '@react-navigation/core';
import type { ParamListBase, Route, RouteProp } from '@react-navigation/native';
import type {
  HeaderButtonProps,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack/src/types';
import type { StackNavigationEventMap } from '@react-navigation/stack';
import type {
  NativeSyntheticEvent,
  TargetedEvent,
  TextInputFocusEventData,
} from 'react-native';

export interface SearchBarProps {
  /**
   * The auto-capitalization behavior
   */
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  /**
   * The search field background color
   */
  barTintColor?: string;
  /**
   * Sets type of the input. Defaults to `text`.
   */
  inputType?: 'text' | 'phone' | 'number' | 'email';
  /**
   * A callback that gets called when search bar has lost focus
   */
  onBlur?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
  /**
   * A callback that gets called when the text changes. It receives the current text value of the search bar.
   */
  onChangeText?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  /**
   * A callback that gets called when search bar has received focus
   */
  onFocus?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
  /**
   * A callback that gets called when the search button is pressed. It receives the current text value of the search bar.
   */
  onSearchButtonPress?: (
    e: NativeSyntheticEvent<TextInputFocusEventData>,
  ) => void;
  /**
   * Text displayed when search field is empty
   */
  placeholder?: string;
  /**
   * The search field text color
   */
  textColor?: string;
  /**
   * The search hint text color
   *
   * @plaform android
   */
  hintTextColor?: string;
  /**
   * The search and close icon color shown in the header
   *
   * @plaform android
   */
  headerIconColor?: string;
  /**
   * Show the search hint icon when search bar is focused
   *
   * @plaform android
   * @default true
   */
  shouldShowHintSearchIcon?: boolean;
}

export type StackHeaderProps = {
  back?: {
    title: string;
  };
  options: StackNavigationOptions;
  route: Route<string>;
  navigation: PageNavigationProp<ParamListBase>;
};

export type StackNavigationOptions = Omit<
  NativeStackNavigationOptions,
  'headerRight' | 'headerSearchBarOptions'
> & {
  headerSearchBarOptions?: SearchBarProps;
  headerRight?: (
    props: HeaderButtonProps,
  ) => ReactElement<
    | ComponentProps<typeof HeaderButtonIcon>
    | ComponentProps<typeof HeaderButtonGroup>
  >;
};

export type PageScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: PageNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type PageNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = NavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  StackNavigationState<ParamList>,
  StackNavigationOptions,
  StackNavigationEventMap
> &
  StackActionHelpers<ParamList>;

export type ModalScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: ModalNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type ModalNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
> = PageNavigationProp<ParamList, RouteName, NavigatorID> & {
  close: boolean;
};

import type { ComponentProps, ReactElement } from 'react';

import type { HeaderButtonGroup } from './Header';
import type HeaderIconButton from './Header/HeaderIconButton';
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

export type {
  IModalScreenProps,
  IModalNavigationProp,
  IModalNavigationOptions,
} from './Modal/types';

export interface INavSearchBarProps {
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
  hideNavigationBar?: boolean;

  // If this property is set to true, please ensure that `ScrollView.contentInsetAdjustmentBehavior` is set to `automatic`.
  hideWhenScrolling?: boolean;
  autoFocus?: boolean;
  cancelButtonText?: string;
}

export type IStackHeaderProps = {
  back?: {
    title: string;
  };
  options: IStackNavigationOptions;
  route: Route<string>;
  navigation: IPageNavigationProp<ParamListBase>;
};

export type IStackNavigationOptions = Omit<
  NativeStackNavigationOptions,
  'headerRight' | 'headerSearchBarOptions'
> & {
  // If this property is set, please ensure that `Page.skipLoading` is set to `platformEnv.isNativeIOS`.
  headerSearchBarOptions?: INavSearchBarProps;
  headerRight?: (
    props: HeaderButtonProps,
  ) => ReactElement<
    | ComponentProps<typeof HeaderIconButton>
    | ComponentProps<typeof HeaderButtonGroup>
  >;
};

export type IPageScreenProps<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
  NavigatorID extends string | undefined = undefined,
> = {
  navigation: IPageNavigationProp<ParamList, RouteName, NavigatorID>;
  route: RouteProp<ParamList, RouteName>;
};

export type IPageNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = string,
  NavigatorID extends string | undefined = undefined,
  Options extends IStackNavigationOptions = IStackNavigationOptions,
> = NavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  StackNavigationState<ParamList>,
  Options,
  StackNavigationEventMap
> &
  StackActionHelpers<ParamList>;

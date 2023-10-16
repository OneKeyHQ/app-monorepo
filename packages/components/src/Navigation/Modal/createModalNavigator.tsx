import * as React from 'react';

import {
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';

import ModalStack from './ModalStack';

import type {
  ModalNavigationConfig,
  ModalNavigationEventMap,
  ModalNavigationOptions,
} from './types';
import type {
  DefaultNavigatorOptions,
  ParamListBase,
  StackActionHelpers,
  StackNavigationState,
  StackRouterOptions,
} from '@react-navigation/native';

type Props = DefaultNavigatorOptions<
  ParamListBase,
  StackNavigationState<ParamListBase>,
  ModalNavigationOptions,
  ModalNavigationEventMap
> &
  StackRouterOptions &
  ModalNavigationConfig;

function ModalNavigator({
  initialRouteName,
  children,
  screenOptions,
  ...rest
}: Props) {
  const { state, descriptors, navigation } = useNavigationBuilder<
    StackNavigationState<ParamListBase>,
    StackRouterOptions,
    StackActionHelpers<ParamListBase>,
    ModalNavigationOptions,
    ModalNavigationEventMap
  >(StackRouter, {
    initialRouteName,
    children,
    screenOptions,
  });

  return (
    <ModalStack
      {...rest}
      state={state}
      // @ts-expect-error
      descriptors={descriptors}
      navigation={navigation}
    />
  );
}

export default createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  ModalNavigationOptions,
  ModalNavigationEventMap,
  typeof ModalNavigator
>(ModalNavigator);

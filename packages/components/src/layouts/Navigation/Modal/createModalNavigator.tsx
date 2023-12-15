import { useCallback, useEffect } from 'react';

import {
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackView } from '@react-navigation/stack';
import { Animated } from 'react-native';
import { useMedia } from 'tamagui';

import { useBackHandler } from '../../../hooks';
import { Stack } from '../../../primitives/Stack';

import type {
  IModalNavigationConfig,
  IModalNavigationEventMap,
  IModalNavigationOptions,
} from './types';
import type {
  DefaultNavigatorOptions,
  ParamListBase,
  StackActionHelpers,
  StackNavigationState,
  StackRouterOptions,
} from '@react-navigation/native';

const ROOT_NAVIGATION_INDEX_VALUE = new Animated.Value(0);
let ROOT_NAVIGATION_INDEX_LISTENER: (() => void) | undefined;

type IProps = DefaultNavigatorOptions<
  ParamListBase,
  StackNavigationState<ParamListBase>,
  IModalNavigationOptions,
  IModalNavigationEventMap
> &
  StackRouterOptions &
  IModalNavigationConfig;

function ModalNavigator({
  initialRouteName,
  children,
  screenOptions,
  ...rest
}: IProps) {
  const media = useMedia();
  const { state, descriptors, navigation, NavigationContent } =
    useNavigationBuilder<
      StackNavigationState<ParamListBase>,
      StackRouterOptions,
      StackActionHelpers<ParamListBase>,
      IModalNavigationOptions,
      IModalNavigationEventMap
    >(StackRouter, {
      initialRouteName,
      children,
      screenOptions,
    });

  const goBackCall = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBackPress = useCallback(() => {
    const currentRoute = state.routes[state.index];
    const descriptor = descriptors[currentRoute.key];
    const { disableClose }: { disableClose?: boolean } = descriptor.options;

    if (disableClose) {
      return true;
    }
    if (navigation.isFocused()) goBackCall();
    return true;
  }, [state.routes, state.index, descriptors, navigation, goBackCall]);

  useBackHandler(handleBackPress);

  const descriptor = descriptors[state.routes?.[state.index].key];
  const handleBackdropClick = useCallback(() => {
    if (!descriptor.options.disableClose) {
      navigation.goBack();
    }
  }, [navigation, descriptor]);

  const rootNavigation = navigation.getParent()?.getParent?.();
  const currentRouteIndex = rootNavigation?.getState?.().index ?? 0;

  useEffect(() => {
    if (ROOT_NAVIGATION_INDEX_LISTENER) {
      return;
    }
    ROOT_NAVIGATION_INDEX_LISTENER = rootNavigation?.addListener(
      'state',
      () => {
        Animated.timing(ROOT_NAVIGATION_INDEX_VALUE, {
          duration: 150,
          toValue: rootNavigation?.getState?.().index ?? 0,
          useNativeDriver: false,
        }).start();
      },
    );
    return () => {};
  }, [rootNavigation]);

  return (
    <NavigationContent>
      <Stack
        onPress={handleBackdropClick}
        flex={1}
        $gtMd={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Animated.View
          style={{
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            transform: media.gtMd
              ? [
                  {
                    translateY: Animated.multiply(
                      Animated.subtract(
                        ROOT_NAVIGATION_INDEX_VALUE,
                        currentRouteIndex,
                      ),
                      -30,
                    ),
                  },
                  {
                    scale: Animated.add(
                      1,
                      Animated.multiply(
                        -0.05,
                        Animated.subtract(
                          ROOT_NAVIGATION_INDEX_VALUE,
                          currentRouteIndex,
                        ),
                      ),
                    ),
                  },
                ]
              : [],
          }}
        >
          <Stack
            // Prevents bubbling to prevent the background click event from being triggered when clicking on the modal window
            onPress={(e) => e?.stopPropagation()}
            testID="APP-Modal-Screen"
            overflow="hidden"
            width="100%"
            height="100%"
            borderTopStartRadius="$6"
            borderTopEndRadius="$6"
            $gtMd={{
              width: '90%',
              height: '90%',
              maxWidth: '$160',
              maxHeight: '$160',
              borderRadius: '$4',
              outlineWidth: '$px',
              outlineStyle: 'solid',
              outlineColor: '$borderSubdued',
            }}
          >
            <StackView
              {...rest}
              state={state}
              // @ts-expect-error
              descriptors={descriptors}
              navigation={navigation}
            />
          </Stack>
        </Animated.View>
      </Stack>
    </NavigationContent>
  );
}

export default createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  IModalNavigationOptions,
  IModalNavigationEventMap,
  typeof ModalNavigator
>(ModalNavigator);

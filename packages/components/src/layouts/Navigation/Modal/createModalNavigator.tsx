import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackView } from '@react-navigation/stack';
import _ from 'lodash';
import { useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';

import { useBackHandler } from '../../../hooks';
import { Stack, YStack } from '../../../primitives/Stack';

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
import type { TamaguiElement } from 'tamagui';

const MODAL_ANIMATED_VIEW_REF_LIST: TamaguiElement[] = [];
let MODAL_ANIMATED_BACKDROP_VIEW_REF: TamaguiElement | null;
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
  const screenHeight = useWindowDimensions().height;
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

  const descriptor = descriptors[state.routes?.[state.index].key];

  const handleBackPress = useCallback(() => {
    const { disableClose }: { disableClose?: boolean } = descriptor.options;

    if (disableClose) {
      return true;
    }
    if (navigation.isFocused()) goBackCall();
    return true;
  }, [descriptor, navigation, goBackCall]);

  useBackHandler(handleBackPress);

  const handleBackdropClick = useCallback(() => {
    if (!descriptor.options.disableClose) {
      if (descriptor.options.shouldPopOnClickBackdrop) {
        navigation.goBack();
      } else {
        navigation?.getParent?.()?.goBack();
      }
    }
  }, [navigation, descriptor]);

  const rootNavigation = navigation.getParent()?.getParent?.();
  const currentRouteIndex = useMemo(
    () =>
      Math.max(
        _.findLastIndex(
          rootNavigation?.getState?.()?.routes,
          (rootRoute) =>
            state.routes.findIndex(
              // @ts-expect-error
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              (route) => route.name === rootRoute?.params?.params?.screen,
            ) !== -1,
        ) ?? 1,
        1,
      ),
    [rootNavigation, state.routes],
  );

  useEffect(() => {
    if (ROOT_NAVIGATION_INDEX_LISTENER) {
      return;
    }

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    ROOT_NAVIGATION_INDEX_LISTENER = rootNavigation?.addListener(
      'state',
      () => {
        const newIndex = rootNavigation?.getState?.().index ?? 0;
        if (media.gtMd && MODAL_ANIMATED_BACKDROP_VIEW_REF) {
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          MODAL_ANIMATED_BACKDROP_VIEW_REF.style.opacity =
            newIndex >= 1 ? 1 : 0;
        }

        MODAL_ANIMATED_VIEW_REF_LIST.forEach((element, index) => {
          const transform = media.gtMd
            ? {
                translateY: `${
                  newIndex < index ? screenHeight : -30 * (newIndex - index)
                }px`,
                scale: `${1 - 0.05 * (newIndex - index)}`,
              }
            : {
                translateY: `${newIndex < index ? screenHeight : 0}px`,
                scale: '1',
              };
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          element.style.transform = Object.entries(transform)
            .map(([key, value]) => `${key}(${value})`)
            .join(' ');
        });
      },
    );
    return () => {};
  }, [rootNavigation, media, screenHeight]);

  const stackChildrenRefList = useRef<TamaguiElement[]>([]);
  useEffect(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const listener = navigation.addListener('state', () => {
      const newIndex = navigation?.getState?.().index ?? 0;
      stackChildrenRefList.current.forEach((element, routeIndex) => {
        const transform =
          routeIndex <= newIndex ? 'translateX(0px)' : 'translateX(640px)';
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        element.style.transform = transform;
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return listener;
  }, [navigation]);
  state.routes.forEach((route, routeIndex) => {
    const routeDescriptor = descriptors[route.key];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { render } = routeDescriptor;
    routeDescriptor.render = () => (
      <Stack
        ref={(ref) => {
          if (ref) {
            stackChildrenRefList.current[routeIndex] = ref;
          }
        }}
        flex={1}
        bg="$bg"
        style={{
          transform: [{ translateX: routeIndex !== 0 ? 640 : 0 }],
          transition: 'transform .25s ease-in-out',
          willChange: 'transform',
          shadowColor: 'black',
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: -5, height: 0 },
        }}
      >
        {render()}
      </Stack>
    );
  });

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
        {currentRouteIndex <= 1 ? (
          <YStack
            ref={(ref) => (MODAL_ANIMATED_BACKDROP_VIEW_REF = ref)}
            fullscreen
            style={{
              opacity: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              transition: 'opacity .25s ease-in-out',
              willChange: 'opacity',
            }}
          />
        ) : null}

        <Stack
          // Prevents bubbling to prevent the background click event from being triggered when clicking on the modal window
          onPress={(e) => e?.stopPropagation()}
          testID="APP-Modal-Screen"
          bg="$bgApp"
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
          ref={(ref) => {
            if (ref) {
              MODAL_ANIMATED_VIEW_REF_LIST[currentRouteIndex] = ref;
            }
          }}
          style={{
            transform: [{ translateY: screenHeight }],
            transition: 'transform .25s ease-in-out',
            willChange: 'transform',
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

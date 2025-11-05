import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackView } from '@react-navigation/stack';
import _ from 'lodash';
import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/shared/tamagui';
import type { TamaguiElement } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Portal } from '../../../hocs';
import { useBackHandler } from '../../../hooks';
import {
  ModalNavigatorContext,
  createPortalId,
} from '../../../hooks/useModalNavigatorContext';
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
import type { GestureResponderEvent } from 'react-native';

const MODAL_ANIMATED_VIEW_REF_LIST: TamaguiElement[] = [];
let MODAL_ANIMATED_BACKDROP_VIEW_REF: TamaguiElement | null;
let ROOT_NAVIGATION_INDEX_LISTENER: (() => void) | undefined;

type IProps = DefaultNavigatorOptions<
  ParamListBase,
  string,
  StackNavigationState<ParamListBase>,
  IModalNavigationOptions,
  IModalNavigationEventMap,
  any
> &
  StackRouterOptions &
  IModalNavigationConfig;

function OnBoardingModalNavigator({
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

  const handleBackPress = useCallback(() => {
    if (navigation.isFocused()) goBackCall();
    return true;
  }, [navigation, goBackCall]);

  useBackHandler(handleBackPress, true, false);

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
                opacity: newIndex < index ? '0' : '1',
                transition:
                  'opacity 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }
            : {
                opacity: newIndex < index ? '0' : '1',
                transition:
                  'opacity 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              };
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          element.style.opacity = transform.opacity;
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          element.style.transition = transform.transition;
        });
      },
    );
    return () => {};
  }, [rootNavigation, media, screenHeight]);

  const stackChildrenRefList = useRef<TamaguiElement[]>([]);

  const stopPropagation = useCallback((e: GestureResponderEvent) => {
    // Prevents bubbling to prevent the background click event from being triggered when clicking on the modal window
    e?.stopPropagation();
  }, []);

  const isPagePressIn = useRef(false);

  const onPagePressIn = useCallback(() => {
    isPagePressIn.current = true;
  }, []);

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
      >
        {render()}
      </Stack>
    );
  });

  const contextValue = useMemo(
    () => ({
      portalId: createPortalId(),
    }),
    [],
  );

  return (
    <NavigationContent>
      <ModalNavigatorContext.Provider value={contextValue}>
        <>
          <Stack flex={1}>
            <Stack
              onPress={platformEnv.isNative ? stopPropagation : undefined}
              onPressIn={platformEnv.isNative ? undefined : onPagePressIn}
              testID="APP-OnBoarding-Screen"
              className="app-region-no-drag"
              bg="$bgApp"
              overflow="hidden"
              width="100%"
              height="100%"
              borderTopStartRadius="$6"
              borderTopEndRadius="$6"
              ref={(ref) => {
                if (ref) {
                  MODAL_ANIMATED_VIEW_REF_LIST[currentRouteIndex] = ref;
                }
              }}
              style={{
                transition: 'transform .25s cubic-bezier(0.4, 0, 0.2, 1)',
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
          <Portal.Container name={contextValue.portalId} />
        </>
      </ModalNavigatorContext.Provider>
    </NavigationContent>
  );
}

const createOnBoardingNavigator = createNavigatorFactory(
  OnBoardingModalNavigator,
);

export default createOnBoardingNavigator;

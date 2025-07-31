import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import {
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackView } from '@react-navigation/stack';
import _ from 'lodash';
import { useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';
import { useThrottledCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Portal } from '../../../hocs';
import { useBackHandler } from '../../../hooks';
import {
  ModalNavigatorContext,
  createPortalId,
} from '../../../hooks/useModalNavigatorContext';
import { Stack, XStack, YStack } from '../../../primitives/Stack';

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
import type { TamaguiElement } from 'tamagui';

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

const backdropId = 'app-modal-stacks-backdrop';
function WebModalNavigator({
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
    if (navigation.isFocused()) goBackCall();
    return true;
  }, [navigation, goBackCall]);

  useBackHandler(handleBackPress, true, false);

  const handleBackdropClick = useThrottledCallback(() => {
    if (descriptor.options.dismissOnOverlayPress === false) {
      return;
    }
    if (descriptor.options.shouldPopOnClickBackdrop) {
      navigation.goBack();
    } else {
      navigation?.getParent?.()?.goBack();
    }
  }, 350);

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

  useLayoutEffect(() => {
    const element = MODAL_ANIMATED_VIEW_REF_LIST[currentRouteIndex];
    if (element) {
      (
        element as HTMLElement
      ).style.transform = `translateY(${screenHeight}px)`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const stopPropagation = useCallback((e: GestureResponderEvent) => {
    // Prevents bubbling to prevent the background click event from being triggered when clicking on the modal window
    e?.stopPropagation();
  }, []);

  const isPagePressIn = useRef(false);

  const onPageContainerPressIn = useCallback(() => {
    if (!isPagePressIn.current) {
      handleBackdropClick();
    }
  }, [handleBackdropClick]);

  const onPageContainerPressOut = useCallback(() => {
    isPagePressIn.current = false;
  }, []);

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
        style={{
          transform: [{ translateX: routeIndex !== 0 ? 640 : 0 }],
          transition: 'transform .25s cubic-bezier(0.4, 0, 0.2, 1)',
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

  const contextValue = useMemo(
    () => ({
      portalId: createPortalId(),
    }),
    [],
  );

  const isExistBackdrop = useMemo(() => {
    return (
      document.querySelectorAll(`[data-testid="${backdropId}"]`).length > 0
    );
  }, []);

  return (
    <NavigationContent>
      <ModalNavigatorContext.Provider value={contextValue}>
        <>
          <Stack
            flex={1}
            $gtMd={{
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={platformEnv.isNative ? handleBackdropClick : undefined}
            onPressIn={
              platformEnv.isNative ? undefined : onPageContainerPressIn
            }
            onPressOut={
              platformEnv.isNative ? undefined : onPageContainerPressOut
            }
          >
            {currentRouteIndex <= 1 && !isExistBackdrop ? (
              <YStack
                testID={backdropId}
                ref={(ref) => {
                  if (ref) {
                    MODAL_ANIMATED_BACKDROP_VIEW_REF = ref;
                  }
                }}
                fullscreen
                style={{
                  opacity: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  transition: 'opacity .25s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'opacity',
                }}
              >
                {platformEnv.isDesktopMac ? (
                  <XStack
                    style={
                      {
                        WebkitAppRegion: 'drag',
                      } as any
                    }
                    position="absolute"
                    top={0}
                    h={48}
                    left={0}
                    right={0}
                  />
                ) : null}
              </YStack>
            ) : null}

            <Stack
              onPress={platformEnv.isNative ? stopPropagation : undefined}
              onPressIn={platformEnv.isNative ? undefined : onPagePressIn}
              testID="APP-Modal-Screen"
              className="app-region-no-drag"
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

const createWebModalNavigator = createNavigatorFactory(WebModalNavigator);

export default createWebModalNavigator;

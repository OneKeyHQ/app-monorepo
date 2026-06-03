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
import { useThrottledCallback } from 'use-debounce';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import type { TamaguiElement } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

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

const MODAL_ANIMATED_VIEW_REF_LIST: TamaguiElement[] = [];
// Parallel to MODAL_ANIMATED_VIEW_REF_LIST. When the slot value is true,
// the corresponding modal opts out of the `scale(0.95) -> scale(1)` enter
// animation and uses only an opacity fade. Driven by the route option
// `disableEnterScaleAnimation` (see IModalNavigationOptions).
const MODAL_DISABLE_SCALE_LIST: boolean[] = [];
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

function ModalRouteWrapper({
  routeIndex,
  stackChildrenRefList,
  children,
  style,
}: {
  routeIndex: number;
  stackChildrenRefList: React.MutableRefObject<TamaguiElement[]>;
  children: React.ReactNode;
  style: any;
}) {
  const refCallback = useCallback(
    (ref: TamaguiElement | null) => {
      if (ref) {
        stackChildrenRefList.current[routeIndex] = ref;
      }
    },
    [routeIndex, stackChildrenRefList],
  );
  return (
    <Stack ref={refCallback} flex={1} bg="$bg" style={style}>
      {children}
    </Stack>
  );
}

const backdropId = 'app-modal-stacks-backdrop';

const backdropStyle = {
  opacity: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  transition: 'opacity .25s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: 'opacity',
};

const dragRegionStyle = {
  WebkitAppRegion: 'drag',
} as any;

const modalStyleGtMd = {
  transition:
    'opacity .25s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  willChange: 'opacity, transform',
};

const modalStyleMd = {
  transition: 'transform .25s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: 'transform',
};

const routeStyleFirst = {
  transform: [{ translateX: 0 }],
  transition: 'transform .25s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: 'transform',
  shadowColor: 'black',
  shadowOpacity: 0.3,
  shadowRadius: 10,
  shadowOffset: { width: -5, height: 0 },
};

const containerGtMdStyle = {
  justifyContent: 'center',
  alignItems: 'center',
} as const;

const modalScreenGtMdStyle = {
  width: '90%',
  height: '90%',
  maxWidth: '$160',
  maxHeight: '$160',
  borderRadius: '$4',
  outlineWidth: '$px',
  outlineStyle: 'solid',
  outlineColor: '$borderSubdued',
} as const;

const routeStyleNonFirst = {
  transform: [{ translateX: 640 }],
  transition: 'transform .25s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: 'transform',
  shadowColor: 'black',
  shadowOpacity: 0.3,
  shadowRadius: 10,
  shadowOffset: { width: -5, height: 0 },
};
function WebModalNavigator({
  initialRouteName,
  children,
  screenOptions,
  ...rest
}: IProps) {
  const screenHeight = useWindowDimensions().height;
  const media = useMedia();
  const { state, descriptors, navigation, NavigationContent, describe } =
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

  const hasModalRoute = useMemo(() => {
    return (
      rootNavigation
        ?.getState?.()
        ?.routes?.some(
          (route) =>
            route.name === ERootRoutes.Modal ||
            route.name === ERootRoutes.iOSFullScreen,
        ) ?? false
    );
  }, [rootNavigation]);

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

        const bounceIn =
          'opacity .25s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        const easeOut =
          'opacity .2s cubic-bezier(0, 0, 0.2, 1), transform .2s cubic-bezier(0, 0, 0.2, 1)';

        MODAL_ANIMATED_VIEW_REF_LIST.forEach((element, index) => {
          const isHidden = newIndex < index;
          const noScale = MODAL_DISABLE_SCALE_LIST[index];
          if (media.gtMd) {
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            element.style.transition = isHidden ? easeOut : bounceIn;
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            element.style.opacity = isHidden ? '0' : '1';
            let nextTransform: string;
            if (noScale) {
              // Skip the bouncy scale; only translateY for stacked modals.
              nextTransform = isHidden
                ? ''
                : `translateY(${-30 * (newIndex - index)}px)`;
            } else {
              nextTransform = isHidden
                ? 'scale(0.95)'
                : `translateY(${-30 * (newIndex - index)}px) scale(${1 - 0.05 * (newIndex - index)})`;
            }
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            element.style.transform = nextTransform;
          } else {
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            element.style.transform = `translateY(${isHidden ? screenHeight : 0}px)`;
          }
        });
      },
    );
    return () => {};
  }, [rootNavigation, media, screenHeight]);

  const stackChildrenRefList = useRef<TamaguiElement[]>([]);

  // Hoist the opt-out to the WHOLE inner stack rather than just the
  // active descriptor. Otherwise navigating into a child screen
  // (e.g. AccountSelectorStack -> ExportPrivateKeysPage) re-runs the
  // ref callback with the child's descriptor (which usually has the
  // option unset) and flips the slot's `noScale` back to `false` — so
  // a subsequent modal-on-modal push would shrink the underlying stack
  // with `scale(0.95)`, breaking the visual contract of "this modal
  // never scales". If any route in the stack opted out, the whole
  // stack opts out.
  const disableEnterScaleAnimation = state.routes.some(
    (route) => !!descriptors[route.key]?.options?.disableEnterScaleAnimation,
  );
  const modalScreenGtMdStyleMemo = useMemo(
    () => ({
      ...modalScreenGtMdStyle,
      ...(descriptor.options.modalContentMaxHeight
        ? { maxHeight: descriptor.options.modalContentMaxHeight }
        : undefined),
      ...(descriptor.options.modalContentMaxWidth
        ? { maxWidth: descriptor.options.modalContentMaxWidth }
        : undefined),
    }),
    [
      descriptor.options.modalContentMaxHeight,
      descriptor.options.modalContentMaxWidth,
    ],
  );

  useLayoutEffect(() => {
    const element = MODAL_ANIMATED_VIEW_REF_LIST[currentRouteIndex];
    if (element) {
      const el = element as HTMLElement;
      if (media.gtMd) {
        el.style.opacity = '0';
        el.style.transform = disableEnterScaleAnimation ? '' : 'scale(0.95)';
      } else {
        el.style.transform = `translateY(${screenHeight}px)`;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const contentVisibilityTimersRef = useRef<ReturnType<typeof setTimeout>[]>(
    [],
  );
  useEffect(() => {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const listener = navigation.addListener('state', () => {
      const newIndex = navigation?.getState?.().index ?? 0;

      // Clear pending contentVisibility timers to avoid stale updates
      contentVisibilityTimersRef.current.forEach((timer) =>
        clearTimeout(timer),
      );
      contentVisibilityTimersRef.current = [];

      stackChildrenRefList.current.forEach((element, routeIndex) => {
        if (!element) return;
        const transform =
          routeIndex <= newIndex ? 'translateX(0px)' : 'translateX(640px)';
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        element.style.transform = transform;

        if (!platformEnv.isNative) {
          if (routeIndex === newIndex) {
            // Show current route immediately to avoid white flash
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            element.style.contentVisibility = '';
          } else {
            // Delay hiding non-current routes until slide animation completes
            const timer = setTimeout(() => {
              const currentIndex = navigation?.getState?.().index ?? 0;
              if (routeIndex !== currentIndex) {
                // @ts-expect-error
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                element.style.contentVisibility = 'hidden';
              }
            }, 500);
            contentVisibilityTimersRef.current.push(timer);
          }
        }
      });
    });
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      listener?.();
      contentVisibilityTimersRef.current.forEach((timer) =>
        clearTimeout(timer),
      );
      contentVisibilityTimersRef.current = [];
    };
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

  const backdropRefCallback = useCallback((ref: TamaguiElement | null) => {
    if (ref) {
      MODAL_ANIMATED_BACKDROP_VIEW_REF = ref;
    }
  }, []);

  const modalScreenRefCallback = useCallback(
    (ref: TamaguiElement | null) => {
      if (ref) {
        MODAL_ANIMATED_VIEW_REF_LIST[currentRouteIndex] = ref;
        MODAL_DISABLE_SCALE_LIST[currentRouteIndex] =
          disableEnterScaleAnimation;
      }
    },
    [currentRouteIndex, disableEnterScaleAnimation],
  );

  state.routes.forEach((route, routeIndex) => {
    const routeDescriptor = descriptors[route.key];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { render } = routeDescriptor;
    routeDescriptor.render = () => (
      <ModalRouteWrapper
        routeIndex={routeIndex}
        stackChildrenRefList={stackChildrenRefList}
        style={routeIndex !== 0 ? routeStyleNonFirst : routeStyleFirst}
      >
        {render()}
      </ModalRouteWrapper>
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
            $gtMd={containerGtMdStyle}
            onPress={platformEnv.isNative ? handleBackdropClick : undefined}
            onPressIn={
              platformEnv.isNative ? undefined : onPageContainerPressIn
            }
            onPressOut={
              platformEnv.isNative ? undefined : onPageContainerPressOut
            }
          >
            {hasModalRoute && !isExistBackdrop ? (
              <YStack
                testID={backdropId}
                ref={backdropRefCallback}
                fullscreen
                style={backdropStyle}
              >
                {platformEnv.isDesktopMac ? (
                  <XStack
                    style={dragRegionStyle}
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
              $gtMd={modalScreenGtMdStyleMemo}
              ref={modalScreenRefCallback}
              style={media.gtMd ? modalStyleGtMd : modalStyleMd}
            >
              <StackView
                {...rest}
                state={state}
                // @ts-expect-error
                descriptors={descriptors}
                navigation={navigation}
                describe={describe as any}
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

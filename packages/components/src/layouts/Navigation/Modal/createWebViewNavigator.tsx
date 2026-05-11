import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  StackRouter,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/core';
import { StackView } from '@react-navigation/stack';
import _ from 'lodash';
import { useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import type { TamaguiElement } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Portal } from '../../../hocs';
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

// Independent module-level state from createOnBoardingNavigator. The two
// navigators must not share the cross-route opacity-driving listener or
// ref list — otherwise an open WebView overlay would interfere with the
// onboarding stack's enter/exit animations (and vice-versa).
const WEB_VIEW_ANIMATED_VIEW_REF_LIST: TamaguiElement[] = [];
const webViewTransitionStyle = {
  transition: 'transform .25s cubic-bezier(0.4, 0, 0.2, 1)',
  willChange: 'transform',
};
let ROOT_NAVIGATION_INDEX_LISTENER: (() => void) | undefined;

const hiddenContentVisibilityStyle = { contentVisibility: 'hidden' as const };

function RouteWrapper({
  routeIndex,
  isCurrentRoute,
  stackChildrenRefList,
  render,
}: {
  routeIndex: number;
  isCurrentRoute: boolean;
  stackChildrenRefList: React.MutableRefObject<TamaguiElement[]>;
  render: () => React.ReactNode;
}) {
  const refCallback = useCallback(
    (ref: TamaguiElement | null) => {
      if (ref) {
        stackChildrenRefList.current[routeIndex] = ref;
      }
    },
    [stackChildrenRefList, routeIndex],
  );
  const style =
    !platformEnv.isNative && !isCurrentRoute
      ? hiddenContentVisibilityStyle
      : undefined;
  return (
    <Stack ref={refCallback} flex={1} bg="$bg" style={style}>
      {render()}
    </Stack>
  );
}

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

function WebViewModalNavigator({
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

  // Escape / Android-back is handled inside `WebViewPage` itself: it first
  // tries `webview.goBack()` (in-page history), then falls back to
  // `navigation.goBack()` to dismiss the overlay. Registering a duplicate
  // `useBackHandler` here would race with that — a single Escape press would
  // both navigate the WebView back AND close the overlay, losing the user's
  // place. Keep this navigator passive and let the screen own the policy.

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
        WEB_VIEW_ANIMATED_VIEW_REF_LIST.forEach((element, index) => {
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
    const isCurrentRoute = routeIndex === state.index;
    routeDescriptor.render = () => (
      <RouteWrapper
        routeIndex={routeIndex}
        isCurrentRoute={isCurrentRoute}
        stackChildrenRefList={stackChildrenRefList}
        render={render}
      />
    );
  });

  const contextValue = useMemo(
    () => ({
      portalId: createPortalId(),
    }),
    [],
  );

  const webViewRefCallback = useCallback(
    (ref: TamaguiElement | null) => {
      if (ref) {
        WEB_VIEW_ANIMATED_VIEW_REF_LIST[currentRouteIndex] = ref;
      }
    },
    [currentRouteIndex],
  );

  // On desktop the wrapper carries `$bgSidebar` so it visually continues the
  // sidebar's top band, AND so the page body's rounded top corners (set on
  // Page.Body in the consuming page) cut into a contrasting backdrop and
  // become visible. On native there's no sidebar, so use the standard
  // `$bgApp` like a normal stack page.
  const wrapperBg = platformEnv.isDesktop ? '$bgSidebar' : '$bgApp';

  return (
    <NavigationContent>
      <ModalNavigatorContext.Provider value={contextValue}>
        <>
          <Stack flex={1}>
            <Stack
              onPress={platformEnv.isNative ? stopPropagation : undefined}
              onPressIn={platformEnv.isNative ? undefined : onPagePressIn}
              testID="APP-WebView-Screen"
              className="app-region-no-drag"
              bg={wrapperBg}
              overflow="hidden"
              width="100%"
              height="100%"
              ref={webViewRefCallback}
              style={webViewTransitionStyle}
            >
              <StackView
                {...(rest as any)}
                state={state as any}
                descriptors={descriptors as any}
                navigation={navigation as any}
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

const createWebViewNavigator = createNavigatorFactory(WebViewModalNavigator);

export default createWebViewNavigator;

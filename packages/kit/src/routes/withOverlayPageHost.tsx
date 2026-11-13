import { useContext, useEffect, useState } from 'react';
import type { ComponentType } from 'react';

import {
  OverlayPageHost,
  OverlayPageHostScope,
  OverlayView,
  overlayStore,
} from '@onekeyfe/react-native-native-overlay';
import {
  NavigationContainerRefContext,
  NavigationRouteContext,
  useNavigationState,
} from '@react-navigation/native';

import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

const ROUTE_ANIMATION: IOverlayAnimation = {
  enter: { type: 'none' },
  exit: { type: 'none' },
};
let nextWebHostId = 0;

/**
 * Hosts page-scope overlays for one root route (Main, Modal, Onboarding, …).
 * The host renders after the route's navigator, so page overlays cover the
 * native header and tab bar of every page inside the route.
 */
export function withOverlayPageHost<P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> {
  function WithOverlayPageHost(props: P) {
    const route = useContext(NavigationRouteContext);
    const rootNavigation = useContext(NavigationContainerRefContext);
    // The overlay store sorts page hosts lexically. Root routes use random
    // keys, so prefix web hosts in mount order to match the navigation stack.
    const [webHostId] = useState(() => {
      nextWebHostId += 1;
      return String(nextWebHostId).padStart(10, '0');
    });
    const hostKey = route ? `${webHostId}:${route.key}` : undefined;
    const isModal =
      route?.name === ERootRoutes.Modal ||
      route?.name === ERootRoutes.iOSFullScreen;
    const coveredByFullScreen = useNavigationState((state) => {
      const index = state.routes.findIndex((item) => item.key === route?.key);
      return (
        index >= 0 &&
        state.routes
          .slice(index + 1, state.index + 1)
          .some(
            (item) =>
              item.name !== ERootRoutes.Modal &&
              item.name !== ERootRoutes.iOSFullScreen,
          )
      );
    });
    useEffect(() => {
      if (hostKey && isModal) {
        // Suspend the existing entry so returning preserves its order below
        // page Dialogs, along with their mounted state.
        overlayStore.setPageVisible(hostKey, !coveredByFullScreen);
      }
    }, [coveredByFullScreen, hostKey, isModal]);
    useEffect(
      () => () => {
        if (hostKey && isModal) overlayStore.removePage(hostKey);
      },
      [hostKey, isModal],
    );
    if (!hostKey || !route) {
      return <Component {...props} />;
    }
    return (
      <OverlayPageHostScope hostKey={hostKey}>
        {isModal ? (
          <OverlayView
            visible
            keepContentMounted
            scope="page"
            hostKey={hostKey}
            ownerKey={hostKey}
            presentation="fullscreen"
            animation={ROUTE_ANIMATION}
            backdrop={false}
            dismissOnBackPress
            // Dispatch through the focused navigator so nested pages pop first.
            onRequestDismiss={() => rootNavigation?.goBack()}
          >
            <Component {...props} />
          </OverlayView>
        ) : (
          <Component {...props} />
        )}
        <OverlayPageHost hostKey={hostKey} />
      </OverlayPageHostScope>
    );
  }
  WithOverlayPageHost.displayName = `withOverlayPageHost(${
    Component.displayName ?? Component.name ?? 'Component'
  })`;
  return WithOverlayPageHost;
}

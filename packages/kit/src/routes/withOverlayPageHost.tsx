import { useContext, useState } from 'react';
import type { ComponentType } from 'react';

import {
  OverlayPageHost,
  OverlayPageHostScope,
  OverlayView,
} from '@onekeyfe/react-native-native-overlay';
import {
  NavigationRouteContext,
  useNavigationState,
} from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
    // The overlay store sorts page hosts lexically. Root routes use random
    // keys, so prefix web hosts in mount order to match the navigation stack.
    const [webHostId] = useState(() => {
      nextWebHostId += 1;
      return String(nextWebHostId).padStart(10, '0');
    });
    const hostKey =
      route && !platformEnv.isNative ? `${webHostId}:${route.key}` : route?.key;
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
    if (!hostKey || !route) {
      return <Component {...props} />;
    }
    return (
      <OverlayPageHostScope hostKey={hostKey}>
        {!platformEnv.isNative &&
        (route.name === ERootRoutes.Modal ||
          route.name === ERootRoutes.iOSFullScreen) ? (
          <OverlayView
            visible={!coveredByFullScreen}
            keepContentMounted
            scope="page"
            hostKey={hostKey}
            ownerKey={hostKey}
            presentation="fullscreen"
            animation={ROUTE_ANIMATION}
            backdrop={false}
            dismissOnBackPress={false}
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

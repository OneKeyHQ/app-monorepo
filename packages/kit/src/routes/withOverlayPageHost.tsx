import { useContext } from 'react';
import type { ComponentType } from 'react';

import {
  OverlayPageHost,
  OverlayPageHostScope,
} from '@onekeyfe/react-native-native-overlay';
import { NavigationRouteContext } from '@react-navigation/native';

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
    const hostKey = route?.key;
    if (!hostKey) {
      return <Component {...props} />;
    }
    return (
      <OverlayPageHostScope hostKey={hostKey}>
        <Component {...props} />
        <OverlayPageHost hostKey={hostKey} />
      </OverlayPageHostScope>
    );
  }
  WithOverlayPageHost.displayName = `withOverlayPageHost(${
    Component.displayName ?? Component.name ?? 'Component'
  })`;
  return WithOverlayPageHost;
}

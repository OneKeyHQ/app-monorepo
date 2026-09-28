import { useContext, useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import {
  OverlayPageOwnerScope,
  overlayStore,
} from '@onekeyfe/react-native-native-overlay';
import {
  NavigationContext,
  NavigationRouteContext,
} from '@react-navigation/native';

import type { NavigationProp, ParamListBase } from '@react-navigation/native';

type INavigation = NavigationProp<ParamListBase>;

/**
 * True while the owner route is the active route of every navigator between
 * it and its root route. The root stack itself is not checked: a root modal
 * opened over Main covers Main's page overlays but does not hide them.
 */
function isOwnerActiveWithinHost(navigation: INavigation, ownerKey: string) {
  let current: INavigation | undefined = navigation;
  let key = ownerKey;
  while (current) {
    const state = current.getState();
    if (state.routes[state.index]?.key !== key) {
      return false;
    }
    const parent: INavigation | undefined = current.getParent();
    if (!parent?.getParent()) {
      return true;
    }
    const holder = parent
      .getState()
      .routes.find((route) => route.state?.key === state.key);
    if (!holder) {
      return true;
    }
    key = holder.key;
    current = parent;
  }
  return true;
}

/**
 * Makes the current screen the owner of page-scope overlays rendered below
 * it and keeps the overlay store informed when the screen is covered (push,
 * tab switch) or removed. Navigation listeners still fire while the screen's
 * React tree is frozen (freezeOnBlur), unlike renders.
 */
export function PageOverlayOwner({ children }: PropsWithChildren) {
  const route = useContext(NavigationRouteContext);
  const navigation = useContext(NavigationContext) as INavigation | undefined;
  const ownerKey = route?.key;

  useEffect(() => {
    if (!ownerKey || !navigation) {
      return;
    }
    const update = () =>
      overlayStore.setPageVisible(
        ownerKey,
        isOwnerActiveWithinHost(navigation, ownerKey),
      );
    const unsubscribeFocus = navigation.addListener('focus', update);
    const unsubscribeBlur = navigation.addListener('blur', update);
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      overlayStore.removePage(ownerKey);
    };
  }, [navigation, ownerKey]);

  if (!ownerKey) {
    return <>{children}</>;
  }
  return (
    <OverlayPageOwnerScope ownerKey={ownerKey}>
      {children}
    </OverlayPageOwnerScope>
  );
}

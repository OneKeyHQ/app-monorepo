import { useContext, useEffect, useMemo, useRef } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import {
  OverlayPageHostScope,
  OverlayPageOwnerScope,
  overlayStore,
  useOverlayPageScope,
} from '@onekeyfe/react-native-native-overlay';
import {
  NavigationContainerRefContext,
  NavigationContext,
  NavigationRouteContext,
} from '@react-navigation/native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import { PageTypeContext } from '../../hocs/PageType/context';
import { ModalNavigatorContext } from '../../hooks/useModalNavigatorContext';
import { registerImperativeOverlayPage } from '../../shared/imperativeOverlayMount';

import { PageContext } from './PageContext';

import type {
  NavigationProp,
  NavigationState,
  ParamListBase,
  PartialState,
} from '@react-navigation/native';

type INavigation = NavigationProp<ParamListBase>;

/**
 * True while the owner route is the active route of every navigator between
 * it and its root route. Web also checks the root stack so covered page
 * overlays cannot make a newly pushed root modal inert.
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
    if (!parent || (platformEnv.isNative && !parent.getParent())) {
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

function isOwnerVisibleInRoot(
  root: NavigationState,
  hostKey: string,
  ownerKey: string,
) {
  const hostIndex = root.routes.findIndex((route) => route.key === hostKey);
  if (hostIndex < 0 || hostIndex > root.index) return false;
  if (
    root.routes
      .slice(hostIndex + 1, root.index + 1)
      .some(
        (route) =>
          route.name !== ERootRoutes.Modal &&
          route.name !== ERootRoutes.iOSFullScreen,
      )
  ) {
    return false;
  }
  // Covered root routes can remain visible; inactive screens inside a host cannot.
  const host = root.routes[hostIndex];
  if (host.key === ownerKey) return true;
  let state: NavigationState | PartialState<NavigationState> | undefined =
    host.state;
  while (state) {
    const route = state.routes[state.index ?? 0];
    if (route?.key === ownerKey) return true;
    state = route?.state;
  }
  return false;
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
  const rootNavigation = useContext(NavigationContainerRefContext);
  const { hostKey, ownerKey: inheritedOwnerKey } = useOverlayPageScope();
  const pageContext = useContext(PageContext);
  const pageTypeContext = useContext(PageTypeContext);
  const modalNavigatorContext = useContext(ModalNavigatorContext);
  const ownerKey = route?.key;
  const isNestedOwner = inheritedOwnerKey === ownerKey;
  const wrap = useMemo(
    () => (node: ReactNode) =>
      hostKey && ownerKey ? (
        <OverlayPageHostScope hostKey={hostKey}>
          <OverlayPageOwnerScope ownerKey={ownerKey}>
            <NavigationContext.Provider value={navigation}>
              <NavigationRouteContext.Provider value={route}>
                <PageTypeContext.Provider value={pageTypeContext}>
                  <ModalNavigatorContext.Provider value={modalNavigatorContext}>
                    <PageContext.Provider value={pageContext}>
                      {node}
                    </PageContext.Provider>
                  </ModalNavigatorContext.Provider>
                </PageTypeContext.Provider>
              </NavigationRouteContext.Provider>
            </NavigationContext.Provider>
          </OverlayPageOwnerScope>
        </OverlayPageHostScope>
      ) : null,
    [
      hostKey,
      ownerKey,
      navigation,
      route,
      pageTypeContext,
      modalNavigatorContext,
      pageContext,
    ],
  );
  const registrationRef = useRef<
    ReturnType<typeof registerImperativeOverlayPage> | undefined
  >(undefined);
  const wrapRef = useRef(wrap);
  wrapRef.current = wrap;

  useEffect(() => {
    if (!hostKey || !ownerKey || isNestedOwner) {
      return;
    }
    const registration = registerImperativeOverlayPage(
      { hostKey, ownerKey },
      wrapRef.current,
    );
    registrationRef.current = registration;
    return () => {
      if (registrationRef.current === registration) {
        registrationRef.current = undefined;
      }
      registration.unregister();
    };
  }, [hostKey, isNestedOwner, ownerKey]);

  useEffect(() => {
    registrationRef.current?.update(wrap);
  }, [wrap]);

  useEffect(() => {
    if (!ownerKey || !navigation || isNestedOwner) {
      return;
    }
    const update = () => {
      const root = !platformEnv.isNative
        ? rootNavigation?.getRootState()
        : undefined;
      overlayStore.setPageVisible(
        ownerKey,
        root && hostKey
          ? isOwnerVisibleInRoot(root, hostKey, ownerKey)
          : isOwnerActiveWithinHost(navigation, ownerKey),
      );
    };
    const unsubscribeListeners: Array<() => void> = [];
    let current: INavigation | undefined = navigation;
    while (current) {
      unsubscribeListeners.push(
        current.addListener('focus', update),
        current.addListener('blur', update),
        current.addListener('state', update),
      );
      current = current.getParent();
    }
    update();
    return () => {
      unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
      overlayStore.removePage(ownerKey);
    };
  }, [hostKey, isNestedOwner, navigation, ownerKey, rootNavigation]);

  if (!ownerKey) {
    return <>{children}</>;
  }
  return (
    <OverlayPageOwnerScope ownerKey={ownerKey}>
      {children}
    </OverlayPageOwnerScope>
  );
}

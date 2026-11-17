import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { useRoute } from '@react-navigation/native';
import { AppState } from 'react-native';

import { Page } from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { createIntercomMessengerSession } from '@onekeyhq/kit/src/views/Intercom/client';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type { IIntercomMessengerSession } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EIntercomRoutes,
  IIntercomParamList,
  IIntercomSupportRoute,
} from '@onekeyhq/shared/src/routes/intercom';

import { useSupportResource } from '../hooks/useSupportResource';

import type { RouteProp } from '@react-navigation/native';

export type ISupportSessionProps = {
  route: IIntercomSupportRoute;
  session?: IIntercomMessengerSession;
  active: boolean;
  sessionError?: () => void;
};

function SupportSessionContent({
  route,
  children,
}: {
  route: IIntercomSupportRoute;
  children: (props: ISupportSessionProps) => ReactElement;
}) {
  const focused = useRouteIsFocused();
  const [foreground, setForeground] = useState(
    !platformEnv.isNative || AppState.currentState === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const createSession = useCallback(
    () =>
      createIntercomMessengerSession(route.userId, {
        requestId: route.requestId,
      }),
    [route.userId, route.requestId],
  );
  const session = useSupportResource(createSession, focused && foreground);
  const retrySession = () => {
    void session.refresh();
  };
  const sharedProps = {
    session: session.data,
    active: focused && foreground && !!session.data,
    sessionError: session.failed ? retrySession : undefined,
    route,
  };
  return children(sharedProps);
}

export function SupportSessionBoundary({
  children,
}: {
  children: (props: ISupportSessionProps) => ReactElement;
}) {
  const route = useRoute<RouteProp<IIntercomParamList, EIntercomRoutes>>();
  const navigation =
    useAppNavigation<IModalNavigationProp<IIntercomParamList>>();
  const [{ isLoggedIn, onekeyUserId }] = usePrimePersistAtom();
  const [locked] = useAppIsLockedAtom();
  const sameUser = (isLoggedIn ? onekeyUserId : null) === route.params.userId;
  if (!sameUser || locked)
    return (
      <Page
        shouldRedirect={() => !sameUser}
        onRedirected={() => navigation.popStack()}
      />
    );
  return (
    <SupportSessionContent
      key={`${route.key}-${route.params.userId ?? 'anonymous'}`}
      route={route.params}
    >
      {children}
    </SupportSessionContent>
  );
}

import { useEffect } from 'react';

import {
  usePrimeInitAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

export function usePrivyAuthSyncToAtom() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [primeInitAtom, setPrimeInitAtom] = usePrimeInitAtom();

  // https://github.com/privy-io/create-next-app/blob/main/pages/index.tsx
  const { isReady, logout, authenticated, getAccessToken, user } =
    usePrivyUniversalV2();

  useEffect(() => {
    void (async () => {
      if (!isReady) {
        return;
      }
      let accessToken: string | null = '';
      if (authenticated) {
        accessToken = await getAccessToken();
      }

      await backgroundApiProxy.simpleDb.prime.saveAuthToken(accessToken || '');

      if (accessToken) {
        setPrimePersistAtom((v) => ({
          ...v,
          isLoggedIn: true,
          email: user?.email,
          privyUserId: user?.id,
        }));
      } else {
        setPrimePersistAtom((v) => ({
          ...v,
          isLoggedIn: false,
          email: undefined,
          privyUserId: undefined,
        }));
      }

      setPrimeInitAtom((v) => ({
        ...v,
        isReady: true,
      }));
    })();
  }, [
    setPrimePersistAtom,
    setPrimeInitAtom,
    authenticated,
    getAccessToken,
    isReady,
    user?.email,
    user?.id,
  ]);

  useEffect(() => {
    const fn = async () => {
      await logout();
    };
    appEventBus.on(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    };
  }, [logout]);
}

import { useEffect } from 'react';

import {
  usePrimeInitAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { usePrivyUniversal } from './usePrivyUniversal';

export function usePrivyAuthSyncToAtom() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [primeInitAtom, setPrimeInitAtom] = usePrimeInitAtom();

  // https://github.com/privy-io/create-next-app/blob/main/pages/index.tsx
  const {
    isReady,
    authenticated,
    userEmail,
    privyUserId,
    native,
    web,
    getAccessToken,
  } = usePrivyUniversal();

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
          email: userEmail,
          privyUserId,
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
    userEmail,
    privyUserId,
  ]);
}

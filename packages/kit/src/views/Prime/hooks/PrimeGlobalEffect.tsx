import { useCallback, useEffect } from 'react';

import { useUpdateEffect } from '@onekeyhq/components';
import type { IPrimeInitAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePrimeInitAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { GlobalJotaiReady } from '../../../components/GlobalJotaiReady/GlobalJotaiReady';

import { usePrimeAuthV2 } from './usePrimeAuthV2';
import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

function PrimeGlobalEffectView() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [, setPrimeInitAtom] = usePrimeInitAtom();

  // https://github.com/privy-io/create-next-app/blob/main/pages/index.tsx
  const { authenticated, getAccessToken, privyUser } = usePrivyUniversalV2();

  const { isReady, user, logout } = usePrimeAuthV2();

  const autoRefreshPrimeUserInfo = useCallback(async () => {
    if (isReady && user?.privyUserId && user?.isLoggedInOnServer) {
      // wait 600ms to ensure the apiLogin() is finished
      await timerUtils.wait(600);

      const accessToken =
        await backgroundApiProxy.simpleDb.prime.getAuthToken();

      // only fetch user info if accessToken is valid (server api login success)
      if (accessToken) {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    }
  }, [isReady, user?.privyUserId, user?.isLoggedInOnServer]);

  useEffect(() => {
    void autoRefreshPrimeUserInfo();
  }, [autoRefreshPrimeUserInfo]);

  useEffect(() => {
    void (async () => {
      if (isReady && user.isLoggedIn && !user.isLoggedInOnServer) {
        const accessToken =
          await backgroundApiProxy.simpleDb.prime.getAuthToken();
        if (accessToken) {
          await backgroundApiProxy.servicePrime.apiLogin({
            accessToken,
          });
        } else {
          // Do not call apiLogout here, otherwise the user will automatically call logout during the login process, resulting in no login
          // await backgroundApiProxy.servicePrime.apiLogout();
        }
      }
    })();
  }, [isReady, user.isLoggedIn, user.isLoggedInOnServer]);

  useEffect(() => {
    void (async () => {
      if (!isReady) {
        return;
      }
      let accessToken: string | null = '';
      if (authenticated) {
        accessToken = await getAccessToken();
      }

      // use apiLogin() to save authToken
      // await backgroundApiProxy.simpleDb.prime.saveAuthToken(accessToken || '');
      if (!accessToken) {
        await backgroundApiProxy.simpleDb.prime.saveAuthToken('');
      }
      // Do not save accessToken here, apiLogin() will save it

      if (accessToken) {
        setPrimePersistAtom(
          (v): IPrimeUserInfo => ({
            ...v,
            isLoggedIn: true,
            email: privyUser?.email,
            privyUserId: privyUser?.id,
          }),
        );
      } else {
        await backgroundApiProxy.servicePrime.setPrimePersistAtomNotLoggedIn();
      }

      setPrimeInitAtom(
        (v): IPrimeInitAtomData => ({
          ...v,
          isReady: true,
        }),
      );
    })();
  }, [
    setPrimePersistAtom,
    setPrimeInitAtom,
    authenticated,
    getAccessToken,
    isReady,
    privyUser?.email,
    privyUser?.id,
  ]);

  useEffect(() => {
    const fn = async () => {
      if (authenticated) {
        // If the server returns that the login is invalid, call the privy sdk logout
        await logout();
      }
      await backgroundApiProxy.simpleDb.prime.saveAuthToken('');
    };
    appEventBus.on(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    };
  }, [logout, authenticated]);

  const isActive = primePersistAtom.primeSubscription?.isActive;
  useUpdateEffect(() => {
    console.log('primePersistAtom.primeSubscription?.isActive', {
      isActive,
    });
    if (isActive) {
      void backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlowSilently(
        {
          callerName: 'primeSubscription isActive',
        },
      );
    }
  }, [isActive]);

  return null;
}

export function PrimeGlobalEffect() {
  return (
    <GlobalJotaiReady>
      <PrimeGlobalEffectView />
    </GlobalJotaiReady>
  );
}

import { useEffect } from 'react';

// import { useUpdateEffect } from '@onekeyhq/components';
import {
  usePrimeInitAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { GlobalJotaiReady } from '../../../components/GlobalJotaiReady/GlobalJotaiReady';
import { usePrevious } from '../../../hooks/usePrevious';

import { usePrivyUniversalV2 } from './usePrivyUniversalV2';

function PrimeGlobalEffectView() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [primeInitAtom, setPrimeInitAtom] = usePrimeInitAtom();

  // https://github.com/privy-io/create-next-app/blob/main/pages/index.tsx
  const { isReady, logout, authenticated, getAccessToken, privyUser } =
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

      // use apiLogin() to save authToken
      // await backgroundApiProxy.simpleDb.prime.saveAuthToken(accessToken || '');
      if (!accessToken) {
        await backgroundApiProxy.simpleDb.prime.saveAuthToken('');
      }

      if (accessToken) {
        setPrimePersistAtom((v) => ({
          ...v,
          isLoggedIn: true,
          email: privyUser?.email,
          privyUserId: privyUser?.id,
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
    privyUser?.email,
    privyUser?.id,
  ]);

  useEffect(() => {
    const fn = async () => {
      // If the server returns that the login is invalid, call the privy sdk logout
      await logout();
      await backgroundApiProxy.simpleDb.prime.saveAuthToken('');
    };
    appEventBus.on(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    };
  }, [logout]);

  // const isActive = primePersistAtom.primeSubscription?.isActive;
  // useUpdateEffect(() => {
  //   console.log('primePersistAtom.primeSubscription?.isActive', {
  //     isActive,
  //   });
  //   if (isActive) {
  //     void backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlowSilently(
  //       {
  //         callerName: 'primeSubscription isActive',
  //       },
  //     );
  //   }
  // }, [isActive]);
  return null;
}

export function PrimeGlobalEffect() {
  return (
    <GlobalJotaiReady>
      <PrimeGlobalEffectView />
    </GlobalJotaiReady>
  );
}

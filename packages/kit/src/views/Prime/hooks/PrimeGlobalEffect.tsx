import { useCallback, useEffect, useRef } from 'react';

import { noop } from 'lodash';

import { useUpdateEffect } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { IPrimeInitAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePrimeInitAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { GlobalJotaiReady } from '../../../components/GlobalJotaiReady/GlobalJotaiReady';

import { usePrimePaymentMethods } from './usePrimePaymentMethods';

import type {
  IRevenueCatCustomerInfoNative,
  IRevenueCatCustomerInfoWeb,
} from './usePrimePaymentTypes';

function PrimeGlobalEffectAfterAuthReady() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [, setPrimeInitAtom] = usePrimeInitAtom();

  const { getCustomerInfo } = usePrimePaymentMethods();
  const { isLoggedInOnServer } = primePersistAtom;

  const {
    user,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    logout,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    supabaseUser,
    isSupabaseLoggedIn,
    getAccessToken: getSupabaseAccessToken,
  } = useOneKeyAuth();

  const userRef = useRef<IPrimeUserInfo>(user);
  userRef.current = user;

  const autoRefreshPrimeUserInfo = useCallback(async () => {
    if (user?.onekeyUserId && user?.isLoggedInOnServer) {
      // wait 600ms to ensure the apiLogin() is finished
      await timerUtils.wait(600);

      const accessToken =
        await backgroundApiProxy.simpleDb.prime.getAuthToken();

      // only fetch user info if accessToken is valid (server api login success)
      if (accessToken) {
        await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
      }
    }
  }, [user?.onekeyUserId, user?.isLoggedInOnServer]);

  useEffect(() => {
    void (async () => {
      if (platformEnv.isDev && user?.onekeyUserId) {
        const customerInfo = await getCustomerInfo();

        const customerInfoWeb = customerInfo as IRevenueCatCustomerInfoWeb;
        const customerInfoNative =
          customerInfo as IRevenueCatCustomerInfoNative;

        const localIsActive =
          customerInfo?.entitlements?.active?.Prime?.isActive;
        const localWillRenew =
          customerInfo?.entitlements?.active?.Prime?.willRenew;
        const localIsSandbox =
          customerInfo?.entitlements?.active?.Prime?.isSandbox;
        const localSubscriptionManageUrl = customerInfo?.managementURL;

        let localExpiresAt = 0;
        if (
          customerInfoNative?.entitlements?.active?.Prime?.expirationDateMillis
        ) {
          localExpiresAt =
            customerInfoNative.entitlements.active.Prime.expirationDateMillis;
        } else if (
          customerInfoWeb?.entitlements?.active?.Prime?.expirationDate?.getTime
        ) {
          localExpiresAt =
            customerInfoWeb.entitlements.active.Prime.expirationDate?.getTime() ??
            0;
        }

        console.log('prime payment status ===========================', {
          local: {
            $customerInfo: customerInfo,
            isActive: localIsActive,
            willRenew: localWillRenew,
            expiresAt: localExpiresAt,
            isSandbox: localIsSandbox,
            subscriptionManageUrl: localSubscriptionManageUrl,
          },
          server: {
            $user: userRef.current,
            isActive: userRef.current.primeSubscription?.isActive,
            expiresAt: userRef.current.primeSubscription?.expiresAt,
            willRenew: userRef.current.primeSubscription?.willRenew,
            subscriptions: userRef.current.primeSubscription?.subscriptions,
          },
        });
        if (localIsActive !== userRef.current.primeSubscription?.isActive) {
          console.log(
            'prime payment status not match ===========================',
          );
        }
      }
    })();
  }, [getCustomerInfo, user?.onekeyUserId]);

  useEffect(() => {
    void autoRefreshPrimeUserInfo();
  }, [autoRefreshPrimeUserInfo]);

  useEffect(() => {
    void (async () => {
      if (user.isLoggedIn && !user.isLoggedInOnServer) {
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
  }, [user.isLoggedIn, user.isLoggedInOnServer]);

  useEffect(() => {
    void (async () => {
      let accessToken: string | null | undefined = '';
      if (isSupabaseLoggedIn) {
        accessToken = await getSupabaseAccessToken();
      }

      // use apiLogin() to save authToken
      // await backgroundApiProxy.simpleDb.prime.saveAuthToken(accessToken || '');
      if (!accessToken) {
        await backgroundApiProxy.simpleDb.prime.saveAuthToken('');
      }
      // Do not save accessToken here, apiLogin() will save it

      if (accessToken) {
        // do nothing here, apiLogin() will set the primePersistAtom and update login status
      } else {
        defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
          reason: `PrimeGlobalEffect: privySdk.getAccessToken() is null ${JSON.stringify(
            {
              isSupabaseLoggedIn,
            },
          )}`,
        });
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
    isSupabaseLoggedIn,
    getSupabaseAccessToken,
  ]);

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

  useUpdateEffect(() => {
    void (async () => {
      noop(isLoggedInOnServer);
      noop(isActive);
      /*
      (await $$appGlobals.$$allAtoms.notificationsAtom.get()).maxAccountCount
      */
      await backgroundApiProxy.serviceNotification.clearServerSettingsCache();
      await backgroundApiProxy.serviceNotification.registerClientWithOverrideAllAccounts();
    })();
  }, [isActive, isLoggedInOnServer]);

  return null;
}

function PrimeGlobalEffectView() {
  const { isReady, logout, isSupabaseLoggedIn } = useOneKeyAuth();

  useEffect(() => {
    const fn = async () => {
      if (isSupabaseLoggedIn) {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: 'appEventBus: EAppEventBusNames.PrimeLoginInvalidToken',
        });
        // If the server returns that the login is invalid, call the supabase sdk logout
        await logout();
      }
      await backgroundApiProxy.simpleDb.prime.saveAuthToken('');
    };
    appEventBus.on(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    };
  }, [logout, isSupabaseLoggedIn]);

  if (isReady) {
    return <PrimeGlobalEffectAfterAuthReady />;
  }

  return null;
}

export function PrimeGlobalEffect() {
  return (
    <GlobalJotaiReady>
      <PrimeGlobalEffectView />
    </GlobalJotaiReady>
  );
}

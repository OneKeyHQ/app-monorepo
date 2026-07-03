import { useCallback, useEffect, useRef } from 'react';

import { noop } from 'lodash';

import { useUpdateEffect } from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import type { IPrimeInitAtomData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useAppIsLockedAtom,
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
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { showOneKeyIdLegacyOAuthBindDialogForLocalKeylessUpgrade } from '../components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind';

import { usePrimePaymentMethods } from './usePrimePaymentMethods';

import type {
  IRevenueCatCustomerInfoNative,
  IRevenueCatCustomerInfoWeb,
} from './usePrimePaymentTypes';

function PrimeGlobalEffectAfterAuthReady() {
  const [primePersistAtom, setPrimePersistAtom] = usePrimePersistAtom();
  const [, setPrimeInitAtom] = usePrimeInitAtom();
  const [isAppLocked] = useAppIsLockedAtom();

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
  const isAppLockedRef = useRef(isAppLocked);
  isAppLockedRef.current = isAppLocked;
  const isCheckingLocalKeylessUpgradeBindPromptRef = useRef(false);

  const autoRefreshPrimeUserInfo = useCallback(async () => {
    try {
      if (user?.onekeyUserId && user?.isLoggedInOnServer) {
        // wait 600ms to ensure the apiLogin() is finished
        await timerUtils.wait(600);

        const accessToken =
          await backgroundApiProxy.simpleDb.prime.getActiveAuthToken();

        // only fetch user info if accessToken is valid (server api login success)
        if (accessToken) {
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        }
      }
    } catch (error) {
      defaultLogger.prime.subscription.onekeyIdInvalidToken({
        url: '',
        errorCode: -1759,
        errorMessage: `PrimeGlobalEffect.autoRefreshPrimeUserInfo: fetch user info failed: ${String(
          error,
        )}`,
      });
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
    if (
      isCheckingLocalKeylessUpgradeBindPromptRef.current ||
      isAppLocked ||
      !user?.onekeyUserId ||
      !user?.isLoggedInOnServer
    ) {
      return;
    }
    let isCancelled = false;
    isCheckingLocalKeylessUpgradeBindPromptRef.current = true;

    void (async () => {
      try {
        await showOneKeyIdLegacyOAuthBindDialogForLocalKeylessUpgrade({
          onekeyUserId: user.onekeyUserId,
          shouldSkip: () => isCancelled || isAppLockedRef.current,
        });
      } catch (error) {
        console.error(
          'PrimeGlobalEffect.showOneKeyIdLegacyOAuthBindDialogForLocalKeylessUpgrade failed:',
          error,
        );
      } finally {
        if (!isCancelled) {
          isCheckingLocalKeylessUpgradeBindPromptRef.current = false;
        }
      }
    })();

    return () => {
      isCancelled = true;
      isCheckingLocalKeylessUpgradeBindPromptRef.current = false;
    };
  }, [isAppLocked, user?.onekeyUserId, user?.isLoggedInOnServer]);

  const isUserLoggedIn = user.isLoggedIn;
  const isUserLoggedInOnServer = user.isLoggedInOnServer;
  useEffect(() => {
    void (async () => {
      try {
        if (isUserLoggedIn && !isUserLoggedInOnServer) {
          const accessToken =
            await backgroundApiProxy.simpleDb.prime.getSupabaseAuthToken();
          if (accessToken) {
            await backgroundApiProxy.servicePrime.apiLogin({
              accessToken,
            });
          } else {
            // Do not call apiLogout here, otherwise the user will automatically call logout during the login process, resulting in no login
            // await backgroundApiProxy.servicePrime.apiLogout();
          }
        }
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdInvalidToken({
          url: '',
          errorCode: -1759,
          errorMessage: `PrimeGlobalEffect.legacyApiLogin: api login failed: ${String(
            error,
          )}`,
        });
      }
    })();
  }, [isUserLoggedIn, isUserLoggedInOnServer]);

  useEffect(() => {
    void (async () => {
      let accessToken: string | null | undefined = '';
      try {
        if (isSupabaseLoggedIn) {
          accessToken = await getSupabaseAccessToken();
        }
        if (!accessToken) {
          accessToken =
            await backgroundApiProxy.simpleDb.prime.getActiveAuthToken();
        }

        if (accessToken) {
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        } else {
          await backgroundApiProxy.simpleDb.prime.clearAuthTokens();
          defaultLogger.prime.subscription.onekeyIdAtomNotLoggedIn({
            reason: `PrimeGlobalEffect: privySdk.getAccessToken() is null ${JSON.stringify(
              {
                isSupabaseLoggedIn,
              },
            )}`,
          });
          await backgroundApiProxy.servicePrime.setPrimePersistAtomNotLoggedIn();
        }
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdInvalidToken({
          url: '',
          errorCode: -1759,
          errorMessage: `PrimeGlobalEffect: fetch user info failed: ${String(
            error,
          )}`,
        });
        // Keep local auth state for transient refresh/network failures.
        // Server-side invalid tokens are cleared by the PrimeLoginInvalidToken event.
      } finally {
        setPrimeInitAtom(
          (v): IPrimeInitAtomData => ({
            ...v,
            isReady: true,
          }),
        );
      }
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
  const {
    isReady,
    clearLocalSupabaseSessions,
    legacySupabaseSignOut,
    keylessSupabaseSignOut,
  } = useOneKeyAuth();

  useEffect(() => {
    const fn = async (
      payload:
        | {
            authSessionSource?: EPrimeAuthSessionSource;
            clearedByBackground?: boolean;
          }
        | undefined,
    ) => {
      defaultLogger.prime.subscription.onekeyIdLogout({
        reason: 'appEventBus: EAppEventBusNames.PrimeLoginInvalidToken',
      });
      if (
        payload?.clearedByBackground &&
        payload.authSessionSource === EPrimeAuthSessionSource.KeylessOAuth
      ) {
        await keylessSupabaseSignOut();
      } else if (
        payload?.clearedByBackground &&
        payload.authSessionSource ===
          EPrimeAuthSessionSource.LegacyEmailSupabase
      ) {
        await legacySupabaseSignOut();
      } else {
        await clearLocalSupabaseSessions();
        await backgroundApiProxy.simpleDb.prime.clearLocalAuthSession();
      }
      await backgroundApiProxy.servicePrime.setPrimePersistAtomNotLoggedIn();
    };
    appEventBus.on(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    };
  }, [
    clearLocalSupabaseSessions,
    keylessSupabaseSignOut,
    legacySupabaseSignOut,
  ]);

  if (isReady) {
    return <PrimeGlobalEffectAfterAuthReady />;
  }

  return null;
}

export function PrimeGlobalEffect() {
  return <PrimeGlobalEffectView />;
}

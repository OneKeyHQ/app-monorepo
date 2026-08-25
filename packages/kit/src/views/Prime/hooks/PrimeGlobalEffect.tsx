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
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EPrimeAuthSessionSource,
  IPrimeUserInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { KYTIntroOnMount } from '../../Setting/pages/Protection/KYTIntroDialog';
import { showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade } from '../components/OneKeyIdLegacyOAuthBind/OneKeyIdLegacyOAuthBind';

import { logoutPurchasesSdk } from './purchasesSdkLogout';
import { usePrimePaymentMethods } from './usePrimePaymentMethods';

import type {
  IRevenueCatCustomerInfoNative,
  IRevenueCatCustomerInfoWeb,
} from './usePrimePaymentTypes';

function PrimeGlobalEffectAfterAuthReady() {
  const [primePersistAtom] = usePrimePersistAtom();
  const [, setPrimeInitAtom] = usePrimeInitAtom();
  const [isAppLocked] = useAppIsLockedAtom();
  const isAppLockedRef = useRef(isAppLocked);
  isAppLockedRef.current = isAppLocked;

  const { getCustomerInfo } = usePrimePaymentMethods();
  const { isLoggedInOnServer } = primePersistAtom;

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelayMs = 2000;

    const reconcileLoggedOutProjection = async (expectedRevision?: number) => {
      if (expectedRevision !== undefined) {
        const currentRevision =
          await backgroundApiProxy.simpleDb.prime.getIdentityLifecycleRevision();
        if (currentRevision !== expectedRevision) {
          return;
        }
      }
      if (await backgroundApiProxy.servicePrime.isLoggedIn()) {
        return;
      }
      const completed = await logoutPurchasesSdk();
      if (!completed && !cancelled) {
        retryTimer = setTimeout(() => {
          void reconcileLoggedOutProjection();
        }, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 60_000);
      }
    };

    const onIdentityLifecycleCommitted = (payload: {
      revision: number;
      oneKeyIdState: 'loggedIn' | 'loggedOut';
    }) => {
      if (payload.oneKeyIdState === 'loggedOut') {
        void reconcileLoggedOutProjection(payload.revision);
      }
    };
    appEventBus.on(
      EAppEventBusNames.IdentityLifecycleCommitted,
      onIdentityLifecycleCommitted,
    );
    if (!primePersistAtom.isLoggedIn || !isLoggedInOnServer) {
      void reconcileLoggedOutProjection();
    }
    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      appEventBus.off(
        EAppEventBusNames.IdentityLifecycleCommitted,
        onIdentityLifecycleCommitted,
      );
    };
  }, [isLoggedInOnServer, primePersistAtom.isLoggedIn]);

  const {
    user,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    supabaseUser,
    isSupabaseLoggedIn,
  } = useOneKeyAuth();

  const userRef = useRef<IPrimeUserInfo>(user);
  userRef.current = user;

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
      // Local-only: generic refresh failures are not invalid-token signals
      // and previously polluted onekeyIdInvalidToken with synthetic -1759.
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: `PrimeGlobalEffect.autoRefreshPrimeUserInfo: fetch user info failed: ${getSanitizedErrorLogText(
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
    if (isAppLocked || !user?.onekeyUserId || !user?.isLoggedInOnServer) {
      return undefined;
    }
    let isCancelled = false;

    void (async () => {
      try {
        await showOneKeyIdLegacyOAuthBindDialogAfterCredentialUpgrade({
          onekeyUserId: user.onekeyUserId,
          shouldSkip: () => isCancelled || isAppLockedRef.current,
        });
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdStateTrace({
          reason: `PrimeGlobalEffect.credentialUpgradeBindPrompt failed: ${getSanitizedErrorLogText(
            error,
          )}`,
        });
      }
    })();

    return () => {
      isCancelled = true;
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
          }
        }
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdStateTrace({
          reason: `PrimeGlobalEffect.legacyApiLogin: api login failed: ${getSanitizedErrorLogText(
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
          // Steady-state token read: MUST go through the bg bridge (bg
          // runtime performs any needed token refresh). Reading via the UI
          // client's getSession() here could refresh an expired session in
          // the UI runtime and race the bg rotation — see
          // isSupabaseTokenRefreshRuntime in supabaseClientUtils.
          accessToken =
            await backgroundApiProxy.simpleDb.prime.getSupabaseAuthToken();
        }
        if (!accessToken) {
          accessToken =
            await backgroundApiProxy.simpleDb.prime.getActiveAuthToken();
        }

        if (accessToken) {
          await backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
        } else {
          // Local-only: expected state for every never-logged-in user at
          // startup, not an auth anomaly.
          defaultLogger.prime.subscription.onekeyIdStateTrace({
            reason: `PrimeGlobalEffect: privySdk.getAccessToken() is null ${JSON.stringify(
              {
                isSupabaseLoggedIn,
              },
            )}`,
          });
          // Guarded bg-side clear (authStateWriteMutex + in-lock re-read):
          // a raw clearAuthTokens here could interleave with an in-flight
          // OAuth login commit and wipe its freshly written
          // authSessionSource — a wiped KeylessOAuth source is never
          // re-inferred, orphaning a still-valid keyless session.
          await backgroundApiProxy.servicePrime.clearOneKeyIdAuthStateIfNoActiveToken(
            {
              callerName: 'PrimeGlobalEffect',
            },
          );
        }
      } catch (error) {
        defaultLogger.prime.subscription.onekeyIdStateTrace({
          reason: `PrimeGlobalEffect: fetch user info failed: ${getSanitizedErrorLogText(
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
  }, [setPrimeInitAtom, isSupabaseLoggedIn]);

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
  const { isReady } = useOneKeyAuth();

  useEffect(() => {
    // Main-runtime handler NEVER mutates the shared session storage: every
    // persistent session deletion is bg-owned and identity-coordinated — a main-side
    // signOut here could race a fresh login's persist and delete
    // credentials no later guard can restore (extension runs this handler
    // once per UI surface, multiplying that window). The session
    // PROJECTION refresh is handled by SupabaseAuthProvider's own
    // PrimeLoginInvalidToken subscription (pure storage re-read).
    const fn = async (
      payload:
        | {
            authSessionSource?: EPrimeAuthSessionSource;
            clearedByBackground?: boolean;
            authStateGeneration?: number;
          }
        | undefined,
    ) => {
      if (
        payload?.clearedByBackground &&
        payload.authStateGeneration !== undefined
      ) {
        // Staleness gate: the payload carries the auth-state commit
        // generation observed when bg decided to clear. A user can
        // complete a fresh login while this event propagates bg -> main;
        // that commit bumps the generation, and the rest of this handler
        // must not run against the pre-login epoch.
        const currentAuthStateGeneration =
          await backgroundApiProxy.simpleDb.prime.getAuthStateGeneration();
        if (currentAuthStateGeneration !== payload.authStateGeneration) {
          defaultLogger.prime.subscription.onekeyIdStateTrace({
            reason: `PrimeGlobalEffectView.PrimeLoginInvalidToken: skip stale event, a login committed during propagation (generation ${payload.authStateGeneration} -> ${currentAuthStateGeneration})`,
          });
          return;
        }
      }
      // Local-only: bg already emits onekeyIdInvalidToken for the server
      // signal. This bus handler is not a user logout.
      defaultLogger.prime.subscription.onekeyIdStateTrace({
        reason: 'appEventBus: EAppEventBusNames.PrimeLoginInvalidToken',
      });
      // Guarded reset (authStateWriteMutex + in-lock re-read): the bg-side
      // invalid-token cleanup already reset the atom in-lock before
      // emitting this event, and a new login may have committed during the
      // event-bus hop — an unconditional atom reset here would wipe it
      // (ext runs this handler once per UI surface).
      await backgroundApiProxy.servicePrime.clearOneKeyIdAuthStateIfNoActiveToken(
        {
          callerName: 'PrimeGlobalEffectView.PrimeLoginInvalidToken',
        },
      );
    };
    appEventBus.on(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeLoginInvalidToken, fn);
    };
  }, []);

  return (
    <>
      <KYTIntroOnMount />
      {isReady ? <PrimeGlobalEffectAfterAuthReady /> : null}
    </>
  );
}

export function PrimeGlobalEffect() {
  return <PrimeGlobalEffectView />;
}

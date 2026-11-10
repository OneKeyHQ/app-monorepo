import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StackActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Toast, rootNavigationRef } from '@onekeyhq/components';
import { OverlayCloseCancelledError } from '@onekeyhq/components/src/shared/overlayCloseCancellation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { primePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  IInviteRewardRouteParams,
  IPerksOpenEntry,
  IReferralPageTab,
} from '@onekeyhq/shared/src/routes';
import { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';
import { closeExtensionPopupAfterExpandTabOpen } from '@onekeyhq/shared/src/utils/extUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useOneKeyAuth } from '../components/OneKeyAuth/useOneKeyAuth';

import useAppNavigation from './useAppNavigation';

const shouldUseReferralModalNav = platformEnv.isNative;
const shouldOpenReferralInExtensionExpandTab =
  platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel;

const getReferralIdentity = () => {
  const value = jotaiDefaultStore.get(primePersistAtom.atom());
  return [
    value.onekeyUserId,
    value.isLoggedIn,
    value.isLoggedInOnServer,
  ] as const;
};
const isSameReferralIdentity = (
  left: ReturnType<typeof getReferralIdentity>,
  right: ReturnType<typeof getReferralIdentity>,
) => left.every((value, index) => value === right[index]);

let referralLoginCheck:
  | { promise: Promise<boolean>; stale: boolean }
  | undefined;

function getReferralLoginStatus() {
  if (referralLoginCheck && !referralLoginCheck.stale) {
    return referralLoginCheck.promise;
  }
  const identity = getReferralIdentity();
  const check = {
    promise: Promise.resolve().then(() =>
      backgroundApiProxy.servicePrime.isLoggedIn(),
    ),
    stale: false,
  };
  const unsubscribe = primePersistAtom.sub(() => {
    if (!isSameReferralIdentity(identity, getReferralIdentity())) {
      check.stale = true;
    }
  });
  // A UI timeout abandons the attempt, not the shared background operation.
  check.promise = check.promise.finally(() => {
    unsubscribe();
    if (referralLoginCheck === check) referralLoginCheck = undefined;
  });
  referralLoginCheck = check;
  return check.promise;
}

function openExtensionReferralInExpandTab(path: string, params?: object) {
  return backgroundApiProxy.serviceApp
    .openExtensionExpandTab({
      path,
      params,
    })
    .then(closeExtensionPopupAfterExpandTabOpen);
}

export function useToReferFriendsModalByRootNavigation() {
  return useCallback(async () => {
    const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();

    if (shouldOpenReferralInExtensionExpandTab) {
      await openExtensionReferralInExpandTab(
        isLogin ? '/refer-friends/invite-reward' : '/refer-friends',
      );
      return;
    }

    if (shouldUseReferralModalNav) {
      const screen = isLogin
        ? EModalReferFriendsRoutes.InviteReward
        : EModalReferFriendsRoutes.ReferAFriend;

      rootNavigationRef.current?.navigate(ERootRoutes.Modal, {
        screen: EModalRoutes.ReferFriendsModal,
        params: {
          screen,
        },
      });
    } else {
      const screen = isLogin
        ? ETabReferFriendsRoutes.TabInviteReward
        : ETabReferFriendsRoutes.TabReferAFriend;

      rootNavigationRef.current?.navigate(
        ERootRoutes.Main,
        {
          screen: ETabRoutes.ReferFriends,
          params: {
            screen,
          },
        },
        {
          pop: true,
        },
      );
    }
  }, []);
}

export function useReplaceToReferFriends() {
  const navigation = useAppNavigation();

  return useCallback(
    async (params?: {
      utmSource?: string;
      code?: string;
      tab?: IReferralPageTab;
      perksEntry?: IPerksOpenEntry;
      /** Skip isLoggedIn check when caller already knows login state */
      isLoggedIn?: boolean;
    }) => {
      const { isLoggedIn: knownLoginState, ...navParams } = params ?? {};
      const isLogin =
        knownLoginState ?? (await backgroundApiProxy.servicePrime.isLoggedIn());

      if (shouldUseReferralModalNav) {
        const screen = isLogin
          ? EModalReferFriendsRoutes.InviteReward
          : EModalReferFriendsRoutes.ReferAFriend;
        navigation.replace(screen, navParams);
      } else {
        const screen = isLogin
          ? ETabReferFriendsRoutes.TabInviteReward
          : ETabReferFriendsRoutes.TabReferAFriend;
        // Use reset instead of replace to clear the navigation stack
        // This prevents the back button from appearing on the root screen
        navigation.reset({
          index: 0,
          routes: [{ name: screen, params: navParams }],
        });
      }
    },
    [navigation],
  );
}

export const useReferFriends = ({
  isEntryActive = true,
  beforeNavigate,
}: {
  isEntryActive?: boolean;
  beforeNavigate?: () => Promise<void>;
} = {}) => {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { loginOneKeyId } = useOneKeyAuth();
  const [isReferralEntryPending, setEntryPending] = useState(false);
  const [isReferralEntryLoading, setEntryLoading] = useState(false);
  const activeRef = useRef(isEntryActive);
  activeRef.current = isEntryActive;
  const mountedRef = useRef(true);
  const attemptRef = useRef<{
    cancel: () => void;
    committing: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isEntryActive && !attemptRef.current?.committing) {
      attemptRef.current?.cancel();
    }
  }, [isEntryActive]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (!attemptRef.current?.committing) attemptRef.current?.cancel();
    };
  }, []);

  const runReferralEntry = useCallback(
    async (navigate: (isLogin: boolean) => void | Promise<void>) => {
      if (!mountedRef.current || attemptRef.current || !activeRef.current)
        return;
      let cancelWait: () => void = () => undefined;
      let cancelled = false;
      let navigating = false;
      const attempt = {
        committing: false,
        cancel: () => {
          cancelled = true;
          cancelWait();
        },
      };
      attemptRef.current = attempt;
      setEntryPending(true);
      const loadingTimer = setTimeout(() => {
        if (!cancelled && mountedRef.current) setEntryLoading(true);
      }, 300);
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
      let unsubscribeRoute: (() => void) | undefined;
      let unsubscribeIdentity: (() => void) | undefined;
      try {
        const sourceKey = rootNavigationRef.current?.getCurrentRoute()?.key;
        const identity = getReferralIdentity();
        unsubscribeRoute = rootNavigationRef.current?.addListener(
          'state',
          () => {
            if (
              !navigating &&
              rootNavigationRef.current?.getCurrentRoute()?.key !== sourceKey
            ) {
              attempt.cancel();
            }
          },
        );
        unsubscribeIdentity = primePersistAtom.sub(() => {
          if (!isSameReferralIdentity(identity, getReferralIdentity())) {
            attempt.cancel();
          }
        });
        const result = await Promise.race([
          getReferralLoginStatus(),
          new Promise<'cancelled' | 'timeout'>((resolve) => {
            cancelWait = () => resolve('cancelled');
            timeoutTimer = setTimeout(() => resolve('timeout'), 5000);
          }),
        ]);
        if (cancelled || !activeRef.current || result === 'cancelled') return;
        if (result === 'timeout') {
          throw new OneKeyLocalError('Referral entry timed out');
        }
        attempt.committing = true;
        await beforeNavigate?.();
        if (cancelled) return;
        navigating = true;
        await navigate(result);
      } catch (error) {
        if (!cancelled && !(error instanceof OverlayCloseCancelledError)) {
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.global_failed }),
            message: intl.formatMessage({ id: ETranslations.global_try_again }),
          });
        }
      } finally {
        clearTimeout(loadingTimer);
        clearTimeout(timeoutTimer);
        unsubscribeRoute?.();
        unsubscribeIdentity?.();
        attemptRef.current = null;
        if (mountedRef.current) {
          setEntryPending(false);
          setEntryLoading(false);
        }
      }
    },
    [beforeNavigate, intl],
  );

  const openReferralPage = useCallback(
    (isLogin: boolean, params?: IInviteRewardRouteParams) => {
      if (shouldOpenReferralInExtensionExpandTab) {
        return openExtensionReferralInExpandTab(
          isLogin ? '/refer-friends/invite-reward' : '/refer-friends',
          params,
        );
      }
      if (shouldUseReferralModalNav) {
        const modalParams = {
          screen: isLogin
            ? EModalReferFriendsRoutes.InviteReward
            : EModalReferFriendsRoutes.ReferAFriend,
          params,
        };
        const root = rootNavigationRef.current;
        const state = root?.getRootState();
        const route = state?.routes[state.index];
        if (
          route?.name === ERootRoutes.FullScreenPush &&
          (route.params as { screen?: string } | undefined)?.screen ===
            EFullScreenPushRoutes.ActionCenter
        ) {
          root?.dispatch(
            StackActions.replace(ERootRoutes.Modal, {
              screen: EModalRoutes.ReferFriendsModal,
              params: modalParams,
            }),
          );
        } else {
          navigation.pushModal(EModalRoutes.ReferFriendsModal, modalParams);
        }
        return;
      }
      rootNavigationRef.current?.navigate(
        ERootRoutes.Main,
        {
          screen: ETabRoutes.ReferFriends,
          params: {
            screen: isLogin
              ? ETabReferFriendsRoutes.TabInviteReward
              : ETabReferFriendsRoutes.TabReferAFriend,
            params,
          },
        },
        { pop: true },
      );
    },
    [navigation],
  );

  const toInviteRewardPage = useCallback(
    (params?: IInviteRewardRouteParams) =>
      runReferralEntry((isLogin) => {
        if (isLogin) {
          return openReferralPage(true, params);
        }
        void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
      }),
    [loginOneKeyId, openReferralPage, runReferralEntry],
  );

  const toHardwareSalesRewardPage = useCallback(
    async (params?: { showOrderDetail?: boolean; orderId?: string }) => {
      const isLogin = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (isLogin) {
        if (shouldOpenReferralInExtensionExpandTab) {
          await openExtensionReferralInExpandTab(
            '/refer-friends/hardware-sales-reward',
            params,
          );
          return;
        }
        if (shouldUseReferralModalNav) {
          navigation.pushModal(EModalRoutes.ReferFriendsModal, {
            screen: EModalReferFriendsRoutes.HardwareSalesReward,
            params,
          });
        } else {
          navigation.switchTab(ETabRoutes.ReferFriends);
          await timerUtils.wait(50);
          rootNavigationRef.current?.navigate(
            ETabReferFriendsRoutes.TabHardwareSalesReward,
            params,
          );
        }
      } else {
        void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
      }
    },
    [loginOneKeyId, navigation],
  );

  const openHardwareSalesOrderDetail = useCallback(
    (orderId: string) =>
      toHardwareSalesRewardPage({ showOrderDetail: true, orderId }),
    [toHardwareSalesRewardPage],
  );

  const toReferFriendsPage = useCallback(
    (params?: { tab?: IReferralPageTab; perksEntry?: IPerksOpenEntry }) =>
      runReferralEntry((isLogin) => openReferralPage(isLogin, params)),
    [openReferralPage, runReferralEntry],
  );

  return useMemo(
    () => ({
      toReferFriendsPage,
      toInviteRewardPage,
      toHardwareSalesRewardPage,
      openHardwareSalesOrderDetail,
      isReferralEntryPending,
      isReferralEntryLoading,
    }),
    [
      toReferFriendsPage,
      toInviteRewardPage,
      toHardwareSalesRewardPage,
      openHardwareSalesOrderDetail,
      isReferralEntryPending,
      isReferralEntryLoading,
    ],
  );
};

// Opens the referral page from an activity hub. Without a tab the page
// reopens the one the user last left.
export function useOpenReferralPage() {
  const { toReferFriendsPage } = useReferFriends();
  return useCallback(
    (tab?: IReferralPageTab) => {
      void toReferFriendsPage({ tab, perksEntry: 'activity_hub' });
    },
    [toReferFriendsPage],
  );
}

import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
  getDialogInstances,
  rootNavigationRef,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { runAfterTokensDone } from '@onekeyhq/kit/src/hooks/useRunAfterTokensDone';
import {
  useAppUpdatePersistAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  type IAppUpdateInfo,
  isFirstLaunchAfterUpdated,
} from '@onekeyhq/shared/src/appUpdate';
import { RECEIVE_RISK_MONITORING_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { promptKytNotificationPermissionIfNeeded } from './showKytNotificationPermissionDialog';

const receiveKytIntroTrackingParams = {
  featureName: EPrimeFeatures.ReceiveRiskMonitoring,
  entryPoint: 'homeAutoIntro',
  isPrimeActive: true,
} as const;

const mobileFooterButtonProps = {
  flexGrow: 0,
  flexBasis: 'auto',
  w: '100%',
  justifyContent: 'center',
  textAlign: 'center',
} as const;

function KYTIntroDialogContent() {
  const intl = useIntl();

  return (
    <YStack>
      <SizableText size="$bodyLg">
        {intl.formatMessage({
          id: ETranslations.kyt_receive_risk_monitoring_intro_1__desc,
        })}
      </SizableText>
      <SizableText size="$bodyLg" mt="$3">
        {intl.formatMessage({
          id: ETranslations.kyt_receive_risk_monitoring_intro_2__desc,
        })}
      </SizableText>
      <XStack
        mt="$3"
        ai="center"
        alignSelf="flex-start"
        gap="$1"
        onPress={() => {
          defaultLogger.prime.usage.primeReceiveKytIntroAction({
            ...receiveKytIntroTrackingParams,
            action: 'learnMore',
          });
          openUrlExternal(RECEIVE_RISK_MONITORING_HELP_LINK);
        }}
        cursor="pointer"
      >
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          {intl.formatMessage({ id: ETranslations.global_learn_more })}
        </SizableText>
        <Icon name="ArrowTopRightOutline" size="$4.5" color="$iconSuccess" />
      </XStack>
    </YStack>
  );
}

// Root routes that present an overlay above the Home tab. While any of these is
// on top we must not auto-pop the KYT intro (modal, full-screen, onboarding…).
const KYT_BLOCKING_ROOT_ROUTE_NAMES = new Set<string>([
  ERootRoutes.Modal,
  ERootRoutes.iOSFullScreen,
  ERootRoutes.FullScreenPush,
  ERootRoutes.WebView,
  ERootRoutes.Onboarding,
  ERootRoutes.PermissionWebDevice,
]);

function isKytBlockingRootOverlayOpen() {
  const rootState = rootNavigationRef.current?.getRootState();
  // Unknown nav state → treat as blocked (defer + retry), safer than allowing.
  if (!rootState) {
    return true;
  }
  const hasMainRoute = rootState.routes.some(
    (r) => r.name === ERootRoutes.Main,
  );
  const top = rootState.routes[rootState.index ?? 0];
  return (
    !hasMainRoute || (!!top && KYT_BLOCKING_ROOT_ROUTE_NAMES.has(top.name))
  );
}

function hasOpenBlockingDialog() {
  return getDialogInstances().some((instance) => instance.isExist());
}

// The app-update flow must be fully settled before KYT may auto-pop, so we never
// fight the post-update What's New / changelog dialog or a force-update preview.
function isAppUpdateSettledForKyt(info: IAppUpdateInfo) {
  return (
    !isFirstLaunchAfterUpdated(info) && info.status === EAppUpdateStatus.done
  );
}

function useKYTIntroDialog() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { md } = useMedia();
  const { bottom } = useSafeAreaInsets();
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const mobileFooterBottomPadding = Math.max(bottom, 20) + 20;
  // Authoritative "Home is the focused tab" signal, written by the tab listener.
  const isHomeTabFocusedRef = useRef(false);
  // Becomes true once the Home token list has finished its first load (or a
  // fallback delay elapses). Gates the auto-pop so the dialog never animates in
  // while Home is still doing its heavy cold-start render — the source of the
  // visible frame drops when both happen at once.
  const isHomeReadyRef = useRef(false);
  // True once the intro has been shown (or is mid-show) for the current Prime
  // user; reset on account switch so each user is still evaluated once.
  const dialogShownRef = useRef(false);
  // Serializes async attempts so concurrent triggers can't open two dialogs.
  const attemptInFlightRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  // Stable indirection so scheduleRetry / the tab listener can invoke the latest
  // attemptShow without forming a useCallback dependency cycle or capturing a
  // stale closure (useListenTabFocusState registers its callback only once).
  const attemptShowRef = useRef<(() => void) | undefined>(undefined);
  // Latest Prime user id, read inside the async attempt to detect an account
  // switch that happened mid-flight (see attemptShow). Kept as a ref because the
  // in-flight closure otherwise only sees the user captured when it started.
  const onekeyUserIdRef = useRef(onekeyUserId);
  onekeyUserIdRef.current = onekeyUserId;

  const showDialog = useCallback(() => {
    defaultLogger.prime.usage.primeReceiveKytIntroShown(
      receiveKytIntroTrackingParams,
    );
    Dialog.show({
      icon: 'ShieldCheckDoneOutline',
      title: intl.formatMessage({
        id: ETranslations.prime_feature_receive_risk_monitoring__title,
      }),
      showFooter: true,
      onConfirmText: intl.formatMessage({
        id: ETranslations.kyt_receive_risk_monitoring_enable__action,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_not_now }),
      footerProps: md
        ? {
            flexDirection: 'column-reverse',
            gap: '$2.5',
            pb: mobileFooterBottomPadding,
          }
        : undefined,
      confirmButtonProps: md
        ? {
            ...mobileFooterButtonProps,
            size: 'large',
          }
        : undefined,
      cancelButtonProps: md
        ? {
            ...mobileFooterButtonProps,
            mx: '$0',
            my: '$0',
            px: '$5',
            py: '$3',
            size: 'large',
            variant: 'tertiary',
          }
        : undefined,
      renderContent: <KYTIntroDialogContent />,
      onConfirm: async (dialogInstance) => {
        defaultLogger.prime.usage.primeReceiveKytIntroAction({
          ...receiveKytIntroTrackingParams,
          action: 'enable',
        });
        // Enabling here records server-side authorization; only close on success.
        await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
          enabled: true,
        });
        await dialogInstance.close({ flag: 'confirm' });
        // Close the KYT dialog first, then prompt to enable notifications so the
        // user can actually receive high-risk push alerts.
        await promptKytNotificationPermissionIfNeeded({ navigation, intl });
      },
      onClose: (extra) => {
        // Mark "shown" only after the dialog is genuinely closed by the user
        // (confirm or dismiss), never before showing it — so an intro that gets
        // preempted/covered before the user sees it can still re-pop later.
        if (onekeyUserId) {
          void backgroundApiProxy.serviceSetting.setKytIntroShown({
            onekeyUserId,
          });
        }
        if (extra?.flag !== 'confirm') {
          defaultLogger.prime.usage.primeReceiveKytIntroAction({
            ...receiveKytIntroTrackingParams,
            action: 'dismiss',
          });
        }
      },
    });
  }, [intl, md, mobileFooterBottomPadding, navigation, onekeyUserId]);

  // "Ready" = Home is the foreground tab, Home has finished its first load, and
  // the app-update flow is settled — everything except transient overlays. Both
  // the auto-show gate and the retry-arming decision derive from this single
  // definition so they can't drift apart.
  const isReadyExceptOverlays = useCallback(
    () =>
      isHomeReadyRef.current &&
      isHomeTabFocusedRef.current &&
      isAppUpdateSettledForKyt(appUpdateInfo),
    [appUpdateInfo],
  );

  // Sync gate: the intro may auto-pop only when ready AND no blocking root
  // overlay or open dialog (including the featured-changelog Dialog.show()) is on
  // screen.
  const canAutoShowKytIntroNow = useCallback(
    () =>
      isReadyExceptOverlays() &&
      !isKytBlockingRootOverlayOpen() &&
      !hasOpenBlockingDialog(),
    [isReadyExceptOverlays],
  );

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, []);

  // Covers the one gap router/atom triggers can't: a non-route Dialog.show()
  // (e.g. the featured changelog) closing emits no navigation/atom change, so we
  // re-check on a short, bounded timer while Home + update are otherwise ready.
  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) {
      return;
    }
    if (retryCountRef.current >= 15) {
      return;
    }
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = undefined;
      retryCountRef.current += 1;
      if (!isMountedRef.current || dialogShownRef.current) {
        return;
      }
      attemptShowRef.current?.();
    }, 1000);
  }, []);

  const attemptShow = useCallback(() => {
    // Covers re-entries that bypass the timer's own guard (the finally-block
    // re-invoke and the route/atom triggers racing an unmount).
    if (!isMountedRef.current) {
      return;
    }
    if (!isPrimeSubscriptionActive || !onekeyUserId) {
      return;
    }
    if (dialogShownRef.current || attemptInFlightRef.current) {
      return;
    }

    if (!canAutoShowKytIntroNow()) {
      // Only arm the fallback timer when the sole blocker is a transient
      // overlay/dialog; otherwise wait for the next trigger (route/atom/tokens).
      if (isReadyExceptOverlays()) {
        scheduleRetry();
      }
      return;
    }

    attemptInFlightRef.current = true;
    // Snapshot the user this attempt is evaluating; if the Prime user switches
    // while we await below, the results belong to a stale user and must not be
    // applied to the (now different) current user's "shown" guard.
    const requestUserId = onekeyUserId;
    void (async () => {
      try {
        const isShown = await backgroundApiProxy.serviceSetting.isKytIntroShown(
          {
            onekeyUserId,
          },
        );
        if (requestUserId !== onekeyUserIdRef.current) {
          return;
        }
        if (isShown) {
          dialogShownRef.current = true;
          return;
        }
        // Only prompt when the server reports KYT is not yet enabled, so users
        // who already turned it on never see the intro again.
        const kytEnabled =
          await backgroundApiProxy.serviceSetting.getKytEnabled({
            onekeyUserId,
          });
        if (requestUserId !== onekeyUserIdRef.current) {
          return;
        }
        if (kytEnabled) {
          dialogShownRef.current = true;
          return;
        }
        // The hook may have unmounted during the awaits — Dialog.show is a
        // global imperative API, so without this check the intro could still
        // pop after unmount.
        if (!isMountedRef.current) {
          return;
        }
        // Overlay state may have changed during the awaits — re-check.
        if (!canAutoShowKytIntroNow()) {
          if (isReadyExceptOverlays()) {
            scheduleRetry();
          }
          return;
        }
        dialogShownRef.current = true;
        clearRetry();
        showDialog();
      } finally {
        attemptInFlightRef.current = false;
        // The user switched mid-flight: the early returns above intentionally
        // skipped the now-current user, and that switch's own trigger was
        // dropped by the in-flight guard. Re-evaluate once for the new user.
        if (requestUserId !== onekeyUserIdRef.current) {
          attemptShowRef.current?.();
        }
      }
    })();
  }, [
    isPrimeSubscriptionActive,
    onekeyUserId,
    isReadyExceptOverlays,
    canAutoShowKytIntroNow,
    scheduleRetry,
    clearRetry,
    showDialog,
  ]);

  useEffect(() => {
    attemptShowRef.current = attemptShow;
  }, [attemptShow]);

  // Defer the very first auto-pop until the Home token list has finished its
  // initial load (or a fallback delay), so the dialog doesn't animate in during
  // the heavy cold-start render and cause visible frame drops. Once Home is
  // ready, subsequent attempts are driven by the route/atom/timer triggers.
  useEffect(() => {
    const cleanup = runAfterTokensDone({
      onRun: () => {
        isHomeReadyRef.current = true;
        attemptShowRef.current?.();
      },
    });
    return cleanup;
  }, []);

  // Reset the per-user "shown" guard when the Prime user switches so each
  // account is evaluated once. Declared before the attempt triggers so that, on
  // a user change, the guard is cleared before attemptShow re-runs this commit.
  useEffect(() => {
    dialogShownRef.current = false;
    retryCountRef.current = 0;
    clearRetry();
  }, [onekeyUserId, clearRetry]);

  // Trigger A: re-attempt whenever an input captured by attemptShow changes
  // (Prime status, Prime user, or app-update status/strategy transitions).
  useEffect(() => {
    attemptShow();
  }, [attemptShow]);

  // Trigger B: any router change (modal/onboarding/full-screen open or close,
  // tab switch). Invoke via the ref so we always call the latest attemptShow —
  // useListenTabFocusState registers its callback only once at mount.
  useListenTabFocusState(ETabRoutes.Home, (isFocus) => {
    isHomeTabFocusedRef.current = isFocus;
    attemptShowRef.current?.();
  });

  useEffect(() => {
    // Re-arm on every (re)mount — with only a cleanup, a StrictMode replay or a
    // genuine remount would leave the ref permanently false and silently kill
    // the retry timer and the attempt guards.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearRetry();
    };
  }, [clearRetry]);
}

function BasicKYTIntroOnMount() {
  useKYTIntroDialog();
  return null;
}

export const KYTIntroOnMount = memo(BasicKYTIntroOnMount);

import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
  getDialogInstances,
  rootNavigationRef,
  useMedia,
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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IReceiveKytIntroEntryPoint } from '@onekeyhq/shared/types/kyt';

import {
  type IPrimeSubscriptionPurchaseSuccessPayload,
  getErrorMessage,
} from '../../../Prime/primeSubscriptionPurchaseSuccess';

import { promptKytNotificationPermissionIfNeeded } from './showKytNotificationPermissionDialog';

type IKytIntroActiveClaim = {
  claimId: string;
  entryPoint: IReceiveKytIntroEntryPoint;
  isPresented: boolean;
  onekeyUserId: string;
};

// The buffered purchase-success trigger for the current runtime; the claimId
// is meaningless without the user it belongs to, so they travel as one value.
type IKytIntroPendingPurchase = {
  userId: string;
  claimId?: string;
};

function buildReceiveKytIntroTrackingParams(
  entryPoint: IReceiveKytIntroEntryPoint,
) {
  return {
    featureName: EPrimeFeatures.ReceiveRiskMonitoring,
    entryPoint,
    isPrimeActive: true,
  } as const;
}

const mobileFooterButtonProps = {
  flexGrow: 0,
  flexBasis: 'auto',
  w: '100%',
  justifyContent: 'center',
  textAlign: 'center',
} as const;

function KYTIntroDialogContent({
  entryPoint,
}: {
  entryPoint: IReceiveKytIntroEntryPoint;
}) {
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
            ...buildReceiveKytIntroTrackingParams(entryPoint),
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

function isKytPurchaseSurfaceOpen() {
  const rootState = rootNavigationRef.current?.getRootState();
  if (!rootState) {
    return true;
  }
  const top = rootState.routes[rootState.index ?? 0];
  if (top?.name === ERootRoutes.WebView) {
    return true;
  }
  // The Prime purchase WebView mounts as Modal -> WebViewModal
  // (openUrlByWebviewPro), not under ERootRoutes.WebView. Right after
  // navigate the nested state may not be materialized yet, so fall back to
  // the pending params screen.
  if (top?.name === ERootRoutes.Modal) {
    const nestedRoutes = (
      top.state as { routes?: { name: string }[] } | undefined
    )?.routes;
    if (nestedRoutes) {
      return nestedRoutes.some(
        (route) => route.name === EModalRoutes.WebViewModal,
      );
    }
    return (
      (top.params as { screen?: string } | undefined)?.screen ===
      EModalRoutes.WebViewModal
    );
  }
  return false;
}

function isKytHomeTabActuallyFocused() {
  const rootState = rootNavigationRef.current?.getRootState();
  const mainRoute = rootState?.routes.find(
    (route) => route.name === ERootRoutes.Main,
  );
  const tabState = mainRoute?.state as
    | { index?: number; routes?: { name: string }[] }
    | undefined;
  return tabState?.routes?.[tabState.index ?? 0]?.name === ETabRoutes.Home;
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
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  // Authoritative "Home is the focused tab" signal, written by the tab listener.
  const isHomeTabFocusedRef = useRef(false);
  // Becomes true once the Home token list has finished its first load (or a
  // fallback delay elapses). Gates the auto-pop so the dialog never animates in
  // while Home is still doing its heavy cold-start render — the source of the
  // visible frame drops when both happen at once.
  const isHomeReadyRef = useRef(false);
  const homeReadinessCleanupRef = useRef<(() => void) | undefined>(undefined);
  // True once the intro has been shown (or is mid-show) for the current Prime
  // user; reset on account switch so each user is still evaluated once.
  const dialogShownRef = useRef(false);
  // Purchase-success prompts bypass the Home readiness gate but still share the
  // same per-user eligibility and single-flight guards as the Home fallback.
  const pendingPurchaseRef = useRef<IKytIntroPendingPurchase | undefined>(
    undefined,
  );
  const activeClaimRef = useRef<IKytIntroActiveClaim | undefined>(undefined);
  const isPrimeSubscriptionActiveRef = useRef(isPrimeSubscriptionActive);
  isPrimeSubscriptionActiveRef.current = isPrimeSubscriptionActive;
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

  const showDialog = useCallback(
    ({
      claimId,
      entryPoint,
      targetUserId,
    }: {
      claimId: string;
      entryPoint: IReceiveKytIntroEntryPoint;
      targetUserId: string;
    }) => {
      const trackingParams = buildReceiveKytIntroTrackingParams(entryPoint);
      defaultLogger.prime.usage.primeReceiveKytIntroShown(trackingParams);
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
              // No bottom safe-area inset here: the Dialog frame already pads by
              // the safe-area bottom, so the footer keeps only its default "$5".
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
        renderContent: <KYTIntroDialogContent entryPoint={entryPoint} />,
        onConfirm: async (dialogInstance) => {
          if (onekeyUserIdRef.current !== targetUserId) {
            await dialogInstance.close({ flag: 'accountChanged' });
            return;
          }
          defaultLogger.prime.usage.primeReceiveKytIntroAction({
            ...trackingParams,
            action: 'enable',
          });
          // Enabling here records server-side authorization; only close on success.
          const result =
            await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
              enabled: true,
              onekeyUserId: targetUserId,
            });
          if (
            !result.applied ||
            result.accountChanged ||
            onekeyUserIdRef.current !== targetUserId
          ) {
            await dialogInstance.close({ flag: 'accountChanged' });
            return;
          }
          if (!result.kytEnabled) {
            // The server acknowledged the request but left KYT disabled. Keep
            // the dialog open so the user can retry instead of permanently
            // marking the intro as shown for a feature that never turned on.
            dialogInstance.preventClose();
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              }),
            });
            return;
          }
          await dialogInstance.close({ flag: 'confirm' });
          // Close the KYT dialog first, then prompt to enable notifications so the
          // user can actually receive high-risk push alerts.
          await promptKytNotificationPermissionIfNeeded({ navigation, intl });
        },
        onClose: (extra) => {
          // Mark "shown" only after the dialog is genuinely closed by the user
          // (confirm or dismiss), never before showing it — so an intro that gets
          // preempted/covered before the user sees it can still re-pop later.
          void backgroundApiProxy.serviceSetting
            .completeKytIntroClaim({ onekeyUserId: targetUserId })
            .catch((error) => {
              defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
                stage: 'claimComplete',
                errorMessage: getErrorMessage(error),
              });
            });
          if (activeClaimRef.current?.claimId === claimId) {
            activeClaimRef.current = undefined;
          }
          if (extra?.flag !== 'confirm' && extra?.flag !== 'accountChanged') {
            defaultLogger.prime.usage.primeReceiveKytIntroAction({
              ...trackingParams,
              action: 'dismiss',
            });
          }
        },
      });
    },
    [intl, md, navigation],
  );

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

  // A confirmed purchase is allowed to prompt outside Home. It only waits for
  // the purchase WebView and any currently visible dialog to finish closing.
  const canShowKytIntroAfterPurchaseNow = useCallback(
    () => !isKytPurchaseSurfaceOpen() && !hasOpenBlockingDialog(),
    [],
  );

  // Single point for the per-entry-point show policy used at every gate check.
  const canShowFor = useCallback(
    (entryPoint: IReceiveKytIntroEntryPoint) =>
      entryPoint === 'primeSubscribeSuccess'
        ? canShowKytIntroAfterPurchaseNow()
        : canAutoShowKytIntroNow(),
    [canAutoShowKytIntroNow, canShowKytIntroAfterPurchaseNow],
  );

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, []);

  const releaseClaim = useCallback(
    async (claim: Pick<IKytIntroActiveClaim, 'claimId' | 'onekeyUserId'>) => {
      try {
        await backgroundApiProxy.serviceSetting.releaseKytIntroClaim({
          onekeyUserId: claim.onekeyUserId,
          ownerId: appEventBus.nodeId,
          claimId: claim.claimId,
        });
      } catch (error) {
        defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
          stage: 'claimRelease',
          errorMessage: getErrorMessage(error),
        });
      }
    },
    [],
  );

  // Releases and forgets the buffered purchase trigger when it can no longer
  // apply (account switch, unmount, or an event for another user).
  const releaseStalePendingPurchase = useCallback(() => {
    const pending = pendingPurchaseRef.current;
    pendingPurchaseRef.current = undefined;
    if (
      pending?.claimId &&
      pending.claimId !== activeClaimRef.current?.claimId
    ) {
      void releaseClaim({
        claimId: pending.claimId,
        onekeyUserId: pending.userId,
      });
    }
  }, [releaseClaim]);

  // Releases a claim this attempt no longer intends to present and clears the
  // active-claim slot if it still points at that claim.
  const abandonActiveClaim = useCallback(
    async (claim: Pick<IKytIntroActiveClaim, 'claimId' | 'onekeyUserId'>) => {
      await releaseClaim(claim);
      if (activeClaimRef.current?.claimId === claim.claimId) {
        activeClaimRef.current = undefined;
      }
    },
    [releaseClaim],
  );

  // Covers non-route dialogs closing, transient RPC failures, and another UI
  // runtime abandoning an expired lease. Overlay retries are bounded; a lease
  // retry waits directly for the persisted expiry and does not consume them.
  const scheduleRetry = useCallback(
    ({
      delayMs = 1000,
      incrementRetryCount = true,
    }: {
      delayMs?: number;
      incrementRetryCount?: boolean;
    } = {}) => {
      if (retryTimerRef.current) {
        return;
      }
      if (incrementRetryCount && retryCountRef.current >= 15) {
        return;
      }
      retryTimerRef.current = setTimeout(
        () => {
          retryTimerRef.current = undefined;
          if (incrementRetryCount) {
            retryCountRef.current += 1;
          }
          if (!isMountedRef.current || dialogShownRef.current) {
            return;
          }
          attemptShowRef.current?.();
        },
        Math.max(0, delayMs),
      );
    },
    [],
  );

  // Purchase-success prompts always re-arm the retry timer; the Home fallback
  // re-arms only while its durable readiness gates are already satisfied.
  const armRetryFor = useCallback(
    (entryPoint: IReceiveKytIntroEntryPoint) => {
      if (entryPoint === 'primeSubscribeSuccess' || isReadyExceptOverlays()) {
        scheduleRetry();
      }
    },
    [isReadyExceptOverlays, scheduleRetry],
  );

  const attemptShow = useCallback(() => {
    // Covers re-entries that bypass the timer's own guard (the finally-block
    // re-invoke and the route/atom triggers racing an unmount).
    if (!isMountedRef.current) {
      return;
    }

    const currentUserId = onekeyUserIdRef.current;
    if (
      pendingPurchaseRef.current &&
      pendingPurchaseRef.current.userId !== currentUserId
    ) {
      // A purchase event belongs to the account that initiated it. Never carry
      // it across an account switch.
      releaseStalePendingPurchase();
    }

    const isPurchaseSuccessTrigger =
      !!currentUserId && pendingPurchaseRef.current?.userId === currentUserId;
    if (
      !currentUserId ||
      (!isPurchaseSuccessTrigger && !isPrimeSubscriptionActiveRef.current)
    ) {
      return;
    }
    if (dialogShownRef.current) {
      if (pendingPurchaseRef.current?.userId === currentUserId) {
        pendingPurchaseRef.current = undefined;
      }
      return;
    }
    if (attemptInFlightRef.current) {
      return;
    }

    const requestEntryPoint: IReceiveKytIntroEntryPoint =
      isPurchaseSuccessTrigger ? 'primeSubscribeSuccess' : 'homeAutoIntro';
    if (!canShowFor(requestEntryPoint)) {
      armRetryFor(requestEntryPoint);
      return;
    }

    attemptInFlightRef.current = true;
    // Snapshot the user this attempt is evaluating; if the Prime user switches
    // while we await below, the results belong to a stale user and must not be
    // applied to the (now different) current user's "shown" guard.
    const requestUserId = currentUserId;
    const pendingPurchaseUserIdAtStart = pendingPurchaseRef.current?.userId;
    void (async () => {
      try {
        let claimResult =
          await backgroundApiProxy.serviceSetting.tryClaimKytIntro({
            onekeyUserId: requestUserId,
            ownerId: appEventBus.nodeId,
            entryPoint: requestEntryPoint,
            claimId:
              pendingPurchaseRef.current?.claimId ??
              (activeClaimRef.current?.onekeyUserId === requestUserId
                ? activeClaimRef.current.claimId
                : undefined),
          });

        // A purchase event can arrive while a Home claim RPC is in flight. Run
        // one serialized upgrade so the BG lease, not only the UI analytics,
        // carries the higher-priority entry point.
        if (
          claimResult.status === 'claimed' &&
          claimResult.entryPoint === 'homeAutoIntro' &&
          pendingPurchaseRef.current?.userId === requestUserId
        ) {
          claimResult =
            await backgroundApiProxy.serviceSetting.tryClaimKytIntro({
              onekeyUserId: requestUserId,
              ownerId: appEventBus.nodeId,
              entryPoint: 'primeSubscribeSuccess',
              claimId:
                pendingPurchaseRef.current?.claimId ?? claimResult.claimId,
            });
        }

        if (claimResult.status !== 'claimed') {
          if (
            claimResult.status === 'shown' ||
            claimResult.status === 'enabled'
          ) {
            dialogShownRef.current = true;
            activeClaimRef.current = undefined;
            if (pendingPurchaseRef.current?.userId === requestUserId) {
              pendingPurchaseRef.current = undefined;
            }
          } else if (claimResult.status === 'claimedByOther') {
            scheduleRetry({
              delayMs: claimResult.retryAfterMs + 100,
              incrementRetryCount: false,
            });
          }
          return;
        }

        const entryPoint = claimResult.entryPoint;
        const activeClaim: IKytIntroActiveClaim = {
          claimId: claimResult.claimId,
          entryPoint,
          isPresented: false,
          onekeyUserId: requestUserId,
        };
        activeClaimRef.current = activeClaim;

        if (
          requestUserId !== onekeyUserIdRef.current ||
          !isMountedRef.current
        ) {
          await abandonActiveClaim(activeClaim);
          return;
        }
        if (
          entryPoint === 'homeAutoIntro' &&
          !isPrimeSubscriptionActiveRef.current
        ) {
          await abandonActiveClaim(activeClaim);
          return;
        }

        // Overlay state may have changed during the awaits — re-check the gate
        // for the final (possibly upgraded) trigger.
        if (!canShowFor(entryPoint)) {
          armRetryFor(entryPoint);
          return;
        }

        const isClaimPresented =
          await backgroundApiProxy.serviceSetting.markKytIntroClaimPresented({
            onekeyUserId: requestUserId,
            ownerId: appEventBus.nodeId,
            claimId: activeClaim.claimId,
          });
        if (!isClaimPresented) {
          activeClaimRef.current = undefined;
          scheduleRetry();
          return;
        }

        const canShowAfterMarking =
          requestUserId === onekeyUserIdRef.current &&
          isMountedRef.current &&
          canShowFor(entryPoint);
        if (!canShowAfterMarking) {
          await abandonActiveClaim(activeClaim);
          armRetryFor(entryPoint);
          return;
        }

        clearRetry();
        try {
          showDialog({
            claimId: activeClaim.claimId,
            entryPoint,
            targetUserId: requestUserId,
          });
        } catch (error) {
          await abandonActiveClaim(activeClaim);
          throw error;
        }
        activeClaim.isPresented = true;
        dialogShownRef.current = true;
        if (pendingPurchaseRef.current?.userId === requestUserId) {
          pendingPurchaseRef.current = undefined;
        }
      } catch (error) {
        defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
          stage: 'eligibility',
          errorMessage: getErrorMessage(error),
        });
        if (
          requestUserId === onekeyUserIdRef.current &&
          isMountedRef.current &&
          (pendingPurchaseRef.current?.userId === requestUserId ||
            isReadyExceptOverlays())
        ) {
          scheduleRetry();
        }
      } finally {
        attemptInFlightRef.current = false;
        // The user switched mid-flight: the early returns above intentionally
        // skipped the now-current user, and that switch's own trigger was
        // dropped by the in-flight guard. Re-evaluate once for the new user.
        if (
          requestUserId !== onekeyUserIdRef.current ||
          (pendingPurchaseUserIdAtStart !==
            pendingPurchaseRef.current?.userId &&
            pendingPurchaseRef.current?.userId === onekeyUserIdRef.current)
        ) {
          attemptShowRef.current?.();
        }
      }
    })();
  }, [
    isReadyExceptOverlays,
    canShowFor,
    armRetryFor,
    scheduleRetry,
    clearRetry,
    abandonActiveClaim,
    releaseStalePendingPurchase,
    showDialog,
  ]);

  useEffect(() => {
    attemptShowRef.current = attemptShow;
  }, [attemptShow]);

  useEffect(() => {
    const handlePurchaseSuccess = (
      payload: IPrimeSubscriptionPurchaseSuccessPayload,
    ) => {
      if (
        !payload?.onekeyUserId ||
        payload.onekeyUserId !== onekeyUserIdRef.current ||
        dialogShownRef.current
      ) {
        if (
          payload?.onekeyUserId &&
          payload.claimId &&
          payload.claimId !== activeClaimRef.current?.claimId
        ) {
          void releaseClaim({
            claimId: payload.claimId,
            onekeyUserId: payload.onekeyUserId,
          });
        }
        return;
      }
      pendingPurchaseRef.current = {
        userId: payload.onekeyUserId,
        claimId: payload.claimId,
      };
      retryCountRef.current = 0;
      clearRetry();
      attemptShowRef.current?.();
    };
    appEventBus.on(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      handlePurchaseSuccess,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
        handlePurchaseSuccess,
      );
    };
  }, [clearRetry, releaseClaim]);

  // Reset the per-user "shown" guard when the Prime user switches so each
  // account is evaluated once. Declared before the attempt triggers so that, on
  // a user change, the guard is cleared before attemptShow re-runs this commit.
  useEffect(() => {
    dialogShownRef.current = false;
    const activeClaim = activeClaimRef.current;
    if (
      activeClaim &&
      activeClaim.onekeyUserId !== onekeyUserId &&
      !activeClaim.isPresented
    ) {
      void releaseClaim(activeClaim);
      activeClaimRef.current = undefined;
    }
    if (
      pendingPurchaseRef.current &&
      pendingPurchaseRef.current.userId !== onekeyUserId
    ) {
      releaseStalePendingPurchase();
    }
    retryCountRef.current = 0;
    clearRetry();
  }, [onekeyUserId, clearRetry, releaseClaim, releaseStalePendingPurchase]);

  // Trigger A: re-attempt whenever an input read by attemptShow changes.
  // isPrimeSubscriptionActive / onekeyUserId are read via refs (assigned during
  // render above); they stay in the dep array purely to re-trigger the attempt.
  useEffect(() => {
    attemptShow();
  }, [attemptShow, isPrimeSubscriptionActive, onekeyUserId]);

  // Trigger B: any router change (modal/onboarding/full-screen open or close,
  // tab switch). Invoke via the ref so we always call the latest attemptShow —
  // useListenTabFocusState registers its callback only once at mount.
  useListenTabFocusState(ETabRoutes.Home, (isFocus) => {
    isHomeTabFocusedRef.current = isFocus;
    if (
      isFocus &&
      !isHomeReadyRef.current &&
      !homeReadinessCleanupRef.current &&
      isKytHomeTabActuallyFocused()
    ) {
      // Match the previous Home-owned lifecycle: the cold-start fallback begins
      // only when Home is first entered, not when the global Prime effect mounts.
      homeReadinessCleanupRef.current = runAfterTokensDone({
        onRun: () => {
          homeReadinessCleanupRef.current = undefined;
          isHomeReadyRef.current = true;
          attemptShowRef.current?.();
        },
      });
    }
    attemptShowRef.current?.();
  });

  useEffect(() => {
    // Re-arm on every (re)mount — with only a cleanup, a StrictMode replay or a
    // genuine remount would leave the ref permanently false and silently kill
    // the retry timer and the attempt guards.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      homeReadinessCleanupRef.current?.();
      homeReadinessCleanupRef.current = undefined;
      clearRetry();
      const activeClaim = activeClaimRef.current;
      if (activeClaim && !activeClaim.isPresented) {
        void releaseClaim(activeClaim);
        activeClaimRef.current = undefined;
      }
      releaseStalePendingPurchase();
    };
  }, [clearRetry, releaseClaim, releaseStalePendingPurchase]);
}

function BasicKYTIntroOnMount() {
  useKYTIntroDialog();
  return null;
}

export const KYTIntroOnMount = memo(BasicKYTIntroOnMount);

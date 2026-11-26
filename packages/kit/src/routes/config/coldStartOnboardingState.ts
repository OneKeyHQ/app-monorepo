import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import * as Linking from 'expo-linking';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/appUpdate';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import {
  EAppUpdateStatus,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import launchOptionsManager from '@onekeyhq/shared/src/modules/LaunchOptionsManager';
import { ELaunchOptionsLaunchType } from '@onekeyhq/shared/src/modules/LaunchOptionsManager/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { isFreshInstallSync } from '@onekeyhq/shared/src/utils/freshInstallDetector';
import { parseMarketWidgetLinkUrl } from '@onekeyhq/shared/src/utils/marketWidgetUtils';
import { readWalletPresenceHintSync } from '@onekeyhq/shared/src/utils/walletPresenceHintUtils';

import type { InitialState } from '@react-navigation/native';

type IColdStartEntry =
  | 'locked'
  | 'travel-mode'
  | 'forced-update'
  | 'launch-intent'
  | 'unknown-entry'
  | 'wallet'
  | 'onboarding';

export type IColdStartOverride = Extract<
  IColdStartEntry,
  'locked' | 'travel-mode' | 'forced-update'
>;

export type IColdStartState =
  | { phase: 'resolving' }
  | { phase: 'waiting-for-onboarding' }
  | { phase: 'ready'; entry: IColdStartEntry; lateOrdinaryLaunch?: true };

export type IColdStartEvent =
  | { type: 'entry-resolved'; entry: IColdStartEntry }
  | { type: 'interrupted'; entry: IColdStartOverride | 'launch-intent' }
  | { type: 'onboarding-ready' }
  | { type: 'late-ordinary-launch' }
  | { type: 'timed-out' };

export function reduceColdStart(
  state: IColdStartState,
  event: IColdStartEvent,
): IColdStartState {
  if (state.phase === 'ready') {
    return state.entry === 'unknown-entry' &&
      event.type === 'late-ordinary-launch'
      ? { phase: 'ready', entry: 'wallet', lateOrdinaryLaunch: true }
      : state;
  }
  switch (event.type) {
    case 'entry-resolved':
      if (state.phase !== 'resolving') {
        return state;
      }
      return event.entry === 'onboarding'
        ? { phase: 'waiting-for-onboarding' }
        : { phase: 'ready', entry: event.entry };
    case 'onboarding-ready':
      return state.phase === 'waiting-for-onboarding'
        ? { phase: 'ready', entry: 'onboarding' }
        : state;
    case 'interrupted':
      return { phase: 'ready', entry: event.entry };
    case 'timed-out':
      return {
        phase: 'ready',
        entry:
          state.phase === 'waiting-for-onboarding'
            ? 'onboarding'
            : 'unknown-entry',
      };
    default:
      return state;
  }
}

export const ColdStartContext = createContext<
  | {
      state: IColdStartState;
      dispatch: (event: IColdStartEvent) => void;
      claimReconciliation: () => boolean;
    }
  | undefined
>(undefined);

export function useColdStart() {
  return useContext(ColdStartContext);
}

// Bound the local launch-options probe. A missing answer never grants the
// ordinary launch branch.
const LAUNCH_OPTIONS_TIMEOUT_MS = 300;
const ONBOARDING_READY_TIMEOUT_MS = 5000;

export function useNativeColdStart(hasLaunchNotification: boolean) {
  const [isLocked] = useAppIsLockedAtom();
  const [update] = useAppUpdatePersistAtom();
  let override: IColdStartOverride | undefined;
  if (isLocked) {
    override = 'locked';
  } else if (
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  ) {
    override = 'travel-mode';
  } else if (
    update.updateStrategy === EUpdateStrategy.force &&
    update.status !== EAppUpdateStatus.done
  ) {
    override = 'forced-update';
  }

  const [state, dispatch] = useReducer(
    reduceColdStart,
    override,
    (entry): IColdStartState =>
      entry ? { phase: 'ready', entry } : { phase: 'resolving' },
  );

  const launchResolved = useRef(Boolean(override));

  useLayoutEffect(() => {
    if (override) {
      launchResolved.current = true;
      dispatch({ type: 'interrupted', entry: override });
    }
  }, [override]);

  useEffect(() => {
    if (launchResolved.current) {
      return;
    }
    if (hasLaunchNotification) {
      launchResolved.current = true;
      dispatch({ type: 'entry-resolved', entry: 'launch-intent' });
      return;
    }

    let cancelled = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      dispatch({ type: 'timed-out' });
    }, LAUNCH_OPTIONS_TIMEOUT_MS);

    void (async () => {
      const [initialUrl, options] = await Promise.all([
        Linking.getInitialURL(),
        launchOptionsManager.getLaunchOptions(),
      ]);
      if (cancelled || launchResolved.current) return;
      // A background-started iOS host can still hold the original scene URL.
      const url =
        initialUrl ??
        (platformEnv.isNativeIOS ? Linking.getLinkingURL() : null);
      const widgetLink = url ? parseMarketWidgetLinkUrl(url) : undefined;
      const hasLaunchUrl = Boolean(
        url && (!widgetLink?.matches || widgetLink.target),
      );
      if (
        hasLaunchUrl ||
        options?.launchType === ELaunchOptionsLaunchType.localNotification ||
        options?.launchType === ELaunchOptionsLaunchType.remoteNotification ||
        options?.localNotification ||
        options?.remoteNotification
      ) {
        launchResolved.current = true;
        dispatch({ type: 'entry-resolved', entry: 'launch-intent' });
        return;
      }

      if (timedOut) {
        launchResolved.current = true;
        dispatch({ type: 'late-ordinary-launch' });
        return;
      }

      const hint = readWalletPresenceHintSync();
      const opensOnboarding =
        hint === 'no_wallet' || (hint === undefined && isFreshInstallSync());
      launchResolved.current = true;
      dispatch({
        type: 'entry-resolved',
        entry: opensOnboarding ? 'onboarding' : 'wallet',
      });
    })()
      .catch(() => {
        if (!cancelled) {
          launchResolved.current = true;
          dispatch({ type: 'entry-resolved', entry: 'unknown-entry' });
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [hasLaunchNotification]);

  useEffect(() => {
    if (state.phase !== 'waiting-for-onboarding') {
      return;
    }
    const timeout = setTimeout(
      () => dispatch({ type: 'timed-out' }),
      ONBOARDING_READY_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, [state.phase]);

  const reconciliationClaimed = useRef(false);
  const claimReconciliation = useCallback(() => {
    if (reconciliationClaimed.current) {
      return false;
    }
    reconciliationClaimed.current = true;
    return true;
  }, []);
  return useMemo(
    () => ({ state, dispatch, claimReconciliation }),
    [state, claimReconciliation],
  );
}

const COLD_START_ONBOARDING_PARAM = 'coldStartOnboarding';

export function isColdStartOnboardingRoute(
  route: { name: string; params?: object } | undefined,
): boolean {
  const params = route?.params;
  return (
    route?.name === ERootRoutes.Onboarding &&
    !!params &&
    COLD_START_ONBOARDING_PARAM in params &&
    params[COLD_START_ONBOARDING_PARAM] === true
  );
}

export function getColdStartOnboardingInitialState(): InitialState {
  return {
    index: 1,
    routes: [
      { name: ERootRoutes.Main },
      {
        name: ERootRoutes.Onboarding,
        params: {
          [COLD_START_ONBOARDING_PARAM]: true,
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        },
      },
    ],
  };
}

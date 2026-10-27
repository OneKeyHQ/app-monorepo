import { useCallback, useEffect, useRef } from 'react';

import { AppState } from 'react-native';

import { rootNavigationRef, useOnRouterChange } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { stopLeftoverNativeReplay } from '@onekeyhq/shared/src/modules3rdParty/posthog/replayEarlyStop';
import {
  acquireReplayPause,
  notifyReplayActivity,
  setReplayCondition,
  setReplayRouteAllowed,
} from '@onekeyhq/shared/src/modules3rdParty/posthog/replayGate';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { setInAppBrowserLifecycleListener } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { classifyReplayRoute } from '../../components/SessionReplay/replayRouteClassifier';
import { useShouldUseSplitView } from '../../hooks/useShouldUseSplitView';

import type { IReplayNavState } from '../../components/SessionReplay/replayRouteClassifier';
import type { AppStateStatus } from 'react-native';

// Runs when this eager main-runtime module loads, before the delayed replay
// init and its bg calls: a recorder left running by a previous JS context in
// the same process must not capture the new context's first screens.
void stopLeftoverNativeReplay();

// Android Custom Tabs resolve as soon as they launch; the activity pause that
// follows is what backgrounds the app. Hold the pause until the app is active
// again, or give up if it never left the foreground.
const ANDROID_IN_APP_BROWSER_GRACE_MS = 3000;

function releaseWhenAppReturns(release: () => void) {
  let leftForeground = AppState.currentState !== 'active';
  let done = false;
  const cleanups: (() => void)[] = [];
  const finish = () => {
    if (done) {
      return;
    }
    done = true;
    cleanups.forEach((cleanup) => cleanup());
    release();
  };
  const subscription = AppState.addEventListener('change', (next) => {
    if (next !== 'active') {
      leftForeground = true;
      return;
    }
    if (leftForeground) {
      finish();
    }
  });
  const timer = setTimeout(() => {
    if (!leftForeground) {
      finish();
    }
  }, ANDROID_IN_APP_BROWSER_GRACE_MS);
  cleanups.push(
    () => subscription.remove(),
    () => clearTimeout(timer),
  );
}

function isTravelModeActive(): boolean {
  try {
    return (
      travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
      'travel-mode'
    );
  } catch {
    return true;
  }
}

// Feeds navigation, app state, split view, travel mode and the native in-app
// browser into the replay gate. UI runtime only; renders nothing.
export function SessionReplayRouteGate() {
  const [{ selectedBrowserTab }] = useSettingsPersistAtom();
  const isDiscoveryEarnSelected = Boolean(
    platformEnv.isNative && selectedBrowserTab === ETranslations.global_earn,
  );
  const isDiscoveryEarnSelectedRef = useRef(isDiscoveryEarnSelected);
  isDiscoveryEarnSelectedRef.current = isDiscoveryEarnSelected;
  const lastStateRef = useRef<IReplayNavState | undefined>(undefined);
  const shouldUseSplitView = useShouldUseSplitView();

  const evaluateRoute = useCallback((state: IReplayNavState | undefined) => {
    try {
      const decision = classifyReplayRoute({
        state,
        isDiscoveryEarnSelected: isDiscoveryEarnSelectedRef.current,
      });
      setReplayRouteAllowed(decision.allowed, decision.routeKey);
    } catch {
      setReplayRouteAllowed(false);
    }
    notifyReplayActivity();
  }, []);

  // useOnRouterChange keeps the first callback for the life of the component,
  // so everything it reads goes through refs.
  useOnRouterChange((state) => {
    lastStateRef.current = state;
    evaluateRoute(state);
  });

  // The Discovery header sub-tab is not part of the navigation state.
  useEffect(() => {
    evaluateRoute(
      lastStateRef.current ?? rootNavigationRef.current?.getRootState(),
    );
  }, [evaluateRoute, isDiscoveryEarnSelected]);

  useEffect(() => {
    setReplayCondition('splitView', shouldUseSplitView);
  }, [shouldUseSplitView]);

  useEffect(() => {
    // Desktop gets AppState from react-native-web, which follows document
    // visibility.
    const applyAppState = (appState: AppStateStatus) => {
      const isActive = appState === 'active';
      setReplayCondition('background', !isActive);
      if (isActive) {
        setReplayCondition('travelMode', isTravelModeActive());
        notifyReplayActivity();
      }
    };
    setReplayCondition('travelMode', isTravelModeActive());
    applyAppState(AppState.currentState);
    const subscription = AppState.addEventListener('change', applyAppState);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(
    () =>
      setInAppBrowserLifecycleListener(() => {
        const release = acquireReplayPause('inAppBrowser');
        return () => {
          if (platformEnv.isNativeAndroid) {
            releaseWhenAppReturns(release);
          } else {
            release();
          }
        };
      }),
    [],
  );

  useEffect(
    () => () => {
      setReplayRouteAllowed(false);
    },
    [],
  );

  return null;
}

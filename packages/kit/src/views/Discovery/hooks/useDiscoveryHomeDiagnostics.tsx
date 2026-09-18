import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useIsFocused } from '@react-navigation/core';
import { AppState } from 'react-native';

import { rootNavigationRef } from '@onekeyhq/components';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { getRootRoutersLength } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IDiscoveryHomeDiagFocusGate,
  IDiscoveryHomeDiagLifecycleEvent,
} from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/homeDiagnostics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import type { LayoutChangeEvent } from 'react-native';

// OK-63713 diagnostics for the native Discovery home. Everything here is
// local-only (NativeLogger) and logs on change, never per render.
export const isDiscoveryHomeDiagnosticsEnabled = platformEnv.isNative;

const homeDiagnostics = () => defaultLogger.discovery.homeDiagnostics;

let lastDiagnosticsId = 0;

export function useDiscoveryHomeDiagnosticsId() {
  const [id] = useState(() => {
    lastDiagnosticsId += 1;
    return lastDiagnosticsId;
  });
  return id;
}

export function useDiagnosticsLifecycleLog(
  id: number,
  log: (params: {
    id: number;
    event: IDiscoveryHomeDiagLifecycleEvent;
  }) => void,
) {
  const logRef = useRef(log);
  logRef.current = log;
  useEffect(() => {
    if (!isDiscoveryHomeDiagnosticsEnabled) {
      return;
    }
    logRef.current({ id, event: 'mount' });
    return () => {
      logRef.current({ id, event: 'unmount' });
    };
  }, [id]);
}

// Logs the committed snapshot whenever its content changes.
export function useDiagnosticsLogOnChange<T>(
  snapshot: T,
  log: (value: T) => void,
) {
  const serialized = isDiscoveryHomeDiagnosticsEnabled
    ? JSON.stringify(snapshot)
    : '';
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const logRef = useRef(log);
  logRef.current = log;
  const lastLoggedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      !isDiscoveryHomeDiagnosticsEnabled ||
      lastLoggedRef.current === serialized
    ) {
      return;
    }
    lastLoggedRef.current = serialized;
    logRef.current(snapshotRef.current);
  }, [serialized]);
}

export function useDiagnosticsLayoutLogger(id: number, target: string) {
  const lastLayoutRef = useRef('');
  return useCallback(
    (event: LayoutChangeEvent) => {
      if (!isDiscoveryHomeDiagnosticsEnabled) {
        return;
      }
      const { x, y, width, height } = event.nativeEvent.layout;
      const layout = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      };
      const key = `${layout.x},${layout.y},${layout.width},${layout.height}`;
      if (lastLayoutRef.current === key) {
        return;
      }
      lastLayoutRef.current = key;
      homeDiagnostics().layout({ id, target, ...layout });
    },
    [id, target],
  );
}

export function useDiscoveryTabFocusLog(
  id: number,
  source: 'browser' | 'dashboard',
) {
  const lastFocusRef = useRef('');
  useListenTabFocusState(
    ETabRoutes.Discovery,
    (isFocus, isHideByModal, currentTab) => {
      if (!isDiscoveryHomeDiagnosticsEnabled) {
        return;
      }
      const key = `${String(isFocus)}|${String(isHideByModal)}|${String(
        currentTab,
      )}`;
      if (lastFocusRef.current === key) {
        return;
      }
      lastFocusRef.current = key;
      homeDiagnostics().tabFocus({
        id,
        source,
        isFocus,
        isHideByModal,
        currentTab,
      });
    },
  );
}

export function useAppStateLog(id: number) {
  useEffect(() => {
    if (!isDiscoveryHomeDiagnosticsEnabled) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      homeDiagnostics().appState({ id, state });
    });
    return () => subscription.remove();
  }, [id]);
}

// Mirrors every input of useRouteIsFocused so a closed gate can be traced to
// navigation focus, the app lock, or the root route count it snapshots on
// mount.
export function useDashboardFocusGateLog(
  params: Pick<
    IDiscoveryHomeDiagFocusGate,
    'id' | 'routeFocused' | 'isActive' | 'contentActive' | 'displayHomePage'
  >,
) {
  const navFocused = useIsFocused();
  const [isLocked] = useAppIsLockedAtom();
  const [rootRoutesAtMount] = useState(getRootRoutersLength);
  const rootRouteNames = isDiscoveryHomeDiagnosticsEnabled
    ? (rootNavigationRef.current
        ?.getRootState()
        ?.routes?.map((route) => route.name) ?? [])
    : [];
  useDiagnosticsLogOnChange<IDiscoveryHomeDiagFocusGate>(
    {
      ...params,
      navFocused,
      isLocked,
      rootRoutesAtMount,
      rootRoutesNow: getRootRoutersLength(),
      rootRouteNames,
    },
    (value) => homeDiagnostics().dashboardFocusGate(value),
  );
}

// Rendered inside the dashboard's DelayedFreeze. Layout effects are torn down
// while Suspense hides the frozen content and re-run when it is revealed.
export function DashboardVisibilityProbe({ id }: { id: number }) {
  useLayoutEffect(() => {
    if (!isDiscoveryHomeDiagnosticsEnabled) {
      return;
    }
    homeDiagnostics().dashboardVisibility({ id, state: 'revealed' });
    return () => {
      homeDiagnostics().dashboardVisibility({ id, state: 'hidden' });
    };
  }, [id]);
  return null;
}

let lastRequestSeq = 0;

export function nextDiscoveryHomeRequestSeq() {
  lastRequestSeq += 1;
  return lastRequestSeq;
}

export function getDiagnosticsErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 200);
  }
  return String(error).slice(0, 200);
}

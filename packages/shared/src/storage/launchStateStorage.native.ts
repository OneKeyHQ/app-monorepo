import {
  getInstallationTimeAsync,
  getLastUpdateTimeAsync,
} from 'expo-application';
import { createMMKV } from 'react-native-mmkv';

import platformEnv from '../platformEnv';

import { classifyNativeAppInstallation } from './launchStateNativeInstallClassifier';
import { createAppLaunchStateStorage } from './launchStateStorage.shared';

import type { IAppInstallationReconcileResult } from './launchStateStorage.shared';

const launchStateMMKV = createMMKV({
  id: 'onekey-app-launch-state',
});

export const appLaunchStateStorage = createAppLaunchStateStorage({
  getItem: (key) => launchStateMMKV.getString(key),
  setItem: (key, value) => launchStateMMKV.set(key, value),
});

export async function reconcileAppInstallation(): Promise<IAppInstallationReconcileResult> {
  const current = appLaunchStateStorage.read();
  if (!platformEnv.isNativeAndroid) {
    return {
      classification: current ? 'existingState' : 'unknown',
    } satisfies IAppInstallationReconcileResult;
  }

  let installationTime: number | undefined;
  try {
    installationTime = (await getInstallationTimeAsync()).getTime();
    if (current) {
      if (
        current.installationTime !== undefined &&
        current.installationTime !== installationTime
      ) {
        appLaunchStateStorage.markFreshInstallationPending(installationTime);
        return {
          classification: 'freshInstall',
          installationTime,
        } satisfies IAppInstallationReconcileResult;
      }
      if (current.installationTime === undefined) {
        appLaunchStateStorage.setInstallationTime(installationTime);
      }
      return {
        classification: 'existingState',
        installationTime,
      } satisfies IAppInstallationReconcileResult;
    }

    let lastUpdateTime: number | undefined;
    try {
      lastUpdateTime = (await getLastUpdateTimeAsync()).getTime();
    } catch {
      // Ambiguous installs fall through to Home and post-paint validation.
    }
    const classification = classifyNativeAppInstallation({
      installationTime,
      ...(lastUpdateTime !== undefined ? { lastUpdateTime } : undefined),
      platform: 'android',
    });
    if (classification === 'freshInstall') {
      return {
        classification,
        installationTime,
      } satisfies IAppInstallationReconcileResult;
    }
  } catch {
    // LaunchState remains authoritative when the platform API is unavailable.
  }
  return {
    classification: 'unknown',
    ...(installationTime !== undefined ? { installationTime } : undefined),
  } satisfies IAppInstallationReconcileResult;
}

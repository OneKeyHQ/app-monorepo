import { useEffect, useReducer, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppRestartMode,
  appRestart,
} from '@onekeyhq/shared/src/modules3rdParty/appRestart';
import { callNativeStorage } from '@onekeyhq/shared/src/storage/nativeStorageBridge';
import { getNativeStorageMigrationRecoveryTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import type { INativeStorageMigrationRecoveryTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { bootstrapNativeStorage } from './bootstrapNativeStorage';
import { runJotaiMainHydration } from './jotaiMainHydrationGate';
import { hideNativeStorageBootstrapSplash } from './nativeStorageBootstrapSplash';

let AppComponent: ComponentType | undefined;
let bootstrapError: Error | undefined;
let bootstrapErrorTitle = 'Storage initialization failed';
let bootstrapRecoveryTarget: INativeStorageMigrationRecoveryTarget | undefined;
let bootstrapPromise: Promise<void> | undefined;
let storageRepairPromise: Promise<void> | undefined;
let recoveryRestartPromise: Promise<void> | undefined;
let bootstrapGeneration = 0;
type IBootstrapFailureStage = 'app' | 'jotai' | 'runtime-launch' | 'storage';
let bootstrapFailureStage: IBootstrapFailureStage | undefined;
const subscribers = new Set<() => void>();
const NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MS = 65_000;
const NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MESSAGE =
  'Native storage bootstrap timed out after 65 seconds';

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function initializeJotaiFromBackground() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: backgroundApiProxy } =
    require('@onekeyhq/kit/src/background/instance/backgroundApiProxy') as typeof import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
  return runJotaiMainHydration(() =>
    backgroundApiProxy.initializeJotaiFromBackground(),
  );
}

function withNativeBootstrapTimeout(promise: Promise<boolean>) {
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MESSAGE));
    }, NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MS);

    void promise.then(
      (shouldMountApp) => {
        clearTimeout(timer);
        resolve(shouldMountApp);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Intentional native cold-start correctness gate.
 *
 * Native main and bg are isolated JS runtimes that still start concurrently,
 * but the business App must not be imported or mounted until bg has migrated
 * both legacy storage namespaces and returned the snapshot used to prime
 * main's synchronous in-memory storage mirrors. Without this gate, business
 * code could observe an unprimed mirror or race legacy-data migration.
 *
 * This intentionally puts the remaining bg-ready and snapshot latency on the
 * cold-start critical path, plus one-time migration latency after upgrading.
 * When investigating startup regressions, measure bg readiness, migration,
 * and snapshot transfer separately. Do not move the App require above this
 * bootstrap or make it fire-and-forget without an equivalent readiness gate.
 */
function startBootstrap(force = false) {
  if (!force && bootstrapPromise) {
    return bootstrapPromise;
  }
  const generation = (bootstrapGeneration += 1);
  bootstrapError = undefined;
  bootstrapFailureStage = undefined;
  bootstrapRecoveryTarget = undefined;
  notifySubscribers();
  let stage: IBootstrapFailureStage = 'storage';
  const bootstrapWork = (async () => {
    await bootstrapNativeStorage({ force });
    if (generation !== bootstrapGeneration) {
      return false;
    }
    const { travelModeManager } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/travelMode') as typeof import('@onekeyhq/shared/src/travelMode');
    const { completeTravelModeRuntimeLaunchAcknowledgement } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement') as typeof import('@onekeyhq/shared/src/travelMode/runtimeLaunchAcknowledgement');
    stage = 'runtime-launch';
    const runtimeLaunchAcknowledged =
      await completeTravelModeRuntimeLaunchAcknowledgement(travelModeManager);
    if (!runtimeLaunchAcknowledged) {
      throw new OneKeyLocalError('Unknown error');
    }
    if (generation !== bootstrapGeneration) {
      return false;
    }
    stage = 'jotai';
    await initializeJotaiFromBackground();
    return generation === bootstrapGeneration;
  })();
  const nextPromise = withNativeBootstrapTimeout(bootstrapWork)
    .then((shouldMountApp) => {
      if (!shouldMountApp || generation !== bootstrapGeneration) return;
      stage = 'app';
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AppComponent = (require('../../App') as typeof import('../../App'))
        .default;
      if (typeof globalThis.nativePerformanceNow === 'function') {
        globalThis.$$onekeyAppWillMountFromPerformanceNow =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          globalThis.nativePerformanceNow();
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(
            'onekeyAppWillMountFromPerformanceNow',
            (globalThis.$$onekeyAppWillMountFromPerformanceNow || 0) -
              (globalThis.$$onekeyJsReadyFromPerformanceNow || 0),
          );
        }
      }
    })
    .catch((error: unknown) => {
      if (generation !== bootstrapGeneration) {
        return;
      }
      bootstrapError =
        error instanceof Error ? error : new Error(String(error));
      bootstrapFailureStage = stage;
      bootstrapRecoveryTarget = getNativeStorageMigrationRecoveryTarget(error);
      if (stage === 'storage') {
        bootstrapErrorTitle = 'Storage initialization failed';
      } else if (stage === 'runtime-launch') {
        bootstrapErrorTitle = 'Runtime launch verification failed';
      } else if (stage === 'jotai') {
        bootstrapErrorTitle = 'State initialization failed';
      } else {
        bootstrapErrorTitle = 'App startup failed';
      }
      bootstrapPromise = undefined;
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (generation === bootstrapGeneration) {
        notifySubscribers();
      }
    });
  bootstrapPromise = nextPromise;
  return bootstrapPromise;
}

async function forceDisableTravelModeForRecoveryBestEffort() {
  try {
    const { forceDisableTravelModeForRecovery } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@onekeyhq/shared/src/travelMode/nativeLaunchEpoch') as typeof import('@onekeyhq/shared/src/travelMode/nativeLaunchEpoch');
    await forceDisableTravelModeForRecovery();
  } catch {
    // A storage recovery action must continue even if this safeguard fails.
  }
}

async function retryBootstrapAfterFailure() {
  await forceDisableTravelModeForRecoveryBestEffort();
  return startBootstrap(true);
}

function restartAfterBootstrapFailure({
  failureStage,
  reason,
}: {
  failureStage: IBootstrapFailureStage;
  reason: string;
}) {
  if (recoveryRestartPromise) {
    return recoveryRestartPromise;
  }
  const nextPromise = (async () => {
    await forceDisableTravelModeForRecoveryBestEffort();
    await appRestart({
      mode: EAppRestartMode.All,
      reason,
    });
  })()
    .catch((error: unknown) => {
      bootstrapError =
        error instanceof Error ? error : new Error(String(error));
      bootstrapErrorTitle =
        failureStage === 'runtime-launch'
          ? 'Runtime restart failed'
          : 'App restart recovery failed';
      bootstrapFailureStage = failureStage;
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (recoveryRestartPromise === nextPromise) {
        recoveryRestartPromise = undefined;
      }
      notifySubscribers();
    });
  recoveryRestartPromise = nextPromise;
  return recoveryRestartPromise;
}

function startStorageRepair(target: INativeStorageMigrationRecoveryTarget) {
  if (storageRepairPromise) {
    return storageRepairPromise;
  }
  bootstrapError = undefined;
  bootstrapRecoveryTarget = undefined;
  notifySubscribers();
  const nextPromise = callNativeStorage<void>({
    scope: 'recovery',
    operation: 'resetMigrationTarget',
    target,
  })
    .then(() => startBootstrap(true))
    .catch((error: unknown) => {
      bootstrapError =
        error instanceof Error ? error : new Error(String(error));
      bootstrapErrorTitle = 'Storage repair failed';
      bootstrapRecoveryTarget = getNativeStorageMigrationRecoveryTarget(error);
      hideNativeStorageBootstrapSplash();
    })
    .finally(() => {
      if (storageRepairPromise === nextPromise) {
        storageRepairPromise = undefined;
      }
      notifySubscribers();
    });
  storageRepairPromise = nextPromise;
  return storageRepairPromise;
}

void startBootstrap();

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: '#000',
    padding: 24,
  },
  waitingDark: { backgroundColor: '#000' },
  waitingLight: { backgroundColor: '#fff' },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  message: { color: '#aaa', marginTop: 12, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#000', fontWeight: '600' },
  restartButton: {
    borderColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  restartText: { color: '#fff', fontWeight: '600' },
});

export function NativeStorageBootstrapRoot() {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const [repairConfirmationTarget, setRepairConfirmationTarget] = useState<
    INativeStorageMigrationRecoveryTarget | undefined
  >();
  const isDarkMode = useColorScheme() === 'dark';
  useEffect(() => {
    subscribers.add(rerender);
    return () => {
      subscribers.delete(rerender);
    };
  }, []);

  if (AppComponent) {
    const App = AppComponent;
    return <App />;
  }
  if (bootstrapError) {
    const recoveryTarget = bootstrapRecoveryTarget;
    const isConfirmingRepair = repairConfirmationTarget === recoveryTarget;
    let recoveryAction: ReactNode;
    if (!recoveryTarget && bootstrapFailureStage === 'runtime-launch') {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void restartAfterBootstrapFailure({
              failureStage: 'runtime-launch',
              reason: 'travel-mode.runtime-launch.restart',
            })
          }
          style={styles.retryButton}
          testID="travel-mode-runtime-launch-retry"
        >
          <Text style={styles.retryText}>Retry and restart</Text>
        </Pressable>
      );
    } else if (!recoveryTarget) {
      recoveryAction = (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => void retryBootstrapAfterFailure()}
            style={styles.retryButton}
            testID="native-storage-migration-retry"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void restartAfterBootstrapFailure({
                failureStage: bootstrapFailureStage ?? 'storage',
                reason: 'storage.bootstrap.restart',
              })
            }
            style={styles.restartButton}
            testID="native-storage-bootstrap-restart-app"
          >
            <Text style={styles.restartText}>Restart App</Text>
          </Pressable>
        </>
      );
    } else if (isConfirmingRepair) {
      recoveryAction = (
        <>
          <Text style={styles.message}>
            This removes the affected local state and its stale AsyncStorage
            copy. Continue?
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setRepairConfirmationTarget(undefined);
              void startStorageRepair(recoveryTarget);
            }}
            style={styles.retryButton}
            testID="native-storage-migration-repair-confirm"
          >
            <Text style={styles.retryText}>Confirm reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRepairConfirmationTarget(undefined)}
            style={styles.retryButton}
            testID="native-storage-migration-repair-cancel"
          >
            <Text style={styles.retryText}>Cancel</Text>
          </Pressable>
        </>
      );
    } else {
      recoveryAction = (
        <Pressable
          accessibilityRole="button"
          onPress={() => setRepairConfirmationTarget(recoveryTarget)}
          style={styles.retryButton}
          testID="native-storage-migration-repair"
        >
          <Text style={styles.retryText}>Reset local storage</Text>
        </Pressable>
      );
    }
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.title}>
          {recoveryTarget ? 'Local storage needs repair' : bootstrapErrorTitle}
        </Text>
        <Text style={styles.message}>
          {recoveryTarget
            ? 'The migrated local storage is incomplete and cannot be used safely.'
            : bootstrapError.message}
        </Text>
        {recoveryAction}
      </View>
    );
  }
  return (
    <View
      style={[
        styles.container,
        isDarkMode ? styles.waitingDark : styles.waitingLight,
      ]}
      testID="native-storage-bootstrap-waiting"
    >
      <ActivityIndicator
        color={isDarkMode ? '#fff' : '#000'}
        testID="native-storage-bootstrap-spinner"
      />
    </View>
  );
}

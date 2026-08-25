import { useEffect, useReducer } from 'react';
import type { ComponentType } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { bootstrapNativeStorage } from './bootstrapNativeStorage';
import { hideNativeStorageBootstrapSplash } from './nativeStorageBootstrapSplash';

let AppComponent: ComponentType | undefined;
let bootstrapError: Error | undefined;
let bootstrapErrorTitle = 'Storage initialization failed';
let bootstrapPromise: Promise<void> | undefined;
let bootstrapGeneration = 0;
const subscribers = new Set<() => void>();
const NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MS = 65_000;
const NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MESSAGE =
  'Native storage bootstrap timed out after 65 seconds';

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function bootstrapNativeStorageWithTimeout(force: boolean) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MESSAGE));
    }, NATIVE_STORAGE_BOOTSTRAP_TIMEOUT_MS);

    void bootstrapNativeStorage({ force }).then(
      () => {
        clearTimeout(timer);
        resolve();
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
  notifySubscribers();
  let stage: 'app' | 'storage' = 'storage';
  const nextPromise = bootstrapNativeStorageWithTimeout(force)
    .then(() => {
      if (generation !== bootstrapGeneration) {
        return;
      }
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
      bootstrapErrorTitle =
        stage === 'storage'
          ? 'Storage initialization failed'
          : 'App startup failed';
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
});

export function NativeStorageBootstrapRoot() {
  const [, rerender] = useReducer((value: number) => value + 1, 0);
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
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.title}>{bootstrapErrorTitle}</Text>
        <Text style={styles.message}>{bootstrapError.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void startBootstrap(true)}
          style={styles.retryButton}
          testID="native-storage-migration-retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
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

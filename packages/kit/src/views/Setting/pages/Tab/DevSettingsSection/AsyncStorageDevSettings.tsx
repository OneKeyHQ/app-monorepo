import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  Input,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

const DEBUG_KEY = '$$test_async_storage_size_key';

// Must match ServiceDevSetting.ASYNC_STORAGE_TEST_KEY_PREFIX so the bg-side
// dev methods accept these keys.
const CONCURRENT_TEST_KEY_PREFIX = '$$test_async_storage_concurrent/';
const CONCURRENT_TEST_ROUNDS = 25;

// runId namespaces every key so two overlapping runs (e.g. the dialog closed
// mid-run then reopened as a fresh component instance) operate on disjoint
// keyspaces and can never delete or read back each other's data.
function buildMainKey(runId: string, round: number) {
  return `${CONCURRENT_TEST_KEY_PREFIX}${runId}/main/${round}`;
}

function buildBgKey(runId: string, round: number) {
  return `${CONCURRENT_TEST_KEY_PREFIX}${runId}/bg/${round}`;
}

// Value encodes its own key + origin so a stale-manifest clobber (dropped key)
// shows up as a missing/`null` read, and a wrong write shows up as a mismatch.
function buildExpectedValue(key: string, origin: 'main' | 'bg') {
  return `${origin}:${key}`;
}

function SaveDataButton({
  onSaveData,
}: {
  onSaveData: (size: number) => Promise<void>;
}) {
  const [size, setSize] = useState<string | undefined>(undefined);
  return (
    <YStack padding={12}>
      <Input
        placeholder="Enter size in MB"
        onChangeText={(text) => {
          setSize(text);
        }}
        value={size?.toString()}
        keyboardType="decimal-pad"
      />
      <Button
        onPress={async () => {
          if (size) {
            await onSaveData(parseFloat(size ?? '0'));
          }
        }}
      >
        Save data
      </Button>
    </YStack>
  );
}

export function AsyncStorageDevSettings() {
  const saveData = useCallback(async (size: number) => {
    const oldData = (await appStorage.getItem(DEBUG_KEY)) || '';
    const newData = oldData + 'a'.repeat(size * 1024 * 1024);
    await appStorage.setItem(DEBUG_KEY, newData);
    Toast.success({
      title: 'Save data success',
    });
  }, []);

  const [isRunningConcurrent, setIsRunningConcurrent] = useState(false);
  const [concurrentResult, setConcurrentResult] = useState<string | undefined>(
    undefined,
  );
  // Tracks whether this component instance is still mounted, so a run that
  // outlives its dialog does not push results/toasts onto (or resurrect) a
  // torn-down instance.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Concurrently drive main-origin writes (forwarded to bg on iOS dual-runtime)
  // and bg-origin writes (executed bg-local) against the shared AsyncStorage,
  // then read back from BOTH runtimes to prove no key was dropped by a stale
  // main-runtime manifest overwriting bg-written keys (or vice versa).
  const runConcurrentWriteTest = useCallback(async () => {
    setIsRunningConcurrent(true);
    setConcurrentResult(undefined);

    // Unique per-run namespace (plain app code, so Date.now/Math.random are
    // fine) so concurrent/overlapping runs never share keys.
    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const forwardingActive = Boolean(
      platformEnv.isNativeIOS &&
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread,
    );
    const mainKeys = Array.from({ length: CONCURRENT_TEST_ROUNDS }, (_, i) =>
      buildMainKey(runId, i),
    );
    const bgKeys = Array.from({ length: CONCURRENT_TEST_ROUNDS }, (_, i) =>
      buildBgKey(runId, i),
    );
    const allKeys = [...mainKeys, ...bgKeys];

    try {
      // 1. Clean slate via the bg-direct remove, not appStorage.multiRemove.
      //    Teardown must not depend on the forwarder path being healthy (that
      //    is the very thing under test); routing setup/cleanup straight to the
      //    single-writer bg runtime authoritatively clears both main-forwarded
      //    and bg-origin keys from the shared native store.
      await backgroundApiProxy.serviceDevSetting.demoAsyncStorageBgMultiRemove(
        allKeys,
      );

      // 2. Interleave main-origin and bg-origin writes concurrently so a
      //    stale-manifest clobber would drop the other runtime's keys.
      const writeTasks: Promise<unknown>[] = [];
      for (let round = 0; round < CONCURRENT_TEST_ROUNDS; round += 1) {
        const mainKey = buildMainKey(runId, round);
        const bgKey = buildBgKey(runId, round);
        // main-origin: on iOS dual-runtime this setItem is forwarded to bg.
        writeTasks.push(
          appStorage.setItem(mainKey, buildExpectedValue(mainKey, 'main')),
        );
        // bg-origin: executes bg-local inside the background runtime via RPC.
        writeTasks.push(
          backgroundApiProxy.serviceDevSetting.demoAsyncStorageBgMultiSet([
            [bgKey, buildExpectedValue(bgKey, 'bg')],
          ]),
        );
      }
      // Wait for EVERY write to settle before reading/cleanup. Promise.all
      // rejects on the first failure while the other writes — especially the
      // in-flight bg-origin RPCs — keep running, and one could land AFTER the
      // finally-block multiRemove, leaving dirty test keys and making the next
      // run start unclean. allSettled drains the whole write path first.
      const writeResults = await Promise.allSettled(writeTasks);
      const writeFailures = writeResults.filter(
        (r) => r.status === 'rejected',
      ).length;

      // 3a. Verify from the main runtime (main read refreshes its manifest).
      const mainReadPairs = await appStorage.multiGet(allKeys);
      const mainReadMap = new Map<string, string | null>(
        mainReadPairs.map(
          ([key, value]) => [key, value ?? null] as [string, string | null],
        ),
      );
      // 3b. Cross-verify from the bg runtime.
      const bgReadPairs =
        await backgroundApiProxy.serviceDevSetting.demoAsyncStorageBgMultiGet(
          allKeys,
        );
      const bgReadMap = new Map<string, string | null>(
        bgReadPairs.map(
          ([key, value]) => [key, value ?? null] as [string, string | null],
        ),
      );

      // 4. Tally missing (dropped/clobbered) and mismatched keys, requiring
      //    both runtimes to observe the same committed value.
      const missing: string[] = [];
      let mismatch = 0;
      for (const key of allKeys) {
        const origin: 'main' | 'bg' = mainKeys.includes(key) ? 'main' : 'bg';
        const expected = buildExpectedValue(key, origin);
        const mainValue = mainReadMap.get(key) ?? null;
        const bgValue = bgReadMap.get(key) ?? null;
        if (mainValue === null || bgValue === null) {
          missing.push(key);
        } else if (mainValue !== expected || bgValue !== expected) {
          mismatch += 1;
        }
      }

      const total = allKeys.length;
      const intact = total - missing.length - mismatch;
      const forwardingNote = forwardingActive
        ? 'dual-runtime forwarding ON'
        : 'forwarding OFF (single-runtime/non-iOS — trivial pass)';

      const passed =
        missing.length === 0 && mismatch === 0 && writeFailures === 0;
      const sample = missing.slice(0, 5).join(', ');
      const message = passed
        ? `PASS ${intact}/${total} (main ${CONCURRENT_TEST_ROUNDS} + bg ${CONCURRENT_TEST_ROUNDS}) · ${forwardingNote}`
        : `FAIL intact ${intact}/${total} · missing ${missing.length} · mismatch ${mismatch} · writeFail ${writeFailures}${
            sample ? ` · e.g. ${sample}` : ''
          } · ${forwardingNote}`;
      // Ignore the outcome if this instance was unmounted mid-run: a stale run
      // must not surface UI for (or over) a newer instance.
      if (isMountedRef.current) {
        setConcurrentResult(message);
        if (passed) {
          Toast.success({ title: 'Concurrent write test PASS', message });
        } else {
          Toast.error({ title: 'Concurrent write test FAIL', message });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isMountedRef.current) {
        setConcurrentResult(`ERROR: ${message}`);
        Toast.error({ title: 'Concurrent write test error', message });
      }
    } finally {
      // Best-effort cleanup so repeated runs start clean. Use the bg-direct
      // remove (same reason as the clean-slate above): teardown must converge
      // on the single-writer bg runtime rather than the under-test main path.
      try {
        await backgroundApiProxy.serviceDevSetting.demoAsyncStorageBgMultiRemove(
          allKeys,
        );
      } catch {
        // ignore cleanup failure
      }
      if (isMountedRef.current) {
        setIsRunningConcurrent(false);
      }
    }
  }, []);

  return (
    <YStack gap={4}>
      <SizableText size="$bodySmMedium">
        main + bg concurrent write (manifest clobber check)
      </SizableText>
      <Button loading={isRunningConcurrent} onPress={runConcurrentWriteTest}>
        Concurrent main+bg write test
      </Button>
      {concurrentResult ? (
        <SizableText size="$bodySm">{concurrentResult}</SizableText>
      ) : null}

      <Button
        onPress={async () => {
          await appStorage.removeItem(DEBUG_KEY);
          Toast.success({
            title: 'Clear data success',
          });
        }}
      >
        Clear data
      </Button>

      <Button
        onPress={async () => {
          try {
            const data = await appStorage.getItem(DEBUG_KEY);
            const sizeInMB = data
              ? (data.length / (1024 * 1024.0)).toFixed(2)
              : 0;
            Toast.success({
              title: 'Saved data size',
              message: `size: ${sizeInMB} MB`,
            });
          } catch (e: any) {
            const { message } = e;
            Toast.error({
              title: 'Read data size failed',
              message,
            });
          }
        }}
      >
        Read data size
      </Button>

      <SaveDataButton onSaveData={saveData} />

      <Button
        onPress={async () => {
          await saveData(1);
        }}
      >
        Save 1M Data
      </Button>

      <Button
        onPress={async () => {
          await saveData(10);
        }}
      >
        Save 10M Data
      </Button>
    </YStack>
  );
}

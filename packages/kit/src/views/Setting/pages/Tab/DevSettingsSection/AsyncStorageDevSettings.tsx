import { useCallback, useState } from 'react';

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

function buildMainKey(round: number) {
  return `${CONCURRENT_TEST_KEY_PREFIX}main/${round}`;
}

function buildBgKey(round: number) {
  return `${CONCURRENT_TEST_KEY_PREFIX}bg/${round}`;
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

  // Concurrently drive main-origin writes (forwarded to bg on iOS dual-runtime)
  // and bg-origin writes (executed bg-local) against the shared AsyncStorage,
  // then read back from BOTH runtimes to prove no key was dropped by a stale
  // main-runtime manifest overwriting bg-written keys (or vice versa).
  const runConcurrentWriteTest = useCallback(async () => {
    setIsRunningConcurrent(true);
    setConcurrentResult(undefined);

    const forwardingActive = Boolean(
      platformEnv.isNativeIOS &&
      platformEnv.isNativeMainThread &&
      platformEnv.enableNativeBackgroundThread,
    );
    const mainKeys = Array.from({ length: CONCURRENT_TEST_ROUNDS }, (_, i) =>
      buildMainKey(i),
    );
    const bgKeys = Array.from({ length: CONCURRENT_TEST_ROUNDS }, (_, i) =>
      buildBgKey(i),
    );
    const allKeys = [...mainKeys, ...bgKeys];

    try {
      // 1. Clean slate (main path forwards to bg on iOS).
      await appStorage.multiRemove(allKeys);

      // 2. Interleave main-origin and bg-origin writes concurrently so a
      //    stale-manifest clobber would drop the other runtime's keys.
      const writeTasks: Promise<unknown>[] = [];
      for (let round = 0; round < CONCURRENT_TEST_ROUNDS; round += 1) {
        const mainKey = buildMainKey(round);
        const bgKey = buildBgKey(round);
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
      await Promise.all(writeTasks);

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

      if (missing.length === 0 && mismatch === 0) {
        const message = `PASS ${intact}/${total} (main ${CONCURRENT_TEST_ROUNDS} + bg ${CONCURRENT_TEST_ROUNDS}) · ${forwardingNote}`;
        setConcurrentResult(message);
        Toast.success({ title: 'Concurrent write test PASS', message });
      } else {
        const sample = missing.slice(0, 5).join(', ');
        const message = `FAIL intact ${intact}/${total} · missing ${missing.length} · mismatch ${mismatch}${
          sample ? ` · e.g. ${sample}` : ''
        } · ${forwardingNote}`;
        setConcurrentResult(message);
        Toast.error({ title: 'Concurrent write test FAIL', message });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setConcurrentResult(`ERROR: ${message}`);
      Toast.error({ title: 'Concurrent write test error', message });
    } finally {
      // Best-effort cleanup so repeated runs start clean.
      try {
        await appStorage.multiRemove(allKeys);
      } catch {
        // ignore cleanup failure
      }
      setIsRunningConcurrent(false);
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

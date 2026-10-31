import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Button,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppRestartMode,
  appRestart,
} from '@onekeyhq/shared/src/modules3rdParty/appRestart';
import {
  type INativeStorageRecoveryTestRequest,
  type INativeStorageRecoveryTestScenario,
  type INativeStorageRecoveryTestSnapshot,
  NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS,
} from '@onekeyhq/shared/src/storage/nativeStorageRecoveryTestTypes';

const SCENARIOS: Record<
  INativeStorageRecoveryTestScenario,
  { title: string; description: string }
> = {
  success: {
    title: 'Missing marker: all recoverable',
    description:
      'Keep one current value and recover two legacy values. Expected: 3 success, 0 failed; automatic completion.',
  },
  partialFailure: {
    title: 'One legacy key fails',
    description:
      'The middle key fails; the later key must still recover. Expected: 2 success, 1 failed; force confirmation.',
  },
  allFailed: {
    title: 'All legacy keys fail',
    description:
      'Expected: 0 success, 3 failed. Force completion enables an empty MMKV for new writes.',
  },
  incompleteScan: {
    title: 'Legacy enumeration fails',
    description:
      'Expected: 1 known success and an incomplete scan. Force confirmation is still required.',
  },
  syncFailure: {
    title: 'Final sync fails',
    description:
      'Copy succeeds, finalization fails. Clear the simulated fault in the repair screen, then retry.',
  },
  expiredAttempt: {
    title: 'Prepared result expires',
    description:
      'The storage owner drops the prepared attempt once. Finalization fails; retry prepares a fresh result.',
  },
};

export function NativeStorageRecoveryTestPanel() {
  const [snapshot, setSnapshot] =
    useState<INativeStorageRecoveryTestSnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const run = useCallback(
    async (request: INativeStorageRecoveryTestRequest) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(undefined);
      try {
        const result =
          await backgroundApiProxy.serviceDevSetting.nativeStorageRecoveryTest(
            request,
          );
        if (mounted.current) setSnapshot(result.snapshot);
        if (request.action === 'reproduce') {
          await appRestart({
            mode: EAppRestartMode.All,
            reason: 'storage.migration.test.reproduce',
          });
        }
      } catch (e) {
        let message =
          e instanceof Error ? e.message : 'Storage test request failed';
        if (request.action === 'reproduce') {
          message =
            'The test could not restart. Retry, or close and reopen the app if the fault was created.';
        }
        if (mounted.current) setError(message);
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    void run({ action: 'inspect' });
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return (
    <ScrollView maxHeight={560} testID="native-storage-recovery-test-panel">
      <YStack gap="$3" py="$2">
        <SizableText size="$bodyMd">
          Uses isolated MMKV and three synthetic legacy keys. Wallet storage is
          not part of these scenarios. Repair keeps the synthetic legacy copy
          until you explicitly reset test data.
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Choose a scenario to create a fault and restart the app. After
          unlocking on Home, use the storage error Toast to open repair. After
          repair and restart, Home verifies the recovered data and new writes.
          Reopen this panel to inspect the result. These are injected faults,
          not physical disk corruption.
        </SizableText>
        {NATIVE_STORAGE_RECOVERY_TEST_SCENARIOS.map((scenario) => (
          <YStack key={scenario} gap="$1">
            <Button
              disabled={busy}
              testID={`storage-recovery-scenario-${scenario}`}
              onPress={() => run({ action: 'reproduce', scenario })}
            >
              {SCENARIOS[scenario].title}
            </Button>
            <SizableText size="$bodySm" color="$textSubdued">
              {SCENARIOS[scenario].description}
            </SizableText>
          </YStack>
        ))}
        {snapshot?.sessionId ? (
          <YStack gap="$2">
            <SizableText size="$bodyMdMedium">
              Scenario: {snapshot.scenario}
            </SizableText>
            <SizableText size="$bodySm" testID="storage-recovery-test-marker">
              New test data persisted: {String(snapshot.newDataPersisted)}.
              Completion marker:{' '}
              {snapshot.markerComplete ? 'complete' : 'missing'}; legacy
              retained: {String(snapshot.legacyRetained)}; fault active:{' '}
              {String(snapshot.faultActive)}
            </SizableText>
            <SizableText
              size="$bodySm"
              testID="storage-recovery-test-home-result"
            >
              Home restart verification:{' '}
              {snapshot.homeReadPassed ? 'PASS' : 'not completed'}. Home fault
              active: {String(Boolean(snapshot.homeFlowActive))}.
            </SizableText>
            <Button
              disabled={busy}
              testID="storage-recovery-test-read"
              onPress={() =>
                run({ action: 'read', sessionId: snapshot.sessionId ?? '' })
              }
            >
              Read test key
            </Button>
            <Button
              disabled={busy}
              testID="storage-recovery-test-verify"
              onPress={() =>
                run({ action: 'verify', sessionId: snapshot.sessionId ?? '' })
              }
            >
              Verify copied keys, legacy and new writes
            </Button>
            {snapshot.summary ? (
              <SizableText size="$bodySm">
                Successful: {snapshot.summary.successfulCount}. Failed:{' '}
                {snapshot.summary.failedCount}. Scan complete:{' '}
                {String(snapshot.summary.scanComplete)}.
              </SizableText>
            ) : null}
            {snapshot.rows.map((row) => (
              <YStack
                key={row.key}
                gap="$1"
                borderWidth={1}
                borderColor="$borderSubdued"
                p="$2"
                borderRadius="$2"
              >
                <SizableText size="$bodySmMedium">{row.key}</SizableText>
                <SizableText size="$bodySm">
                  Legacy: {row.legacy ?? '(absent)'}
                </SizableText>
                <SizableText size="$bodySm">
                  MMKV: {row.mmkv ?? '(absent)'}
                </SizableText>
              </YStack>
            ))}
            {snapshot.verification ? (
              <SizableText
                testID="storage-recovery-test-verification"
                color={
                  snapshot.verification.passed
                    ? '$textSuccess'
                    : '$textCritical'
                }
                size="$bodySmMedium"
              >
                {snapshot.verification.passed ? 'PASS' : 'FAIL'}: expected
                successful {snapshot.verification.expectedSuccessfulCount};
                unavailable {snapshot.verification.expectedFailedCount};
                successful keys readable{' '}
                {String(snapshot.verification.successfulKeysReadable)}; failed
                keys absent {String(snapshot.verification.failedKeysAbsent)};
                new data read/write/remove{' '}
                {String(snapshot.verification.newDataWritable)}; legacy retained{' '}
                {String(snapshot.legacyRetained)}.
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
        {error ? (
          <SizableText
            testID="storage-recovery-test-error"
            color="$textCritical"
            size="$bodySm"
          >
            {error}
          </SizableText>
        ) : null}
        <XStack gap="$2">
          <Button
            flex={1}
            disabled={busy}
            testID="storage-recovery-test-refresh"
            onPress={() => run({ action: 'inspect' })}
          >
            Refresh
          </Button>
          <Button
            flex={1}
            disabled={busy}
            testID="storage-recovery-test-clear"
            onPress={() => run({ action: 'clear' })}
          >
            Clear test data
          </Button>
        </XStack>
      </YStack>
    </ScrollView>
  );
}

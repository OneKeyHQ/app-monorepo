import { useCallback, useImperativeHandle, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import type {
  INativeAppStorageRepairSummary,
  INativeStorageMigrationRecoveryTarget,
} from '@onekeyhq/shared/src/storage/nativeStorageTypes';

type IBootstrapFailureStage = 'app' | 'jotai' | 'runtime-launch' | 'storage';

export type INativeStorageBootstrapErrorScreenProps = {
  bootstrapErrorMessage?: string;
  bootstrapErrorTitle: string;
  bootstrapFailureStage?: IBootstrapFailureStage;
  recoveryTarget?: INativeStorageMigrationRecoveryTarget;
  testSessionId?: string;
  storageRepairInProgress: boolean;
  storageRepairCompleted: boolean;
  storageEmergencyModeEnabled?: boolean;
  storageRepairCanReset: boolean;
  storageRepairError?: string;
  storageRepairSummary?: INativeAppStorageRepairSummary;
  hasAppComponent: boolean;
  startStorageRepair: (
    target: INativeStorageMigrationRecoveryTarget,
    action?:
      | 'prepare'
      | 'complete'
      | 'reset'
      | 'close'
      | 'restart'
      | 'emergency',
    force?: boolean,
  ) => Promise<void>;
  retryBootstrapAfterFailure: () => Promise<void>;
  restartAfterBootstrapFailure: (options: {
    failureStage: IBootstrapFailureStage;
    reason: string;
  }) => Promise<void>;
  releaseStorageRecoveryTestFault: () => Promise<void>;
  onBack: () => void;
  backRequestRef?: Ref<() => void>;
};

const styles = StyleSheet.create({
  errorContainer: {
    backgroundColor: '#000',
    flex: 1,
  },
  errorContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
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

export function NativeStorageBootstrapErrorScreen({
  bootstrapErrorMessage,
  bootstrapErrorTitle,
  bootstrapFailureStage,
  recoveryTarget,
  testSessionId,
  storageRepairInProgress,
  storageRepairCompleted,
  storageEmergencyModeEnabled,
  storageRepairCanReset,
  storageRepairError,
  storageRepairSummary,
  hasAppComponent,
  startStorageRepair,
  retryBootstrapAfterFailure,
  restartAfterBootstrapFailure,
  releaseStorageRecoveryTestFault,
  onBack,
  backRequestRef,
}: INativeStorageBootstrapErrorScreenProps) {
  const [repairConfirmationTarget, setRepairConfirmationTarget] = useState<
    INativeStorageMigrationRecoveryTarget | undefined
  >();
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const isEmergency =
    recoveryTarget === 'appStorage' && storageEmergencyModeEnabled;
  const isConfirmingRepair =
    Boolean(recoveryTarget) && repairConfirmationTarget === recoveryTarget;
  const isRepairCompleted =
    recoveryTarget === 'appStorage' && storageRepairCompleted;
  const canGoBack = hasAppComponent && !isRepairCompleted && !isEmergency;
  const handleBack = useCallback(() => {
    if (storageRepairInProgress || !canGoBack) return;
    if (confirmEmergency) {
      setConfirmEmergency(false);
    } else if (repairConfirmationTarget) {
      setRepairConfirmationTarget(undefined);
    } else {
      onBack();
    }
  }, [
    canGoBack,
    confirmEmergency,
    onBack,
    repairConfirmationTarget,
    storageRepairInProgress,
  ]);
  // RN Modal routes Android's button and system back gesture here. Full-screen
  // presentation disables iOS swipe dismissal, so it cannot bypass this guard.
  useImperativeHandle(backRequestRef, () => handleBack, [handleBack]);
  let recoveryTitle = bootstrapErrorTitle;
  if (recoveryTarget) {
    recoveryTitle = isRepairCompleted
      ? 'Storage repair complete'
      : 'Local storage needs repair';
  }
  if (isEmergency) recoveryTitle = 'Emergency storage mode enabled';
  let recoveryDescription = bootstrapErrorMessage;
  if (recoveryTarget === 'appStorage') {
    recoveryDescription = isRepairCompleted
      ? 'Repair completed. The original legacy storage has been kept unchanged. Close to restart the app.'
      : 'Repair keeps readable MMKV items and restores missing items from legacy storage, which may be outdated. The original legacy storage will be kept unchanged. Repair finishes automatically when all items succeed.';
  } else if (recoveryTarget === 'jotai') {
    recoveryDescription =
      'Retry loading local preferences. If that fails, you can choose to rebuild the affected preferences. The original legacy storage will be kept unchanged.';
  }
  if (isEmergency)
    recoveryDescription =
      'Current MMKV reads and writes are enabled. Migration is NOT complete and data may be incomplete. Legacy and old transaction evidence are retained. Close to restart the app. Future recovery must explicitly choose the current or legacy snapshot; it must not silently merge old data into new writes.';
  let repairConfirmationMessage =
    'This resets the affected local preferences. The original legacy storage will be kept unchanged. Continue?';
  if (recoveryTarget === 'appStorage') {
    repairConfirmationMessage =
      'Only successfully recovered items will be kept in MMKV. Failed or unscanned items may be unavailable. The original legacy storage will be kept unchanged. Force completion?';
    if (storageRepairSummary?.successfulCount === 0) {
      repairConfirmationMessage =
        'No app-storage records were recovered. Continue with an empty local store? Local address book and history may be unavailable. The original legacy storage will be kept unchanged. Force completion?';
    }
  }
  let recoveryAction: ReactNode;
  if (storageRepairInProgress) {
    recoveryAction = (
      <ActivityIndicator testID="native-storage-repair-progress" />
    );
  } else if (isEmergency) {
    recoveryAction = (
      <Pressable
        accessibilityRole="button"
        onPress={() => void startStorageRepair('appStorage', 'close')}
        style={styles.retryButton}
        testID="native-storage-emergency-close"
      >
        <Text style={styles.retryText}>Use current data (restart)</Text>
      </Pressable>
    );
  } else if (confirmEmergency) {
    recoveryAction = (
      <>
        <Text style={styles.message}>
          Continue with the current real MMKV, even if data is incomplete or
          inconsistent? Legacy is a retained historical snapshot, not
          necessarily the latest data. Existing values and transaction evidence
          will be kept, and migration will NOT be marked complete. New writes
          will change the current snapshot; a future restore of legacy may
          discard those new changes. Storage that cannot persist writes cannot
          be forced to work. Back up your wallets first.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setConfirmEmergency(false);
            void startStorageRepair('appStorage', 'emergency');
          }}
          style={styles.retryButton}
          testID="native-storage-emergency-confirm"
        >
          <Text style={styles.retryText}>Confirm emergency continuation</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmEmergency(false)}
          style={styles.restartButton}
          testID="native-storage-emergency-cancel"
        >
          <Text style={styles.restartText}>Cancel</Text>
        </Pressable>
      </>
    );
  } else if (isRepairCompleted) {
    recoveryAction = (
      <Pressable
        accessibilityRole="button"
        onPress={() => void startStorageRepair(recoveryTarget, 'close')}
        style={styles.retryButton}
        testID="native-storage-repair-close"
      >
        <Text style={styles.retryText}>Close</Text>
      </Pressable>
    );
  } else if (!recoveryTarget && bootstrapFailureStage === 'runtime-launch') {
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
        <Text style={styles.message}>{repairConfirmationMessage}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRepairConfirmationTarget(undefined);
            void startStorageRepair(
              recoveryTarget,
              recoveryTarget === 'appStorage' ? 'complete' : 'reset',
              true,
            );
          }}
          style={styles.retryButton}
          testID="native-storage-migration-repair-confirm"
        >
          <Text style={styles.retryText}>
            {recoveryTarget === 'appStorage'
              ? 'Confirm forced completion'
              : 'Confirm rebuild'}
          </Text>
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
  } else if (recoveryTarget === 'appStorage' && storageRepairSummary) {
    const requiresForce =
      storageRepairSummary.successfulCount === 0 ||
      storageRepairSummary.failedCount > 0 ||
      !storageRepairSummary.scanComplete;
    recoveryAction = (
      <>
        {requiresForce && testSessionId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setRepairConfirmationTarget(recoveryTarget)}
            style={styles.retryButton}
            testID="native-storage-repair-complete"
          >
            <Text style={styles.retryText}>Force completion</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => void startStorageRepair(recoveryTarget)}
          style={styles.restartButton}
          testID="native-storage-repair-retry"
        >
          <Text style={styles.restartText}>Try repair again</Text>
        </Pressable>
      </>
    );
  } else if (storageRepairCanReset) {
    recoveryAction = (
      <Pressable
        accessibilityRole="button"
        onPress={() => setRepairConfirmationTarget(recoveryTarget)}
        style={styles.retryButton}
        testID="native-storage-migration-repair"
      >
        <Text style={styles.retryText}>Rebuild local storage</Text>
      </Pressable>
    );
  } else {
    recoveryAction = (
      <Pressable
        accessibilityRole="button"
        onPress={() => void startStorageRepair(recoveryTarget)}
        style={styles.retryButton}
        testID="native-storage-migration-repair-attempt"
      >
        <Text style={styles.retryText}>Try repair</Text>
      </Pressable>
    );
  }
  return (
    <ScrollView
      style={styles.errorContainer}
      contentContainerStyle={styles.errorContent}
    >
      <Text style={styles.title}>{recoveryTitle}</Text>
      {testSessionId ? (
        <Text
          style={styles.message}
          testID="native-storage-recovery-test-banner"
        >
          Isolated storage recovery test. Wallet storage is not part of this
          scenario. After closing, reopen the developer test panel to verify the
          result.
        </Text>
      ) : null}
      <Text style={styles.message}>{recoveryDescription}</Text>
      {recoveryTarget === 'appStorage' && storageRepairSummary ? (
        <>
          <Text style={styles.message}>
            {`Successful: ${storageRepairSummary.successfulCount}. Failed: ${storageRepairSummary.failedCount}. Kept from MMKV: ${storageRepairSummary.preservedCount}. Restored from legacy storage: ${storageRepairSummary.recoveredCount}.`}
          </Text>
          {!storageRepairSummary.scanComplete ? (
            <Text style={styles.message}>
              Some storage could not be scanned. These counts cover known items
              only; additional items may be missing.
            </Text>
          ) : null}
        </>
      ) : null}
      {storageRepairError ? (
        <Text style={styles.message}>{storageRepairError}</Text>
      ) : null}
      {recoveryAction}
      {recoveryTarget === 'appStorage' &&
      !testSessionId &&
      !storageRepairInProgress &&
      !isRepairCompleted &&
      !isEmergency &&
      !confirmEmergency &&
      (storageRepairSummary || storageRepairError) ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmEmergency(true)}
          style={styles.restartButton}
          testID="native-storage-emergency-open"
        >
          <Text style={styles.restartText}>
            Continue with current data (emergency)
          </Text>
        </Pressable>
      ) : null}
      {recoveryTarget &&
      !testSessionId &&
      !storageRepairInProgress &&
      !isRepairCompleted &&
      !isEmergency &&
      (storageRepairSummary || storageRepairError) ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void startStorageRepair(recoveryTarget, 'restart')}
          style={styles.restartButton}
          testID="native-storage-repair-restart"
        >
          <Text style={styles.restartText}>Restart App</Text>
        </Pressable>
      ) : null}
      {testSessionId &&
      storageRepairError &&
      !storageRepairInProgress &&
      !isRepairCompleted ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void releaseStorageRecoveryTestFault()}
          style={styles.restartButton}
          testID="native-storage-recovery-test-release-fault"
        >
          <Text style={styles.restartText}>Clear simulated fault</Text>
        </Pressable>
      ) : null}
      {hasAppComponent && !isRepairCompleted && !isEmergency ? (
        <Pressable
          accessibilityRole="button"
          style={styles.restartButton}
          testID="native-storage-repair-back"
          disabled={storageRepairInProgress}
          accessibilityState={{ disabled: storageRepairInProgress }}
          onPress={handleBack}
        >
          <Text style={styles.restartText}>Back</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

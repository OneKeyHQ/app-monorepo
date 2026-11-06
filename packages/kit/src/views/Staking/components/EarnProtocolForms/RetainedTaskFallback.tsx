import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  SizableText,
  Spinner,
  Toast,
  YStack,
} from '@onekeyhq/components';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { queryRetainedTaskStatus } from '../../earnDepositTask/queryRetainedTaskStatus';
import { depositTaskRegistry } from '../../earnDepositTask/registry';
import { isRetryableDepositRecordingStatus } from '../../earnDepositTask/state';
import { useDepositTask } from '../../earnDepositTask/useDepositTask';
import { useCommittedEarnScopeGuard } from '../../hooks/useCommittedEarnScopeGuard';

import type { IRetainedDepositTask } from '../../earnDepositTask/useRetainedDepositTask';

export function RetainedTaskFallback({
  ownerKey,
  retainedTask,
  assetsLoading,
  onRetryAssets,
  onFinished,
}: {
  ownerKey: string;
  retainedTask: IRetainedDepositTask;
  assetsLoading: boolean;
  onRetryAssets: () => void;
  onFinished?: () => void;
}) {
  const intl = useIntl();
  const [busy, setBusy] = useState(false);
  const flight = useRef<AbortController | undefined>(undefined);
  const scope = useCommittedEarnScopeGuard(
    `${ownerKey}:${retainedTask.task.taskId}`,
  );
  const { finishRecordingTask, getRecordingHandle } = useDepositTask(
    'retained-fallback',
    ownerKey,
    retainedTask,
  );
  const step = retainedTask.task.steps[retainedTask.task.currentStepIndex];
  const recording = retainedTask.task.recording;
  const canFinish = Boolean(
    recording &&
    ['succeeded', 'superseded', 'notTracked', 'remoteUnknown'].includes(
      recording.status,
    ),
  );
  const canRetryRecording = Boolean(
    isRetryableDepositRecordingStatus(recording?.status) &&
    getRecordingHandle(),
  );
  const canQuery = Boolean(
    (step?.status.type === 'unknown' &&
      step.status.txid &&
      !step.status.txidConflict) ||
    step?.status.type === 'confirming' ||
    step?.status.type === 'verifying',
  );
  useEffect(
    () => () => flight.current?.abort(),
    [ownerKey, retainedTask.task.taskId],
  );
  const onAction = useCallback(async () => {
    if (flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    const isCurrent = scope.capture();
    const stillRetained = () => {
      const entry = depositTaskRegistry.find(ownerKey);
      return Boolean(
        isCurrent() &&
        entry &&
        entry.state === retainedTask.state &&
        entry.token === retainedTask.token,
      );
    };
    try {
      if (canFinish && recording?.txid) {
        const finished = await finishRecordingTask(
          retainedTask.task.taskId,
          recording.txid,
          stillRetained,
          recording.status === 'remoteUnknown',
        );
        if (finished && isCurrent()) onFinished?.();
        else if (!finished && stillRetained()) {
          Toast.message({
            title: intl.formatMessage({
              id:
                recording.status === 'remoteUnknown'
                  ? ETranslations.global_pending
                  : ETranslations.global_an_error_occurred,
            }),
          });
        }
      } else if (canRetryRecording && stillRetained()) {
        const started = await getRecordingHandle()?.retryRecording();
        if (!started && stillRetained()) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        }
      } else if (canQuery && stillRetained()) {
        await queryRetainedTaskStatus({
          state: retainedTask.state,
          isCurrent: stillRetained,
          signal: controller.signal,
        });
      }
    } catch (error) {
      if (isCurrent()) errorToastUtils.showToastOfError(error);
    } finally {
      if (flight.current === controller) flight.current = undefined;
      if (isCurrent()) setBusy(false);
    }
  }, [
    canFinish,
    canQuery,
    canRetryRecording,
    finishRecordingTask,
    getRecordingHandle,
    intl,
    onFinished,
    ownerKey,
    recording?.status,
    recording?.txid,
    retainedTask,
    scope,
  ]);

  return (
    <YStack gap="$3" px="$5" py="$3">
      {assetsLoading ? (
        <Spinner />
      ) : (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          })}
          action={{
            primary: intl.formatMessage({ id: ETranslations.global_retry }),
            onPrimaryPress: onRetryAssets,
          }}
        />
      )}
      <SizableText>
        {intl.formatMessage({ id: ETranslations.global_pending })}
      </SizableText>
      {recording?.status === 'remoteUnknown' ? (
        <SizableText>
          {intl.formatMessage({ id: ETranslations.global_sync_error })}
          {' · '}
          {intl.formatMessage({
            id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
          })}
        </SizableText>
      ) : null}
      {canFinish || canRetryRecording || canQuery ? (
        <Button
          testID="earn-retained-task-action"
          loading={busy}
          disabled={busy}
          onPress={() => void onAction()}
        >
          {intl.formatMessage({
            id: canFinish
              ? ETranslations.global_done
              : ETranslations.global_retry,
          })}
        </Button>
      ) : null}
    </YStack>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { collectLogDigest, exportLogs, uploadLogBundle } from '.';

import pRetry, { type FailedAttemptError } from 'p-retry';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Progress,
  SizableText,
  Stack,
  Toast,
  useClipboard,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';

const MAX_RETRIES = 3;
const TOTAL_ATTEMPTS = MAX_RETRIES;

function UploadLogsDialogContent() {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const { copyText } = useClipboard();
  const [stage, setStage] = useState<ELogUploadStage | 'idle'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [instanceId, setInstanceId] = useState<string | undefined>();
  const isActiveRef = useRef(false);

  const handleEmailPress = useCallback(() => {
    copyText('hi@onekey.so');
  }, [copyText]);

  useEffect(() => {
    const handleProgressUpdate = ({
      stage: incomingStage,
      progressPercent: incomingPercent,
      message,
    }: {
      stage: ELogUploadStage;
      progressPercent?: number;
      message?: string;
    }) => {
      if (!isActiveRef.current) {
        return;
      }
      setStage(incomingStage);
      if (typeof incomingPercent === 'number') {
        setProgressPercent(Math.min(100, Math.max(0, incomingPercent)));
      } else if (incomingStage === ELogUploadStage.Success) {
        setProgressPercent(100);
      }
      if (message) {
        setErrorMessage(message);
      } else if (incomingStage !== ELogUploadStage.Error) {
        setErrorMessage(undefined);
      }
    };

    appEventBus.on(
      EAppEventBusNames.ClientLogUploadProgress,
      handleProgressUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.ClientLogUploadProgress,
        handleProgressUpdate,
      );
    };
  }, []);

  const resolveError = useCallback((err: unknown): Error => {
    const candidate = err as { originalError?: unknown; message?: unknown };
    if (candidate?.originalError) {
      return resolveError(candidate.originalError);
    }
    if (err instanceof Error) {
      return err;
    }
    if (typeof candidate?.message === 'string') {
      return new Error(candidate.message);
    }
    return new Error(String(err));
  }, []);

  const handleUpload = useCallback(
    async ({ preventClose }: { preventClose: () => void }) => {
      preventClose();
      if (isUploading) {
        return;
      }
      isActiveRef.current = true;
      setIsUploading(true);
      setCurrentAttempt(0);
      setErrorMessage(undefined);
      setStage(ELogUploadStage.Collecting);
      setProgressPercent(0);
      setInstanceId(undefined);

      const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
      const fileBaseName = `OneKeyLogs-${timestamp}`;

      const attemptUpload = async (attemptNumber: number) => {
        setCurrentAttempt(attemptNumber);
        setErrorMessage(undefined);
        setStage(ELogUploadStage.Collecting);
        setProgressPercent(0);
        const digest = await collectLogDigest(fileBaseName);
        const token = await backgroundApiProxy.serviceLogger.requestUploadToken(
          {
            sizeBytes: digest.sizeBytes,
            sha256: digest.sha256,
          },
        );
        const { result } = await uploadLogBundle({
          uploadToken: token.uploadToken,
          digest,
        });
        return result.objectKey;
      };

      try {
        await pRetry((attemptNumber) => attemptUpload(attemptNumber), {
          retries: MAX_RETRIES,
          onFailedAttempt: (error: FailedAttemptError) => {
            const originalError = resolveError(error);
            const message =
              originalError.message ||
              `Log upload failed (attempt ${
                error.attemptNumber - 1
              }/${TOTAL_ATTEMPTS}). Retrying...`;
            setCurrentAttempt(error.attemptNumber - 1);
            setStage(ELogUploadStage.Error);
            setErrorMessage(message);
          },
        });

        setStage(ELogUploadStage.Success);
        setProgressPercent(100);
        setCurrentAttempt(0);
        const instanceIdValue =
          await backgroundApiProxy.serviceSetting.getInstanceId();
        setInstanceId(instanceIdValue);
        Toast.success({
          title: 'Logs uploaded successfully',
        });
      } catch (error) {
        const finalError = resolveError(error);
        const message = finalError.message;
        setStage(ELogUploadStage.Error);
        setErrorMessage(message);
        try {
          await exportLogs(fileBaseName);
          setStage('idle');
          setProgressPercent(0);
          setErrorMessage(undefined);
          setCurrentAttempt(0);
          await dialog.close();
        } catch (exportError) {
          const exportMessage = resolveError(exportError).message;
          setErrorMessage(exportMessage);
        }
      } finally {
        isActiveRef.current = false;
        setIsUploading(false);
      }
    },
    [dialog, isUploading, resolveError],
  );

  const progressLabel = useMemo(() => {
    const clampedProgress = Math.min(100, Math.max(0, progressPercent));
    const attemptSuffix =
      currentAttempt > 1 && stage !== 'idle'
        ? ` (Attempt ${Math.min(
            currentAttempt,
            TOTAL_ATTEMPTS,
          )}/${TOTAL_ATTEMPTS})`
        : '';
    switch (stage) {
      case ELogUploadStage.Collecting:
        return `Collecting logs...${attemptSuffix}`;
      case ELogUploadStage.Uploading:
        return `Uploading... ${clampedProgress}%${attemptSuffix}`;
      case ELogUploadStage.Success:
        return 'Logs uploaded successfully';
      case ELogUploadStage.Error:
        return `Failed to upload logs${attemptSuffix}`;
      default:
        return '';
    }
  }, [currentAttempt, progressPercent, stage]);

  const shouldShowProgress = stage !== 'idle';

  const handleConfirmAction = useCallback(
    ({ preventClose }: { preventClose: () => void }) => {
      if (stage === ELogUploadStage.Success && instanceId) {
        copyText(instanceId);
        return;
      }
      void handleUpload({ preventClose });
    },
    [copyText, handleUpload, instanceId, stage],
  );

  const confirmText =
    stage === ELogUploadStage.Success && instanceId
      ? 'Copy Instance ID'
      : 'Upload';

  return (
    <Stack gap="$5">
      <Stack>
        <SizableText size="$bodyLg">
          {intl.formatMessage({
            id: ETranslations.settings_logs_do_not_include_sensitive_data,
          })}
        </SizableText>
        <Stack h="$5" />
        <SizableText size="$bodyLg">
          {intl.formatMessage(
            {
              id: ETranslations.settings_export_state_logs_desc,
            },
            {
              email: (
                <SizableText
                  size="$bodyLg"
                  textDecorationLine="underline"
                  onPress={handleEmailPress}
                >
                  hi@onekey.so
                </SizableText>
              ),
            },
          )}
        </SizableText>
      </Stack>
      {shouldShowProgress ? (
        <Stack gap="$3">
          <Progress value={progressPercent} />
          <SizableText size="$bodyMd">{progressLabel}</SizableText>
          {errorMessage ? (
            <SizableText size="$bodySm" color="$textCritical">
              {errorMessage}
            </SizableText>
          ) : null}
        </Stack>
      ) : null}
      <Dialog.Footer
        showCancelButton
        onConfirm={handleConfirmAction}
        onConfirmText={confirmText}
        confirmButtonProps={{
          variant: 'primary',
          loading: isUploading && stage !== ELogUploadStage.Success,
          disabled:
            (stage === ELogUploadStage.Success && !instanceId) || isUploading,
        }}
        cancelButtonProps={{
          disabled: isUploading,
        }}
      />
    </Stack>
  );
}

export function showExportLogsDialog({ title }: { title: string }) {
  return Dialog.show({
    icon: 'UploadOutline',
    title,
    showFooter: false,
    renderContent: <UploadLogsDialogContent />,
  });
}

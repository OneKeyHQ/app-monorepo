import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { collectLogDigest, uploadLogBundle } from '.';

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

function UploadLogsDialogContent() {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const { copyText } = useClipboard();
  const [stage, setStage] = useState<ELogUploadStage | 'idle'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);
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

  const handleUpload = useCallback(async () => {
    if (isUploading) {
      return;
    }
    isActiveRef.current = true;
    setErrorMessage(undefined);
    setStage(ELogUploadStage.Collecting);
    setProgressPercent(0);
    setIsUploading(true);
    try {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
      const fileBaseName = `OneKeyLogs-${timestamp}`;
      const digest = await collectLogDigest(fileBaseName);
      const token = await backgroundApiProxy.serviceLogger.requestUploadToken({
        sizeBytes: digest.sizeBytes,
        sha256: digest.sha256,
      });
      await uploadLogBundle({
        uploadToken: token.uploadToken,
        digest,
      });
      setStage(ELogUploadStage.Success);
      setProgressPercent(100);
      Toast.success({
        title: 'Logs uploaded successfully',
      });
      setIsUploading(false);
      await dialog.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStage(ELogUploadStage.Error);
      Toast.error({
        title: 'Failed to upload logs',
      });
      setIsUploading(false);
    } finally {
      isActiveRef.current = false;
    }
  }, [dialog, isUploading]);

  const progressLabel = useMemo(() => {
    const clampedProgress = Math.min(100, Math.max(0, progressPercent));
    switch (stage) {
      case ELogUploadStage.Collecting:
        return 'Collecting logs...';
      case ELogUploadStage.Uploading:
        return `Uploading... ${clampedProgress}%`;
      case ELogUploadStage.Success:
        return 'Logs uploaded successfully';
      case ELogUploadStage.Error:
        return 'Failed to upload logs';
      default:
        return '';
    }
  }, [progressPercent, stage]);

  const shouldShowProgress = stage !== 'idle';

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
        onConfirm={handleUpload}
        onConfirmText="Upload"
        confirmButtonProps={{
          variant: 'primary',
          loading: isUploading,
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

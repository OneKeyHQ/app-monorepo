import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { collectLogDigest, uploadLogBundle } from '.';

import {
  Dialog,
  Progress,
  SizableText,
  Stack,
  Toast,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';

import type { IntlShape } from 'react-intl';

type IUploadLogsDialogHandle = {
  startUpload: () => Promise<boolean>;
};

type IUploadLogsDialogContentProps = {
  intl: IntlShape;
};

const UploadLogsDialogContent = forwardRef(
  (
    { intl }: IUploadLogsDialogContentProps,
    ref: ForwardedRef<IUploadLogsDialogHandle>,
  ) => {
    const { copyText } = useClipboard();
    const [stage, setStage] = useState<ELogUploadStage | 'idle'>('idle');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string | undefined>();
    const activeRef = useRef(false);

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
        if (!activeRef.current) {
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

    const startUpload = useCallback(async () => {
      if (activeRef.current) {
        return false;
      }
      activeRef.current = true;
      setErrorMessage(undefined);
      setStage(ELogUploadStage.Collecting);
      setProgressPercent(0);
      try {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const fileBaseName = `OneKeyLogs-${timestamp}`;
        const digest = await collectLogDigest(fileBaseName);
        const token = await backgroundApiProxy.serviceLogger.requestUploadToken(
          {
            sizeBytes: digest.sizeBytes,
            sha256: digest.sha256,
          },
        );
        await uploadLogBundle({
          uploadToken: token.uploadToken,
          digest,
        });
        Toast.success({
          title: 'Logs uploaded successfully',
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setErrorMessage(message);
        setStage(ELogUploadStage.Error);
        Toast.error({
          title: 'Failed to upload logs',
        });
        return false;
      } finally {
        activeRef.current = false;
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        startUpload,
      }),
      [startUpload],
    );

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
      </Stack>
    );
  },
);

UploadLogsDialogContent.displayName = 'UploadLogsDialogContent';

export function showExportLogsDialog({ intl }: { intl: IntlShape }) {
  let contentRef: IUploadLogsDialogHandle | null = null;
  return Dialog.show({
    icon: 'UploadOutline',
    title: intl.formatMessage({
      id: ETranslations.settings_export_state_logs,
    }),
    renderContent: (
      <UploadLogsDialogContent
        ref={(ref) => {
          contentRef = ref;
        }}
        intl={intl}
      />
    ),
    confirmButtonProps: {
      variant: 'primary',
    },
    onConfirmText: 'Upload',
    onConfirm: async ({ close, preventClose }) => {
      if (!contentRef) {
        await close();
        return;
      }
      preventClose();
      const result = await contentRef.startUpload();
      if (result) {
        await close();
      }
    },
  });
}

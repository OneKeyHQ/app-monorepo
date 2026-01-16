import { useCallback, useEffect, useRef, useState } from 'react';

import { collectLogDigest, exportLogs, uploadLogBundle } from '.';

import pRetry from 'p-retry';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  Progress,
  SizableText,
  Stack,
  Toast,
  XStack,
  useClipboard,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ELogUploadStage } from '@onekeyhq/shared/src/logger/types';

const MAX_RETRIES = 3;

// Internal UI states (combining backend stages for better UX)
type IDialogStage =
  | 'idle'
  | 'uploading_in_progress'
  | 'success_show_instance_id'
  | 'fallback_exporting'
  | 'fallback_export_done'
  | 'final_error';

function UploadLogsDialogContent() {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const { copyText } = useClipboard();
  const [dialogStage, setDialogStage] = useState<IDialogStage>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [instanceId, setInstanceId] = useState<string | undefined>();
  const [instanceIdCopied, setInstanceIdCopied] = useState(false);
  const isActiveRef = useRef(false);
  const fileBaseNameRef = useRef<string>('');

  const handleEmailPress = useCallback(() => {
    copyText('hi@onekey.so');
  }, [copyText]);

  const handleInstanceIdCopy = useCallback(() => {
    if (instanceId) {
      copyText(instanceId);
      setInstanceIdCopied(true);
    }
  }, [copyText, instanceId]);

  // Listen to backend upload progress events
  useEffect(() => {
    const handleProgressUpdate = ({
      stage: incomingStage,
      progressPercent: incomingPercent,
    }: {
      stage: ELogUploadStage;
      progressPercent?: number;
    }) => {
      if (!isActiveRef.current) {
        return;
      }

      // Map backend stages to unified "uploading_in_progress" for UX
      // Only update progress, don't expose error states
      if (incomingStage === ELogUploadStage.Uploading) {
        if (typeof incomingPercent === 'number') {
          setProgressPercent(Math.min(100, Math.max(0, incomingPercent)));
        }
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

  const generateFileBaseName = useCallback(() => {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    return `OneKeyLogs-${timestamp}`;
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

  const handleManualExport = useCallback(async () => {
    const fileBaseName = generateFileBaseName();
    try {
      await exportLogs(fileBaseName);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.settings_log_file_exported_successfully,
        }),
      });
      void dialog.close();
    } catch (error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.settings_export_logs_failed_title,
        }),
      });
    }
  }, [generateFileBaseName, intl, dialog]);

  const handleUpload = useCallback(
    async ({ preventClose }: { preventClose: () => void }) => {
      preventClose();
      if (
        dialogStage === 'uploading_in_progress' ||
        dialogStage === 'fallback_exporting'
      ) {
        return;
      }

      isActiveRef.current = true;
      setDialogStage('uploading_in_progress');
      setProgressPercent(0);
      setErrorMessage(undefined);
      setInstanceId(undefined);
      setInstanceIdCopied(false);

      const fileBaseName = generateFileBaseName();
      fileBaseNameRef.current = fileBaseName;

      const attemptUpload = async () => {
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
        // Try upload with silent retry (no error display during retry)
        await pRetry(() => attemptUpload(), {
          retries: MAX_RETRIES,
          onFailedAttempt: (error) => {
            // Log retry attempts for debugging (not shown to user)
            console.log(
              `[Log Upload] Retry attempt ${error.attemptNumber}/${
                MAX_RETRIES + 1
              } failed:`,
              error.message,
            );
          },
        });

        // Upload succeeded
        console.log('[Log Upload] Upload succeeded');
        setDialogStage('success_show_instance_id');
        setProgressPercent(100);

        const instanceIdValue =
          await backgroundApiProxy.serviceSetting.getInstanceId();
        setInstanceId(instanceIdValue);

        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.settings_logs_uploaded_successfully,
          }),
        });
      } catch (error) {
        // Upload failed after retries - fallback to export
        console.log(
          '[Log Upload] All upload attempts failed, falling back to export',
        );
        setDialogStage('fallback_exporting');
        setProgressPercent(0);

        try {
          await exportLogs(fileBaseName);

          // Export succeeded
          console.log('[Log Upload] Export succeeded');
          setDialogStage('fallback_export_done');
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.settings_log_file_exported_successfully,
            }),
          });
        } catch (exportError) {
          // Both upload and export failed
          console.error('[Log Upload] Export also failed:', exportError);
          const exportMessage = resolveError(exportError).message;
          setDialogStage('final_error');
          setErrorMessage(
            exportMessage || 'Failed to export logs. Please contact support.',
          );
        }
      } finally {
        isActiveRef.current = false;
      }
    },
    [dialogStage, resolveError, intl, generateFileBaseName],
  );

  const handleConfirmAction = useCallback(
    ({ preventClose }: { preventClose: () => void }) => {
      void handleUpload({ preventClose });
    },
    [handleUpload],
  );

  // Render different content based on current stage
  const renderContent = () => {
    switch (dialogStage) {
      case 'idle':
        return (
          <Stack>
            <HyperlinkText
              size="$bodyLg"
              color="$textSubdued"
              translationId={
                ETranslations.settings_logs_do_not_include_sensitive_data
              }
              onAction={handleManualExport}
            />
          </Stack>
        );

      case 'uploading_in_progress':
        return (
          <Stack gap="$3">
            <Progress value={progressPercent} />
            <SizableText size="$bodyMd">
              {intl.formatMessage(
                {
                  id: ETranslations.settings_uploading_logs_progress,
                },
                {
                  progress: Math.min(100, Math.max(0, progressPercent)),
                },
              )}
            </SizableText>
          </Stack>
        );

      case 'success_show_instance_id':
        return (
          <Stack gap="$4">
            <XStack gap="$2" alignItems="center">
              <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />
              <SizableText size="$headingMd" color="$textSuccess">
                {intl.formatMessage({
                  id: ETranslations.settings_upload_logs_success_title,
                })}
              </SizableText>
            </XStack>

            <Stack gap="$2">
              <SizableText size="$bodyMd" fontWeight="600">
                {intl.formatMessage({
                  id: ETranslations.settings_provide_instance_id_to_support,
                })}
              </SizableText>
              <XStack
                gap="$2"
                p="$3"
                bg="$bgSubdued"
                borderRadius="$2"
                alignItems="center"
              >
                <SizableText size="$bodyMd" flex={1} numberOfLines={1}>
                  {instanceId || '-'}
                </SizableText>
                <Button
                  size="small"
                  variant="tertiary"
                  onPress={handleInstanceIdCopy}
                  icon={instanceIdCopied ? 'CheckRadioSolid' : 'Copy1Outline'}
                >
                  {instanceIdCopied
                    ? intl.formatMessage({
                        id: ETranslations.global_copied,
                      })
                    : intl.formatMessage({
                        id: ETranslations.global_copy,
                      })}
                </Button>
              </XStack>
            </Stack>
          </Stack>
        );

      case 'fallback_exporting':
        return (
          <Stack gap="$3">
            <Progress value={50} />
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.settings_preparing_export_log_file,
              })}
            </SizableText>
          </Stack>
        );

      case 'fallback_export_done':
        return (
          <Stack gap="$4">
            <XStack gap="$2" alignItems="center">
              <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />
              <SizableText size="$headingMd" color="$textSuccess">
                {intl.formatMessage({
                  id: ETranslations.settings_log_file_exported_title,
                })}
              </SizableText>
            </XStack>

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
        );

      case 'final_error':
        return (
          <Stack gap="$3">
            <XStack gap="$2" alignItems="center">
              <Icon name="XCircleSolid" color="$iconCritical" size="$5" />
              <SizableText size="$headingMd" color="$textCritical">
                {intl.formatMessage({
                  id: ETranslations.settings_export_logs_failed_title,
                })}
              </SizableText>
            </XStack>
            {errorMessage ? (
              <SizableText size="$bodyMd" color="$textCritical">
                {errorMessage}
              </SizableText>
            ) : null}
            <SizableText size="$bodyMd">
              Please contact support directly at{' '}
              <SizableText
                size="$bodyMd"
                textDecorationLine="underline"
                onPress={handleEmailPress}
              >
                hi@onekey.so
              </SizableText>
            </SizableText>
          </Stack>
        );

      default:
        return null;
    }
  };

  const isLoading =
    dialogStage === 'uploading_in_progress' ||
    dialogStage === 'fallback_exporting';
  const isSuccess =
    dialogStage === 'success_show_instance_id' ||
    dialogStage === 'fallback_export_done';
  const showConfirmButton = dialogStage === 'idle';

  return (
    <Stack gap="$5">
      {renderContent()}
      <Dialog.Footer
        showCancelButton={!isSuccess}
        onConfirm={handleConfirmAction}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_upload,
        })}
        onCancelText={
          isSuccess
            ? intl.formatMessage({
                id: ETranslations.global_done,
              })
            : intl.formatMessage({
                id: ETranslations.global_cancel,
              })
        }
        confirmButtonProps={{
          variant: 'primary',
          loading: isLoading,
          disabled: isLoading || !showConfirmButton,
          display: showConfirmButton ? 'flex' : 'none',
        }}
        cancelButtonProps={{
          disabled: isLoading,
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

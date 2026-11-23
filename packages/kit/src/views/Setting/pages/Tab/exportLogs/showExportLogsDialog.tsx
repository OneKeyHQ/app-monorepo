import { useCallback, useEffect, useRef, useState } from 'react';

import { collectLogDigest, disposeLogDigest, exportLogs } from '.';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  Progress,
  Radio,
  SizableText,
  Stack,
  Toast,
  XStack,
  useClipboard,
  useDialogInstance,
} from '@onekeyhq/components';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { inAppStateLockDialogProps } from '@onekeyhq/kit/src/views/Setting/hooks';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  BROWSER_LOG_MAX_BYTES,
  ELogUploadStage,
  RECENT_LOG_EXPORT_BYTES,
} from '@onekeyhq/shared/src/logger/types';
import type {
  ILogDigest,
  ILogExportScope,
} from '@onekeyhq/shared/src/logger/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { downloadLogDigest } from './downloadLogDigest';
import {
  resolveLogUploadError,
  uploadLogsWithRetry,
} from './uploadLogsWithRetry';

const usesBrowserLogExport = platformEnv.isExtension || platformEnv.isWeb;
const LOG_ID_BREAK_STYLE = { wordBreak: 'break-all' } as const;

// Internal UI states (combining backend stages for better UX)
type IDialogStage =
  | 'idle'
  | 'uploading_in_progress'
  | 'success_show_instance_id'
  | 'fallback_exporting'
  | 'fallback_export_done'
  | 'final_error';

function UploadLogsDialogContent({
  inAppStateLock,
}: {
  inAppStateLock?: boolean;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const { copyText } = useClipboard();
  const [dialogStage, setDialogStage] = useState<IDialogStage>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [logId, setLogId] = useState<string | undefined>();
  const [logIdCopied, setLogIdCopied] = useState(false);
  const [exportScope, setExportScope] = useState<ILogExportScope>('recent');
  const isActiveRef = useRef(false);
  const fileBaseNameRef = useRef<string>('');

  const handleEmailPress = useCallback(() => {
    copyText('hi@onekey.so');
  }, [copyText]);

  const handleLogIdCopy = useCallback(() => {
    if (logId) {
      copyText(logId);
      setLogIdCopied(true);
    }
  }, [copyText, logId]);

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

  const handleManualExport = useCallback(async () => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setDialogStage('fallback_exporting');
    const fileBaseName = generateFileBaseName();
    try {
      await exportLogs(fileBaseName, exportScope);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.settings_log_file_exported_successfully,
        }),
      });
      void dialog.close();
    } catch (_error) {
      setDialogStage('idle');
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.settings_export_logs_failed_title,
        }),
      });
    } finally {
      isActiveRef.current = false;
    }
  }, [generateFileBaseName, intl, dialog, exportScope]);

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
      setLogId(undefined);
      setLogIdCopied(false);

      const fileBaseName = generateFileBaseName();
      fileBaseNameRef.current = fileBaseName;
      const upload: { digest?: ILogDigest } = {};
      let digest: ILogDigest | undefined;

      try {
        // Silent retry (no error display during retry) for transient errors.
        let objectKey: string;
        try {
          objectKey = await uploadLogsWithRetry({
            state: upload,
            collectDigest: () =>
              usesBrowserLogExport
                ? collectLogDigest(fileBaseName, exportScope)
                : collectLogDigest(fileBaseName),
          });
        } finally {
          digest = upload.digest;
          if (digest && !usesBrowserLogExport) {
            await disposeLogDigest(digest);
          }
        }

        // Upload succeeded
        console.log('[Log Upload] Upload succeeded');
        setDialogStage('success_show_instance_id');
        setProgressPercent(100);
        setLogId(objectKey);

        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.settings_logs_uploaded_successfully,
          }),
        });
      } catch (_error) {
        // On the lock screen manual export is unavailable (file save / share
        // sheet cannot be presented above the lock overlay), so skip the
        // export fallback and surface a terminal error instead. (OK-56874)
        if (inAppStateLock) {
          console.log(
            '[Log Upload] Upload failed on lock screen; manual export disabled',
          );
          setDialogStage('final_error');
          setErrorMessage(undefined);
          return;
        }
        // Upload failed after retries - fallback to export
        console.log(
          '[Log Upload] All upload attempts failed, falling back to export',
        );
        setDialogStage('fallback_exporting');
        setProgressPercent(0);

        try {
          if (usesBrowserLogExport && digest) downloadLogDigest(digest);
          else await exportLogs(fileBaseName, exportScope);

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
          const exportMessage = resolveLogUploadError(exportError).message;
          setDialogStage('final_error');
          setErrorMessage(
            exportMessage || 'Failed to export logs. Please contact support.',
          );
        }
      } finally {
        if (usesBrowserLogExport && digest) await disposeLogDigest(digest);
        isActiveRef.current = false;
      }
    },
    [dialogStage, intl, generateFileBaseName, inAppStateLock, exportScope],
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
          <Stack gap="$4">
            {usesBrowserLogExport && !inAppStateLock ? (
              <Radio
                testID="log-export-scope"
                value={exportScope}
                onChange={(value) => {
                  if (value === 'recent' || value === 'full')
                    setExportScope(value);
                }}
                options={[
                  {
                    value: 'recent',
                    label: intl.formatMessage({
                      id: ETranslations.global_recents,
                    }),
                    description: `≤ ${RECENT_LOG_EXPORT_BYTES / 1024 / 1024} MiB`,
                  },
                  {
                    value: 'full',
                    label: intl.formatMessage({ id: ETranslations.global_all }),
                    description: `≤ ${BROWSER_LOG_MAX_BYTES / 1024 / 1024} MiB`,
                  },
                ]}
              />
            ) : null}
            {inAppStateLock ? (
              // Lock screen: keep the privacy reassurance but hide the inline
              // "manually export logs" action, since file export / share sheet
              // cannot be presented above the lock overlay. (OK-56874)
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.settings_logs_do_not_include_sensitive_data,
                  },
                  {
                    action: () => null,
                    underline: () => null,
                  },
                )}
              </SizableText>
            ) : (
              <HyperlinkText
                size="$bodyLg"
                color="$textSubdued"
                translationId={
                  ETranslations.settings_logs_do_not_include_sensitive_data
                }
                onAction={handleManualExport}
              />
            )}
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
                  id: ETranslations.settings_share_log_id_with_support__desc,
                })}
              </SizableText>
              <XStack
                gap="$2"
                p="$3"
                bg="$bgSubdued"
                borderRadius="$2"
                alignItems="center"
              >
                {/* The log ID is long; show it whole so it can be checked. */}
                <SizableText
                  size="$bodyMd"
                  flex={1}
                  style={platformEnv.isNative ? undefined : LOG_ID_BREAK_STYLE}
                >
                  {logId || '-'}
                </SizableText>
                <Button
                  testID="setting-btn"
                  size="small"
                  variant="tertiary"
                  onPress={handleLogIdCopy}
                  icon={logIdCopied ? 'CheckRadioSolid' : 'Copy1Outline'}
                >
                  {logIdCopied
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

export function showExportLogsDialog({
  title,
  inAppStateLock,
}: {
  title: string;
  // Render the dialog above the app-state lock screen overlay (OK-56874).
  inAppStateLock?: boolean;
}) {
  return Dialog.show({
    icon: 'UploadOutline',
    title,
    showFooter: false,
    renderContent: <UploadLogsDialogContent inAppStateLock={inAppStateLock} />,
    ...(inAppStateLock ? inAppStateLockDialogProps : undefined),
  });
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useDialogInstance,
  useShare,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getPrimeTransferImportProgressPercent } from '@onekeyhq/shared/src/utils/primeTransferImportProgressUtils';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import { usePrimeTransferExit } from './hooks/usePrimeTransferExit';

type IPrimeTransferImportTraceSnapshot = Awaited<
  ReturnType<
    typeof backgroundApiProxy.servicePrimeTransfer.getImportTraceSnapshot
  >
>;

type IPrimeTransferImportTraceDebugApi = {
  help: string;
  usage: string[];
  getImportTraceSnapshot: () => Promise<IPrimeTransferImportTraceSnapshot>;
  getImportTraceText: () => Promise<string>;
  getLatestImportTraceEntries: (
    limit?: number,
  ) => Promise<IPrimeTransferImportTraceSnapshot>;
};

type IOneKeyDebugApiRegistry = {
  primeTransferImportTrace?: {
    description: string;
    usage: string[];
    api: IPrimeTransferImportTraceDebugApi;
  };
};

type IPrimeTransferImportTraceDebugGlobal = typeof globalThis & {
  $$oneKeyPrimeTransferDebug?: IPrimeTransferImportTraceDebugApi;
  $$oneKeyDebugApis?: IOneKeyDebugApiRegistry;
};

const PRIME_TRANSFER_IMPORT_TRACE_DEBUG_HELP =
  'Prime Transfer import trace debug API. Data is read from ServicePrimeTransfer memory buffer.';

const PRIME_TRANSFER_IMPORT_TRACE_DEBUG_USAGE = [
  'await globalThis.$$oneKeyPrimeTransferDebug.getImportTraceSnapshot()',
  'await window.$$oneKeyPrimeTransferDebug.getImportTraceSnapshot()',
  'await globalThis.$$oneKeyPrimeTransferDebug.getLatestImportTraceEntries(100)',
  'await globalThis.$$oneKeyPrimeTransferDebug.getImportTraceText()',
  'globalThis.$$oneKeyDebugApis.primeTransferImportTrace',
  'window.$$oneKeyDebugApis.primeTransferImportTrace',
];

export function registerPrimeTransferImportTraceDebugGlobal() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const api: IPrimeTransferImportTraceDebugApi = {
    help: PRIME_TRANSFER_IMPORT_TRACE_DEBUG_HELP,
    usage: PRIME_TRANSFER_IMPORT_TRACE_DEBUG_USAGE,
    getImportTraceSnapshot: () =>
      backgroundApiProxy.servicePrimeTransfer.getImportTraceSnapshot(),
    getImportTraceText: async () =>
      stableStringify(
        await backgroundApiProxy.servicePrimeTransfer.getImportTraceSnapshot(),
      ),
    getLatestImportTraceEntries: async (limit = 50) => {
      const trace =
        await backgroundApiProxy.servicePrimeTransfer.getImportTraceSnapshot();
      return {
        ...trace,
        entries: trace.entries.slice(-limit),
      };
    },
  };
  const currentGlobal = globalThis as IPrimeTransferImportTraceDebugGlobal & {
    window?: IPrimeTransferImportTraceDebugGlobal;
  };
  const debugGlobals = [currentGlobal, currentGlobal.window].filter(
    Boolean,
  ) as IPrimeTransferImportTraceDebugGlobal[];

  for (const globalWithDebug of debugGlobals) {
    globalWithDebug.$$oneKeyPrimeTransferDebug = api;
    globalWithDebug.$$oneKeyDebugApis = {
      ...globalWithDebug.$$oneKeyDebugApis,
      primeTransferImportTrace: {
        description: PRIME_TRANSFER_IMPORT_TRACE_DEBUG_HELP,
        usage: PRIME_TRANSFER_IMPORT_TRACE_DEBUG_USAGE,
        api,
      },
    };
  }
}

function PrimeTransferImportProcessingDialogContent({
  navigation: _navigation,
  closeAfterDone,
  closeAfterCancel,
  closeAfterError,
}: {
  navigation?: IAppNavigation;
  closeAfterDone?: boolean;
  closeAfterCancel?: boolean;
  closeAfterError?: boolean;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const { copyText } = useClipboard();
  const { shareText } = useShare();
  const [primeTransferAtom] = usePrimeTransferAtom();
  const { exitTransferFlow, disableExitPrevention } = usePrimeTransferExit();
  const [isCancelled, setIsCancelled] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hasError, setHasError] = useState(false);
  const [importTargetProcessingDuration, setImportTargetProcessingDuration] =
    useState<string>('');
  const importTargetLastChangeTimestampRef = useRef<number>(Date.now());
  const importTargetProcessingHistoryRef = useRef<Array<[string, string]>>([]);
  const previousImportTargetNameRef = useRef<string>('');

  const { importProgress } = primeTransferAtom;
  const isDone = useMemo(() => {
    // return false;
    return Boolean(
      importProgress &&
      !importProgress.isImporting &&
      importProgress.current >= importProgress.total,
    );
  }, [importProgress]);

  useEffect(() => {
    if (closeAfterDone && isDone) {
      void dialogInstance.close();
    }
    if (closeAfterCancel && isCancelled) {
      void dialogInstance.close();
    }
    if (closeAfterError && hasError) {
      void dialogInstance.close();
    }
  }, [
    closeAfterDone,
    isDone,
    dialogInstance,
    closeAfterCancel,
    isCancelled,
    closeAfterError,
    hasError,
  ]);

  useEffect(() => {
    registerPrimeTransferImportTraceDebugGlobal();
  }, []);

  const isFlowEnded = isDone || isCancelled || hasError;
  const progressPercentage =
    getPrimeTransferImportProgressPercent(importProgress) ?? 0;

  useEffect(() => {
    const cb = async (
      payload: IAppEventBusPayload[EAppEventBusNames.BatchCreateAccount],
    ) => {
      await backgroundApiProxy.servicePrimeTransfer.updateImportProgress({
        source: 'batchCreateAccount',
        batchProgress: {
          totalCount: payload.totalCount,
          createdCount: payload.createdCount,
          progressTotal: payload.progressTotal,
          progressCurrent: payload.progressCurrent,
          networkId: payload.networkId,
          deriveType: payload.deriveType,
        },
      });
    };
    appEventBus.on(EAppEventBusNames.BatchCreateAccount, cb);

    return () => {
      appEventBus.off(EAppEventBusNames.BatchCreateAccount, cb);
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    const currentDuration = `${
      now - importTargetLastChangeTimestampRef.current
    }ms`;
    setImportTargetProcessingDuration(currentDuration);

    if (previousImportTargetNameRef.current) {
      importTargetProcessingHistoryRef.current.push([
        previousImportTargetNameRef.current,
        currentDuration,
      ]);
    }

    importTargetLastChangeTimestampRef.current = now;
    previousImportTargetNameRef.current =
      primeTransferAtom.importCurrentCreatingTarget || '';
  }, [primeTransferAtom.importCurrentCreatingTarget]);

  const exportPrimeTransferImportTrace = useCallback(async () => {
    const trace =
      await backgroundApiProxy.servicePrimeTransfer.getImportTraceSnapshot();
    const text = stableStringify(trace);
    try {
      copyText(text);
    } catch (_error) {
      //
    }
    try {
      await shareText(text);
    } catch (_error) {
      //
    }
    Dialog.debugMessage({
      debugMessage: {
        entriesCount: trace.entries.length,
        droppedEntriesCount: trace.droppedEntriesCount,
        maxEntries: trace.maxEntries,
        cleanupDelayMs: trace.cleanupDelayMs,
        currentProgress: trace.currentProgress,
        latestEntries: trace.entries.slice(-20),
      },
    });
  }, [copyText, shareText]);

  /*
  Dialog.show({
            title: intl.formatMessage({
              id: ETranslations.transfer_transfer_data_completed,
            }),
            showCancelButton: false,
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_done,
            }),
            disableDrag: true,
            dismissOnOverlayPress: false,
          });
          */

  return (
    <Stack>
      <YStack alignItems="center">
        {isDone ? (
          <Icon name="CheckRadioSolid" size="$12" color="$iconSuccess" />
        ) : null}

        {(isCancelled || hasError) && !isDone ? (
          <Icon name="XCircleSolid" size="$12" color="$iconCritical" />
        ) : null}

        {!isFlowEnded && importProgress ? (
          <Progress mt="$4" w="100%" size="medium" value={progressPercentage} />
        ) : null}

        <MultipleClickStack
          showDevBgColor
          debugComponent={
            <YStack gap="$2" alignItems="center">
              <SizableText
                textAlign="center"
                onPress={() => {
                  Dialog.debugMessage({
                    debugMessage: importProgress?.totalDetailInfo,
                  });
                }}
              >
                {importProgress?.current ?? 0}/{importProgress?.total ?? 0}
                {'  '}
                {importTargetProcessingDuration}
              </SizableText>
              <SizableText
                textAlign="center"
                onPress={() => {
                  Dialog.debugMessage({
                    debugMessage: importTargetProcessingHistoryRef,
                  });
                }}
              >
                {primeTransferAtom.importCurrentCreatingTarget}
              </SizableText>
              <SizableText
                onPress={async () => {
                  const d =
                    await backgroundApiProxy.servicePrimeTransfer.getBatchCreateHdAccountsParams();
                  Dialog.debugMessage({
                    debugMessage: d,
                  });
                }}
              >
                ShowBatchCreateHdAccountsParams
              </SizableText>
              {/*
                Chrome/AI debug commands for this hidden export entry:
                await window.$$oneKeyPrimeTransferDebug.getImportTraceSnapshot()
                await window.$$oneKeyPrimeTransferDebug.getLatestImportTraceEntries(100)
                await window.$$oneKeyDebugApis.primeTransferImportTrace.api.getImportTraceText()
              */}
              <SizableText onPress={exportPrimeTransferImportTrace}>
                ExportPrimeTransferImportTrace
              </SizableText>
              <SizableText textAlign="center">
                {JSON.stringify(importProgress?.stats)}
              </SizableText>
            </YStack>
          }
        >
          <XStack mt="$5" alignItems="center" gap="$2">
            <SizableText size="$bodyLg" textAlign="center">
              {(() => {
                if (isDone || importProgress) {
                  return `${intl.formatMessage(
                    {
                      id: ETranslations.global_import_progress,
                    },
                    {
                      amount: platformEnv.isDev
                        ? `${importProgress?.current || 0}/${
                            importProgress?.total || 0
                          } ${progressPercentage}%`
                        : (importProgress?.current ?? 0),
                    },
                  )} ${progressPercentage}%`;
                }
                if (isCancelled) {
                  return intl.formatMessage({
                    id: ETranslations.global_cancel,
                  });
                }
                if (hasError) {
                  return intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  });
                }
                return intl.formatMessage({
                  id: ETranslations.transfer_transfer_loading,
                });
              })()}
            </SizableText>
          </XStack>
        </MultipleClickStack>
      </YStack>

      <Dialog.Footer
        showCancelButton={false}
        showConfirmButton={isFlowEnded} // cancel import not supported yet
        confirmButtonProps={{
          variant: isFlowEnded ? 'primary' : 'secondary',
          testID: 'prime-transfer-import-dialog-confirm-button',
        }}
        onConfirmText={
          isFlowEnded
            ? intl.formatMessage({ id: ETranslations.global_done })
            : intl.formatMessage({ id: ETranslations.global_cancel })
        }
        onConfirm={
          isFlowEnded
            ? async () => {
                if (!isCancelled) {
                  exitTransferFlow();
                } else {
                  disableExitPrevention();
                }
                setTimeout(async () => {
                  await backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
                }, 600);
              }
            : async ({ preventClose }) => {
                preventClose();
                setIsCancelled(true);
                setTimeout(async () => {
                  await backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
                }, 600);
              }
        }
      />
    </Stack>
  );
}

export function showPrimeTransferImportProcessingDialog({
  navigation,
  closeAfterDone,
  closeAfterCancel,
  closeAfterError,
  ...dialogProps
}: IDialogShowProps & {
  navigation?: IAppNavigation;
  closeAfterDone?: boolean;
  closeAfterCancel?: boolean;
  closeAfterError?: boolean;
}) {
  return Dialog.show({
    showExitButton: !!platformEnv.isDev,
    dismissOnOverlayPress: false,
    onCancel() {
      void backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
    },
    onClose() {
      void backgroundApiProxy.servicePrimeTransfer.resetImportProgress();
    },
    title: '',
    renderContent: (
      <PrimeTransferImportProcessingDialogContent
        navigation={navigation}
        closeAfterDone={closeAfterDone}
        closeAfterCancel={closeAfterCancel}
        closeAfterError={closeAfterError}
      />
    ),
    ...dialogProps,
  });
}

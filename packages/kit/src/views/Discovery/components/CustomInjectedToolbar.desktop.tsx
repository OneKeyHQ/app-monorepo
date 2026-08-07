import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Input,
  SizableText,
  Spinner,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  logCustomInjectedClientError,
  logCustomInjectedClientOperation,
} from '@onekeyhq/kit/src/utils/customInjectedClientOperationLog';
import { setCustomInjectedE2EWorkflowActions } from '@onekeyhq/kit/src/utils/customInjectedE2EWorkflowRuntime';
import {
  getCustomInjectedOperationLogErrorAcknowledgedAt,
  isCustomInjectedOperationLogError,
  setCustomInjectedOperationLogAppStartedAt,
  subscribeCustomInjectedOperationLogErrorAcknowledgement,
} from '@onekeyhq/kit/src/utils/customInjectedOperationLogRuntime';
import {
  createCustomInjectedProtocolFilterRows,
  filterCustomInjectedProtocolRows,
  getCustomInjectedProtocolListFilter,
  subscribeCustomInjectedProtocolListFilter,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolListFilterRuntime';
import {
  acquireCustomInjectedProtocolSelectionLock,
  isCustomInjectedProtocolRuntimeActive,
  waitForCustomInjectedProtocolRuntimeReady,
} from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import { setActiveCustomInjectedWorkspace } from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';
import type {
  ICustomInjectedE2EWorkflowState,
  ICustomInjectedE2EWorkflowSummary,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import type {
  ICustomInjectedE2EOutcome,
  ICustomInjectedModalParamList,
} from '@onekeyhq/kit/src/views/Discovery/router/customInjectedModalRoutes';
import {
  ECustomInjectedModalRoutes,
  buildCustomInjectedModalParams,
} from '@onekeyhq/kit/src/views/Discovery/router/customInjectedModalRoutes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  CustomInjectedE2EStatusIcon,
  CustomInjectedE2EStatusIcons,
} from './CustomInjectedE2EStatusIcons';
import { CustomInjectedProtocolSourceIcon } from './CustomInjectedProtocolSourceIcon';
import {
  CUSTOM_INJECTED_REVIEW_STATE_CONFIG,
  CustomInjectedReviewStatusIcons,
} from './CustomInjectedReviewStatus';
import {
  CustomInjectedToolbarIconButton,
  CustomInjectedToolbarIconGroup,
} from './CustomInjectedToolbarIconGroup';

import type { ICustomInjectedE2EStatusKey } from './CustomInjectedE2EStatusIcons';
import type { ICustomInjectedManualReviewState } from './CustomInjectedReviewStatus';
import type { ICustomInjectedToolbarProps } from './CustomInjectedToolbar/types';

const RECORDING_PHASE_LABELS = {
  preparing: 'Preparing recording…',
  recording: 'Stop recording',
  stopping: 'Stopping recording…',
  saving: 'Saving recording…',
} as const;

const integer = new Intl.NumberFormat('en');

function isCommandModifiedPress(event: unknown) {
  if (!event || typeof event !== 'object') return false;
  const pressEvent = event as {
    metaKey?: unknown;
    nativeEvent?: { metaKey?: unknown };
  };
  return (
    pressEvent.metaKey === true || pressEvent.nativeEvent?.metaKey === true
  );
}

type IWorkflowTextColor =
  | '$textCaution'
  | '$textCritical'
  | '$textInfo'
  | '$textSubdued'
  | '$textSuccess';

export function WorkflowStepCard({
  action,
  active,
  detail,
  detailStatus,
  detailStatusColor,
  iconColor,
  number,
  onPress,
  status,
  statusIcon,
  statusIconActive,
  testID,
  title,
}: {
  action?: ReactNode;
  active: boolean;
  detail: string;
  detailStatus?: string;
  detailStatusColor?: IWorkflowTextColor;
  iconColor:
    | '$iconCaution'
    | '$iconCritical'
    | '$iconInfo'
    | '$iconSubdued'
    | '$iconSuccess';
  number: number;
  onPress?: () => void;
  status: string;
  statusIcon: ICustomInjectedE2EStatusKey;
  statusIconActive: boolean;
  testID?: string;
  title: string;
}) {
  let statusColor: IWorkflowTextColor = '$textSubdued';
  if (iconColor === '$iconCritical') {
    statusColor = '$textCritical';
  } else if (iconColor === '$iconCaution') {
    statusColor = '$textCaution';
  } else if (iconColor === '$iconInfo') {
    statusColor = '$textInfo';
  } else if (iconColor === '$iconSuccess') {
    statusColor = '$textSuccess';
  }
  return (
    <XStack
      alignItems="center"
      bg={active ? '$bgInfoSubdued' : '$bgStrong'}
      borderColor={active ? '$borderInfoSubdued' : '$borderSubdued'}
      borderRadius="$3"
      borderWidth={1}
      cursor={onPress ? 'pointer' : 'default'}
      flexShrink={0}
      gap="$2"
      height={60}
      hoverStyle={onPress ? { bg: '$bgHover' } : undefined}
      px="$2.5"
      py="$2"
      pressStyle={onPress ? { bg: '$bgActive' } : undefined}
      role={onPress ? 'button' : undefined}
      testID={testID}
      width={320}
      onPress={onPress}
    >
      <CustomInjectedE2EStatusIcon
        active={statusIconActive}
        compact
        status={statusIcon}
        testID={testID ? `${testID}-status-icon` : undefined}
      />
      <YStack flex={1} gap="$0.5" minWidth={0}>
        <XStack alignItems="center" gap="$1.5" minWidth={0}>
          <SizableText
            flex={1}
            minWidth={0}
            numberOfLines={1}
            size="$bodySmMedium"
          >
            {`${String(number)}. ${title}`}
          </SizableText>
          <SizableText
            color={statusColor}
            flexShrink={1}
            minWidth={0}
            numberOfLines={1}
            size="$bodySmMedium"
          >
            {status}
          </SizableText>
        </XStack>
        <XStack
          alignItems="center"
          gap="$1"
          minWidth={0}
          testID={testID ? `${testID}-description` : undefined}
        >
          <SizableText
            color="$textSubdued"
            flex={1}
            minWidth={0}
            numberOfLines={1}
            size="$bodyXs"
          >
            {detail}
          </SizableText>
          {detailStatus ? (
            <SizableText
              color={detailStatusColor || statusColor}
              flexShrink={0}
              size="$bodyXsMedium"
            >
              {detailStatus}
            </SizableText>
          ) : null}
        </XStack>
      </YStack>
      {action ? (
        <XStack alignItems="center" flexShrink={0}>
          {action}
        </XStack>
      ) : null}
    </XStack>
  );
}

export default function CustomInjectedToolbar({
  activeSession,
  sessionId,
  selectedProtocolId,
  activeBundleSha256,
  getCurrentWebViewUrl,
  recordingPhase,
  e2eGenerating = false,
  protocolRuntimeScope,
  protocolSwitchingLocked = false,
  onStartRecording,
  onStopRecording,
  onStopE2EGeneration,
  onPrepareE2EPass,
  onSelectProtocol,
  onReload,
}: ICustomInjectedToolbarProps) {
  const navigation =
    useAppNavigation<IPageNavigationProp<ICustomInjectedModalParamList>>();
  const [customSession, setCustomSession] =
    useState<ICustomInjectedSession>(activeSession);
  const [e2eState, setE2EState] = useState<ICustomInjectedE2EWorkflowState>();
  const [protocolE2EStates, setProtocolE2EStates] = useState<
    Record<string, ICustomInjectedE2EWorkflowSummary>
  >({});
  const protocolListFilter = useSyncExternalStore(
    subscribeCustomInjectedProtocolListFilter,
    getCustomInjectedProtocolListFilter,
    getCustomInjectedProtocolListFilter,
  );
  const [e2eRunning, setE2ERunning] = useState(false);
  const [e2eStopping, setE2EStopping] = useState(false);
  const [e2eGenerationStopping, setE2EGenerationStopping] = useState(false);
  const [e2eOutcome, setE2EOutcome] = useState<ICustomInjectedE2EOutcome>();
  const [reviewStateUpdating, setReviewStateUpdating] =
    useState<ICustomInjectedManualReviewState>();
  const [lastActionError, setLastActionError] = useState<string>();
  const operationLogCursorRef = useRef(
    getCustomInjectedOperationLogErrorAcknowledgedAt(sessionId),
  );
  const newOperationErrorKeysRef = useRef(new Set<string>());
  const protocolSelectionRequestRef = useRef(0);
  const [newOperationErrorCount, setNewOperationErrorCount] = useState(0);
  const isRuntimeCurrent = useCallback(
    () =>
      !protocolRuntimeScope ||
      isCustomInjectedProtocolRuntimeActive(protocolRuntimeScope),
    [protocolRuntimeScope],
  );

  useEffect(() => {
    protocolSelectionRequestRef.current += 1;
  }, [selectedProtocolId]);

  const refresh = useCallback(
    async (updateSession = true) => {
      const next =
        await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(
          sessionId,
        );
      if (updateSession) {
        setCustomSession(next);
      }
      return next;
    },
    [sessionId],
  );

  useEffect(() => {
    setCustomSession(activeSession);
  }, [activeSession]);

  useEffect(() => {
    setE2EOutcome(undefined);
  }, [selectedProtocolId]);

  useEffect(() => {
    let disposed = false;
    operationLogCursorRef.current =
      getCustomInjectedOperationLogErrorAcknowledgedAt(sessionId);
    newOperationErrorKeysRef.current.clear();
    setNewOperationErrorCount(0);

    const unsubscribe = subscribeCustomInjectedOperationLogErrorAcknowledgement(
      sessionId,
      (cursor) => {
        operationLogCursorRef.current = Math.max(
          operationLogCursorRef.current,
          cursor,
        );
        newOperationErrorKeysRef.current.clear();
        setNewOperationErrorCount(0);
      },
    );
    const refreshErrorCount = async () => {
      const webviewApi = globalThis.desktopApiProxy?.webview;
      if (
        typeof webviewApi?.getCustomInjectedRecentOperationLogs !== 'function'
      ) {
        return;
      }
      try {
        const records =
          await webviewApi.getCustomInjectedRecentOperationLogs(sessionId);
        if (disposed) return;
        const cursor = operationLogCursorRef.current;
        records.forEach((record) => {
          const timestamp = Date.parse(record.timestamp);
          if (
            Number.isFinite(timestamp) &&
            timestamp > cursor &&
            isCustomInjectedOperationLogError(record)
          ) {
            newOperationErrorKeysRef.current.add(
              `${record.timestamp}:${record.operationId}:${record.status}`,
            );
          }
        });
        setNewOperationErrorCount(newOperationErrorKeysRef.current.size);
      } catch {
        // The operation log badge is supplemental and should not interrupt the toolbar.
      }
    };

    const initializeErrorCount = async () => {
      const webviewApi = globalThis.desktopApiProxy?.webview;
      try {
        if (
          typeof webviewApi?.getCustomInjectedOperationLogAppStartedAt ===
          'function'
        ) {
          setCustomInjectedOperationLogAppStartedAt(
            await Promise.resolve(
              webviewApi.getCustomInjectedOperationLogAppStartedAt(),
            ),
          );
          if (disposed) return;
          operationLogCursorRef.current =
            getCustomInjectedOperationLogErrorAcknowledgedAt(sessionId);
        }
      } catch {
        // Fall back to the renderer start time if the desktop API is unavailable.
      }
      await refreshErrorCount();
    };

    void initializeErrorCount();
    const timer = setInterval(() => {
      void refreshErrorCount();
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
      unsubscribe();
    };
  }, [sessionId]);

  useEffect(() => {
    if (recordingPhase) {
      setE2EOutcome(undefined);
    }
  }, [recordingPhase]);

  useEffect(() => {
    if (!e2eGenerating) {
      setE2EGenerationStopping(false);
    }
  }, [e2eGenerating]);

  const refreshE2EState = useCallback(async () => {
    const next =
      await globalThis.desktopApiProxy.webview.getCustomInjectedE2EState(
        sessionId,
        selectedProtocolId,
      );
    if (isRuntimeCurrent()) {
      setE2EState(next);
    }
    return next;
  }, [isRuntimeCurrent, selectedProtocolId, sessionId]);

  useEffect(() => {
    let disposed = false;
    const refreshIfMounted = async () => {
      try {
        const next =
          await globalThis.desktopApiProxy.webview.getCustomInjectedE2EState(
            sessionId,
            selectedProtocolId,
          );
        if (!disposed) {
          setE2EState(next);
        }
      } catch {
        if (!disposed) {
          setE2EState(undefined);
        }
      }
    };
    void refreshIfMounted();
    const timer = setInterval(() => {
      void refreshIfMounted();
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [e2eGenerating, recordingPhase, selectedProtocolId, sessionId]);

  useEffect(() => {
    const hasE2EFilter = Object.keys(protocolListFilter.e2eFilter).length > 0;
    if (!hasE2EFilter) {
      setProtocolE2EStates({});
      return undefined;
    }
    let disposed = false;
    const refreshStates = async () => {
      const webviewApi = globalThis.desktopApiProxy?.webview;
      if (typeof webviewApi?.getCustomInjectedE2EStates !== 'function') return;
      try {
        const next = await webviewApi.getCustomInjectedE2EStates(sessionId);
        if (!disposed) setProtocolE2EStates(next);
      } catch {
        if (!disposed) setProtocolE2EStates({});
      }
    };
    void refreshStates();
    const timer = setInterval(() => {
      void refreshStates();
    }, 10_000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [
    e2eGenerating,
    e2eRunning,
    protocolListFilter.e2eFilter,
    recordingPhase,
    sessionId,
  ]);

  const selectedIndex = useMemo(
    () =>
      customSession?.protocols.findIndex(
        (protocol) =>
          protocol.key === selectedProtocolId ||
          protocol.id === selectedProtocolId,
      ) ?? -1,
    [customSession?.protocols, selectedProtocolId],
  );
  const selectedProtocol =
    selectedIndex >= 0 ? customSession?.protocols[selectedIndex] : undefined;
  const filteredProtocolRows = useMemo(
    () =>
      filterCustomInjectedProtocolRows({
        rows: createCustomInjectedProtocolFilterRows(
          customSession?.protocols ?? [],
        ),
        filter: protocolListFilter,
        e2eStates: protocolE2EStates,
      }),
    [customSession?.protocols, protocolE2EStates, protocolListFilter],
  );
  const filteredSelectedIndex = useMemo(
    () =>
      filteredProtocolRows.findIndex(
        ({ protocol }) => protocol.key === selectedProtocol?.key,
      ),
    [filteredProtocolRows, selectedProtocol?.key],
  );
  const bundleChanged =
    Boolean(customSession?.bundleSha256) &&
    customSession?.bundleSha256 !== activeBundleSha256;
  const reloadActionLabel = bundleChanged
    ? 'Apply updated injection bundle'
    : 'Reload DApp & injection';
  const reloadTooltip = `${reloadActionLabel} · ⌘-click for a clean session`;
  const recordingBusy = Boolean(recordingPhase) || e2eGenerating;
  const protocolControlsLocked =
    recordingBusy || e2eRunning || protocolSwitchingLocked;
  const recordingInProgress = recordingPhase === 'recording';
  const selectedHostname = useMemo(() => {
    try {
      return new URL(selectedProtocol?.url || '').hostname;
    } catch {
      return selectedProtocol?.url || '';
    }
  }, [selectedProtocol?.url]);

  const selectProtocol = useCallback(
    async (protocolId: string) => {
      if (protocolSwitchingLocked) return;
      const requestId = protocolSelectionRequestRef.current + 1;
      protocolSelectionRequestRef.current = requestId;
      try {
        const next = await refresh(false);
        if (
          protocolSelectionRequestRef.current !== requestId ||
          !isRuntimeCurrent()
        ) {
          return;
        }
        setCustomSession(next);
        const protocol = next.protocols.find(
          (candidate) =>
            candidate.key === protocolId || candidate.id === protocolId,
        );
        if (protocol) {
          onSelectProtocol(protocol, next);
          setLastActionError(undefined);
        } else {
          throw new OneKeyLocalError('Custom injection protocol not found');
        }
      } catch (error) {
        if (protocolSelectionRequestRef.current !== requestId) {
          return;
        }
        logCustomInjectedClientError({
          sessionId,
          protocolId,
          operation: 'protocol.select',
          error,
        });
        setLastActionError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [
      isRuntimeCurrent,
      onSelectProtocol,
      protocolSwitchingLocked,
      refresh,
      sessionId,
    ],
  );

  const selectFilteredAt = useCallback(
    (index: number) => {
      const protocol = filteredProtocolRows[index]?.protocol;
      if (protocol) {
        void selectProtocol(protocol.key);
      }
    },
    [filteredProtocolRows, selectProtocol],
  );

  const showProtocolList = useCallback(() => {
    if (!customSession || protocolSwitchingLocked) return;
    navigation.pushModal(
      EModalRoutes.DiscoveryModal,
      buildCustomInjectedModalParams(ECustomInjectedModalRoutes.ProtocolList, {
        sessionId: customSession.sessionId,
        selectedProtocolId,
      }),
    );
  }, [customSession, navigation, protocolSwitchingLocked, selectedProtocolId]);

  const editUrl = useCallback(() => {
    if (!customSession || !selectedProtocol || protocolSwitchingLocked) return;
    const currentWebViewUrl =
      getCurrentWebViewUrl()?.trim() || selectedProtocol.url;
    const editUrlDialogRef: {
      current: ReturnType<typeof Dialog.show> | undefined;
    } = { current: undefined };
    editUrlDialogRef.current = Dialog.show({
      title: `Edit ${selectedProtocol.name} URL`,
      onConfirmText: 'Save URL',
      renderContent: (
        <YStack gap="$3">
          <Dialog.Form
            formProps={{
              values: {
                url: currentWebViewUrl,
              },
            }}
          >
            <Dialog.FormField
              name="url"
              rules={{
                required: {
                  message: 'Enter an HTTPS dapp URL',
                  value: true,
                },
              }}
            >
              <Input
                autoFocus
                placeholder="https://app.example.com"
                testID="custom-injected-url-input"
              />
            </Dialog.FormField>
          </Dialog.Form>
          {selectedProtocol.registryUrl ? (
            <Button
              alignSelf="flex-start"
              size="small"
              testID="custom-injected-reset-url"
              variant="tertiary"
              onPress={() => {
                editUrlDialogRef.current
                  ?.getForm()
                  ?.setValue('url', selectedProtocol.registryUrl, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
              }}
            >
              {`Reset to ${
                selectedProtocol.source === 'defillama'
                  ? 'DeFiLlama'
                  : selectedProtocol.source
              } URL`}
            </Button>
          ) : null}
        </YStack>
      ),
      onConfirm: async ({ getForm }) => {
        try {
          if (!isRuntimeCurrent()) {
            throw new OneKeyLocalError('The active protocol changed');
          }
          const url = String(getForm()?.getValues('url') || '').trim();
          const next =
            await globalThis.desktopApiProxy.webview.updateCustomInjectedProtocol(
              {
                action: 'set-url',
                sessionId,
                protocolId: selectedProtocol.key,
                expectedRegistrySha256: selectedProtocol.registrySha256,
                url,
              },
            );
          if (!isRuntimeCurrent()) {
            throw new OneKeyLocalError('The active protocol changed');
          }
          setCustomSession(next);
          const updated = next.protocols.find(
            (protocol) => protocol.key === selectedProtocol.key,
          );
          if (updated) {
            onSelectProtocol(updated, next);
          }
          setLastActionError(undefined);
        } catch (error) {
          logCustomInjectedClientError({
            sessionId,
            protocolId: selectedProtocol.key,
            operation: 'protocol.update',
            error,
          });
          setLastActionError(
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      },
    });
  }, [
    customSession,
    getCurrentWebViewUrl,
    isRuntimeCurrent,
    onSelectProtocol,
    protocolSwitchingLocked,
    selectedProtocol,
    sessionId,
  ]);

  const setReviewState = useCallback(
    async (state: ICustomInjectedManualReviewState) => {
      if (!customSession || !selectedProtocol) return false;
      if (state === selectedProtocol.manualReview.state) return true;
      setReviewStateUpdating(state);
      try {
        if (!isRuntimeCurrent()) return false;
        const next =
          await globalThis.desktopApiProxy.webview.updateCustomInjectedProtocol(
            {
              action: 'set-review',
              sessionId,
              protocolId: selectedProtocol.key,
              expectedRegistrySha256: selectedProtocol.registrySha256,
              state,
            },
          );
        if (!isRuntimeCurrent()) return false;
        setCustomSession(next);
        setActiveCustomInjectedWorkspace(next);
        setLastActionError(undefined);
        return true;
      } catch (error) {
        setLastActionError(
          error instanceof Error ? error.message : String(error),
        );
        return false;
      } finally {
        setReviewStateUpdating(undefined);
      }
    },
    [customSession, isRuntimeCurrent, selectedProtocol, sessionId],
  );

  const reload = useCallback(async () => {
    const operationId = stringUtils.generateUUID();
    const startedAt = Date.now();
    logCustomInjectedClientOperation({
      sessionId,
      protocolId: selectedProtocolId,
      operationId,
      operation: 'dapp.reload',
      status: 'start',
    });
    try {
      const next = await refresh();
      if (!isRuntimeCurrent()) return;
      onReload(next, selectedProtocolId);
      logCustomInjectedClientOperation({
        sessionId,
        protocolId: selectedProtocolId,
        operationId,
        operation: 'dapp.reload',
        status: 'result',
        durationMs: Date.now() - startedAt,
        result: { bundleSha256: next.bundleSha256 },
      });
      setLastActionError(undefined);
    } catch (error) {
      logCustomInjectedClientOperation({
        sessionId,
        protocolId: selectedProtocolId,
        operationId,
        operation: 'dapp.reload',
        status: 'error',
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      setLastActionError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [isRuntimeCurrent, onReload, refresh, selectedProtocolId, sessionId]);

  const validateE2E = useCallback(async () => {
    if (
      !customSession ||
      !selectedProtocol ||
      !e2eState?.canValidate ||
      e2eRunning
    )
      return;
    if (protocolRuntimeScope && !isRuntimeCurrent()) return;
    let selectionLock:
      | ReturnType<typeof acquireCustomInjectedProtocolSelectionLock>
      | undefined;
    setE2ERunning(true);
    setE2EOutcome(undefined);
    try {
      if (protocolRuntimeScope) {
        selectionLock = acquireCustomInjectedProtocolSelectionLock({
          reason: 'E2E validation',
          sessionId,
        });
        const ready =
          await waitForCustomInjectedProtocolRuntimeReady(protocolRuntimeScope);
        if (!ready || !isRuntimeCurrent()) {
          throw new OneKeyLocalError(
            'The protocol page was replaced before E2E validation started',
          );
        }
      }
      const cleanSessionReady = await onPrepareE2EPass();
      if (!cleanSessionReady || (protocolRuntimeScope && !isRuntimeCurrent())) {
        throw new OneKeyLocalError(
          'Unable to prepare a fresh WebView for E2E validation',
        );
      }
      const pendingSession =
        await globalThis.desktopApiProxy.webview.prepareCustomInjectedE2EValidation(
          sessionId,
          selectedProtocol.key,
        );
      if (!isRuntimeCurrent()) return;
      setCustomSession(pendingSession);
      setActiveCustomInjectedWorkspace(pendingSession);
      const outcome =
        await globalThis.desktopApiProxy.webview.runCustomInjectedE2E(
          sessionId,
          selectedProtocolId,
        );
      if (!isRuntimeCurrent()) return;
      if (!outcome.ok) {
        if (outcome.cancelled) {
          setE2EOutcome(undefined);
          setLastActionError(undefined);
          await refreshE2EState();
          return;
        }
        setE2EOutcome({
          passed: false,
          text: 'Validation error',
          errorLog: outcome.log,
        });
        setLastActionError(outcome.error);
        return;
      }
      const { log, result } = outcome;
      if (result.passed) {
        const attemptSummary = `attempt ${String(result.passes.length)} of ${String(
          result.maximumAttempts,
        )}`;
        setE2EOutcome({
          passed: true,
          text: `Passed · ${attemptSummary}`,
        });
        setLastActionError(undefined);
      } else {
        const attemptSummary = `${String(result.passes.length)} ${
          result.passes.length === 1 ? 'attempt' : 'attempts'
        }`;
        setE2EOutcome({
          passed: false,
          text: `Failed after ${attemptSummary}`,
          errorLog: log,
        });
        setLastActionError(`E2E failed after ${attemptSummary}`);
      }
      await refreshE2EState();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logCustomInjectedClientError({
        sessionId,
        protocolId: selectedProtocolId,
        operation: 'e2e.validate.orchestrate',
        error,
      });
      setE2EOutcome({
        passed: false,
        text: 'Validation error',
        errorLog: detail,
      });
      setLastActionError(detail);
    } finally {
      selectionLock?.release();
      setE2EStopping(false);
      setE2ERunning(false);
    }
  }, [
    customSession,
    e2eRunning,
    e2eState?.canValidate,
    isRuntimeCurrent,
    onPrepareE2EPass,
    protocolRuntimeScope,
    refreshE2EState,
    selectedProtocol,
    selectedProtocolId,
    sessionId,
  ]);

  const stopE2E = useCallback(() => {
    if (!e2eRunning || e2eStopping) return;
    Dialog.show({
      title: 'Stop E2E validation?',
      description:
        'The current clean-session validation will be terminated. You can run it again later.',
      tone: 'destructive',
      onConfirmText: 'Stop validation',
      onConfirm: async () => {
        setE2EStopping(true);
        try {
          const result =
            await globalThis.desktopApiProxy.webview.stopCustomInjectedE2E(
              sessionId,
              selectedProtocolId,
            );
          if (!result.stopped) {
            setLastActionError('E2E validation was no longer running');
            setE2EStopping(false);
          }
        } catch (error) {
          setLastActionError(
            error instanceof Error ? error.message : String(error),
          );
          setE2EStopping(false);
        }
      },
    });
  }, [e2eRunning, e2eStopping, selectedProtocolId, sessionId]);

  const stopE2EGeneration = useCallback(() => {
    if (!e2eGenerating || e2eGenerationStopping || !onStopE2EGeneration) {
      return;
    }
    Dialog.show({
      title: 'Stop E2E generation?',
      description:
        'The current recording-to-E2E generation and clean-session validation will be terminated. The previous E2E will remain unchanged.',
      tone: 'destructive',
      onConfirmText: 'Stop generation',
      onConfirm: async () => {
        setE2EGenerationStopping(true);
        try {
          const result = await onStopE2EGeneration();
          if (!result.stopped) {
            setLastActionError('E2E generation was no longer running');
            setE2EGenerationStopping(false);
          }
        } catch (error) {
          setLastActionError(
            error instanceof Error ? error.message : String(error),
          );
          setE2EGenerationStopping(false);
        }
      },
    });
  }, [e2eGenerating, e2eGenerationStopping, onStopE2EGeneration]);

  useEffect(() => {
    if (!selectedProtocol || !protocolRuntimeScope) return undefined;
    return setCustomInjectedE2EWorkflowActions({
      instanceKey: protocolRuntimeScope.instanceKey,
      protocolId: selectedProtocol.key,
      sessionId,
      startRecording: onStartRecording,
      stopRecording: onStopRecording,
      e2eGenerating,
      stopE2EGeneration,
      e2eRunning,
      stopE2E,
      validateE2E,
    });
  }, [
    onStartRecording,
    onStopRecording,
    protocolRuntimeScope,
    selectedProtocol,
    sessionId,
    e2eGenerating,
    stopE2EGeneration,
    e2eRunning,
    stopE2E,
    validateE2E,
  ]);

  if (!customSession || !selectedProtocol) {
    return null;
  }

  const hasRecording = Boolean(e2eState?.recording);
  const hasCurrentE2E = Boolean(e2eState?.e2e?.current);
  const needsE2EGeneration = hasRecording && !hasCurrentE2E;
  const persistedValidation = e2eState?.validation?.current
    ? e2eState.validation
    : undefined;
  const validationCompleted = Boolean(e2eOutcome || persistedValidation);

  let recordingButtonLabel = 'Record';
  if (recordingPhase) {
    recordingButtonLabel = RECORDING_PHASE_LABELS[recordingPhase];
  } else if (hasRecording) {
    recordingButtonLabel = 'Re-record';
  }

  let generateStatusText = 'Waiting for recording';
  const generateDetailText = 'e2e.mjs';
  let generateStatusColor:
    | '$iconCaution'
    | '$iconCritical'
    | '$iconInfo'
    | '$iconSubdued'
    | '$iconSuccess' = '$iconSubdued';
  if (e2eGenerating) {
    generateStatusText = 'Generating…';
    generateStatusColor = '$iconInfo';
  } else if (!e2eState) {
    generateStatusText = 'Checking files…';
  } else if (hasCurrentE2E) {
    generateStatusText = 'Generated';
    generateStatusColor = '$iconCaution';
  } else if (needsE2EGeneration) {
    generateStatusText = 'Re-record required';
    generateStatusColor = '$iconCritical';
  }

  let validationButtonLabel = 'Validate';
  if (e2eRunning) {
    validationButtonLabel = e2eStopping ? 'Stopping…' : 'Stop validation';
  } else if (validationCompleted) {
    validationButtonLabel = 'Run again';
  }

  let currentWorkflowStep = 1;
  let currentWorkflowTitle = 'Record';
  let currentWorkflowStatus = e2eState ? 'Ready' : 'Checking files…';
  if (recordingPhase === 'preparing') {
    currentWorkflowStatus = 'Preparing…';
  } else if (recordingPhase === 'recording') {
    currentWorkflowStatus = 'Recording…';
  } else if (recordingPhase === 'stopping') {
    currentWorkflowStatus = 'Stopping…';
  } else if (recordingPhase === 'saving') {
    currentWorkflowStatus = 'Saving…';
  } else if (e2eGenerating) {
    currentWorkflowStep = 2;
    currentWorkflowTitle = 'Generate E2E';
    currentWorkflowStatus = 'Generating…';
  } else if (needsE2EGeneration) {
    currentWorkflowStep = 2;
    currentWorkflowTitle = 'Generate E2E';
    currentWorkflowStatus = 'Automatic generation failed';
  } else if (hasCurrentE2E) {
    currentWorkflowStep = 3;
    currentWorkflowTitle = 'Validate E2E';
    currentWorkflowStatus = 'Ready';
    if (e2eRunning) {
      currentWorkflowStatus = 'Validating…';
    } else if (persistedValidation) {
      currentWorkflowStatus = persistedValidation.passed ? 'Passed' : 'Failed';
    }
  }
  if (e2eOutcome) {
    currentWorkflowStep = 3;
    currentWorkflowTitle = 'Validate E2E';
    currentWorkflowStatus = e2eOutcome.passed ? 'Passed' : 'Failed';
  }

  let recordingDialogStatus = 'Ready';
  const recordingDialogDetail = 'recording.json';
  let recordingDialogIconColor: '$iconInfo' | '$iconSubdued' | '$iconSuccess' =
    '$iconInfo';
  if (recordingPhase) {
    recordingDialogStatus = currentWorkflowStatus;
  } else if (e2eState?.recording) {
    recordingDialogStatus = 'Recorded';
    recordingDialogIconColor = '$iconSuccess';
  }

  let validationDialogStatus = 'Waiting for E2E';
  let validationDialogDetail = 'Complete step 2 first';
  let validationDialogIconColor:
    | '$iconCritical'
    | '$iconInfo'
    | '$iconSubdued'
    | '$iconSuccess' = '$iconSubdued';
  if (e2eRunning) {
    validationDialogStatus = 'Validating…';
    validationDialogDetail = 'Running up to 5 clean sessions';
    validationDialogIconColor = '$iconInfo';
  } else if (e2eOutcome) {
    validationDialogStatus = e2eOutcome.passed ? 'Passed' : 'Failed';
    validationDialogDetail = e2eOutcome.passed
      ? e2eOutcome.text
      : 'Open workflow to view error details';
    validationDialogIconColor = e2eOutcome.passed
      ? '$iconSuccess'
      : '$iconCritical';
  } else if (persistedValidation) {
    validationDialogStatus = persistedValidation.passed ? 'Passed' : 'Failed';
    validationDialogDetail = persistedValidation.passed
      ? 'Latest validation passed'
      : 'Latest validation failed';
    validationDialogIconColor = persistedValidation.passed
      ? '$iconSuccess'
      : '$iconCritical';
  } else if (e2eState?.canValidate) {
    validationDialogStatus = 'Ready';
    validationDialogDetail = 'Latest e2e.mjs ready';
    validationDialogIconColor = '$iconInfo';
  }

  let currentStepDetail = recordingDialogDetail;
  let currentStepStatus = recordingDialogStatus;
  let currentStepStatusIcon: ICustomInjectedE2EStatusKey = 'recorded';
  let currentStepStatusIconActive = hasRecording;
  let currentStepIconColor:
    | '$iconCaution'
    | '$iconCritical'
    | '$iconInfo'
    | '$iconSubdued'
    | '$iconSuccess' = recordingDialogIconColor;
  if (currentWorkflowStep === 2) {
    currentStepDetail = generateDetailText;
    currentStepStatus = generateStatusText;
    currentStepStatusIcon = 'generated';
    currentStepStatusIconActive = hasCurrentE2E;
    currentStepIconColor = generateStatusColor;
  } else if (currentWorkflowStep === 3) {
    currentStepDetail = validationDialogDetail;
    currentStepStatus = validationDialogStatus;
    currentStepStatusIcon = 'validated';
    currentStepStatusIconActive = e2eOutcome
      ? e2eOutcome.passed
      : Boolean(persistedValidation?.passed);
    currentStepIconColor = validationDialogIconColor;
  }

  const renderRecordingAction = (beforeAction?: () => void) => (
    <CustomInjectedToolbarIconButton
      aria-label={recordingButtonLabel}
      bg={recordingInProgress ? '$bgCritical' : '$bgStrong'}
      disabled={
        protocolSwitchingLocked ||
        e2eGenerating ||
        Boolean(recordingPhase && recordingPhase !== 'recording')
      }
      icon={recordingInProgress ? 'StopCircleSolid' : 'RecordCircleOutline'}
      loading={Boolean(recordingPhase && !recordingInProgress)}
      testID="custom-injected-recording"
      title={recordingButtonLabel}
      variant={recordingInProgress ? 'destructive' : 'secondary'}
      onPress={() => {
        beforeAction?.();
        if (recordingInProgress) {
          onStopRecording();
        } else {
          onStartRecording();
        }
      }}
    />
  );

  const renderValidationAction = (beforeAction?: () => void) =>
    e2eState?.canValidate ? (
      <CustomInjectedToolbarIconButton
        aria-label={validationButtonLabel}
        bg={e2eRunning ? '$bgCriticalSubdued' : '$bgStrong'}
        disabled={e2eStopping || (protocolControlsLocked && !e2eRunning)}
        icon={e2eRunning ? 'StopCircleSolid' : 'PlayCircleOutline'}
        iconProps={e2eRunning ? { color: '$iconCritical' } : undefined}
        overlay={
          e2eRunning ? (
            <Spinner
              color="$iconCritical"
              pointerEvents="none"
              position="absolute"
              size="large"
              testID="custom-injected-e2e-stop-spinner"
            />
          ) : undefined
        }
        testID="custom-injected-e2e-validate"
        title={validationButtonLabel}
        onPress={() => {
          beforeAction?.();
          if (e2eRunning) {
            stopE2E();
          } else {
            void validateE2E();
          }
        }}
      />
    ) : undefined;

  const renderGenerationAction = (beforeAction?: () => void) =>
    e2eGenerating ? (
      <CustomInjectedToolbarIconButton
        aria-label={e2eGenerationStopping ? 'Stopping…' : 'Stop E2E generation'}
        bg="$bgCriticalSubdued"
        disabled={e2eGenerationStopping || !onStopE2EGeneration}
        icon="StopCircleSolid"
        iconProps={{ color: '$iconCritical' }}
        overlay={
          <Spinner
            color="$iconCritical"
            pointerEvents="none"
            position="absolute"
            size="large"
            testID="custom-injected-e2e-generation-stop-spinner"
          />
        }
        testID="custom-injected-e2e-generation-stop"
        title={e2eGenerationStopping ? 'Stopping…' : 'Stop generation'}
        onPress={() => {
          beforeAction?.();
          stopE2EGeneration();
        }}
      />
    ) : undefined;

  let currentWorkflowAction = renderValidationAction();
  if (currentWorkflowStep === 1) {
    currentWorkflowAction = renderRecordingAction();
  } else if (currentWorkflowStep === 2) {
    currentWorkflowAction = renderGenerationAction();
  }

  const showE2EWorkflow = () => {
    const operationId = stringUtils.generateUUID();
    const startedAt = Date.now();
    logCustomInjectedClientOperation({
      sessionId,
      protocolId: selectedProtocol.key,
      operationId,
      operation: 'workflow.open',
      status: 'start',
    });
    try {
      navigation.pushModal(
        EModalRoutes.DiscoveryModal,
        buildCustomInjectedModalParams(ECustomInjectedModalRoutes.E2EWorkflow, {
          sessionId,
          protocolId: selectedProtocol.key,
          protocolName: selectedProtocol.name,
          recordingPhase,
          e2eOutcome,
        }),
      );
      logCustomInjectedClientOperation({
        sessionId,
        protocolId: selectedProtocol.key,
        operationId,
        operation: 'workflow.open',
        status: 'result',
        durationMs: Date.now() - startedAt,
        result: { modalOpened: true },
      });
    } catch (error) {
      logCustomInjectedClientOperation({
        sessionId,
        protocolId: selectedProtocol.key,
        operationId,
        operation: 'workflow.open',
        status: 'error',
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const showOperationLogs = () => {
    navigation.pushModal(
      EModalRoutes.DiscoveryModal,
      buildCustomInjectedModalParams(ECustomInjectedModalRoutes.OperationLogs, {
        sessionId,
      }),
    );
  };

  return (
    <XStack
      alignItems="center"
      animation="quick"
      bg={
        CUSTOM_INJECTED_REVIEW_STATE_CONFIG[selectedProtocol.manualReview.state]
          .backgroundColor
      }
      borderTopColor="$borderSubdued"
      borderTopWidth={1}
      gap="$1.5"
      px="$2"
      py="$1.5"
      testID="custom-injected-toolbar"
      zIndex={10}
    >
      <YStack flex={1} gap="$0.5" minWidth={0}>
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <CustomInjectedProtocolSourceIcon
            size={16}
            source={selectedProtocol.source}
          />
          <SizableText flexShrink={1} numberOfLines={1} size="$bodySmMedium">
            {selectedProtocol.name}
          </SizableText>
        </XStack>
        <XStack alignItems="center" gap="$1" minWidth={0}>
          <SizableText
            color="$textSubdued"
            flexShrink={1}
            numberOfLines={1}
            size="$bodyXs"
          >
            {selectedHostname}
          </SizableText>
          {selectedProtocol.urlSource === 'override' ? (
            <Tooltip
              renderContent="Custom URL override"
              renderTrigger={
                <Icon color="$iconInfo" name="LayerBehindOutline" size="$3.5" />
              }
            />
          ) : null}
          <IconButton
            aria-label="Edit protocol URL"
            disabled={protocolControlsLocked}
            h="$7"
            icon="PencilOutline"
            iconSize={22}
            size="small"
            testID="custom-injected-edit-url"
            title="Edit protocol URL"
            variant="tertiary"
            w="$7"
            onPress={editUrl}
          />
        </XStack>
      </YStack>
      <Stack bg="$borderSubdued" flexShrink={0} h="$5" w="$px" />
      <CustomInjectedToolbarIconGroup testID="custom-injected-toolbar-navigation">
        <CustomInjectedToolbarIconButton
          aria-label="All protocols"
          disabled={protocolControlsLocked}
          icon="BulletListOutline"
          testID="custom-injected-protocol-list"
          title="All protocols"
          onPress={showProtocolList}
        />
        <CustomInjectedToolbarIconButton
          aria-label="Previous protocol"
          disabled={
            protocolControlsLocked ||
            !filteredProtocolRows.length ||
            filteredSelectedIndex === 0
          }
          icon="ChevronLeftSmallOutline"
          testID="custom-injected-previous"
          title="Previous protocol"
          onPress={() =>
            selectFilteredAt(
              filteredSelectedIndex < 0
                ? filteredProtocolRows.length - 1
                : filteredSelectedIndex - 1,
            )
          }
        />
        <SizableText
          color="$textSubdued"
          minWidth={96}
          size="$bodySmMedium"
          textAlign="center"
          testID="custom-injected-toolbar-position"
        >
          {`${
            filteredSelectedIndex >= 0
              ? integer.format(filteredSelectedIndex + 1)
              : '–'
          } / ${integer.format(filteredProtocolRows.length)}`}
        </SizableText>
        <CustomInjectedToolbarIconButton
          aria-label="Next protocol"
          disabled={
            protocolControlsLocked ||
            !filteredProtocolRows.length ||
            filteredSelectedIndex === filteredProtocolRows.length - 1
          }
          icon="ChevronRightSmallOutline"
          testID="custom-injected-next"
          title="Next protocol"
          onPress={() =>
            selectFilteredAt(
              filteredSelectedIndex < 0 ? 0 : filteredSelectedIndex + 1,
            )
          }
        />
      </CustomInjectedToolbarIconGroup>
      <CustomInjectedToolbarIconGroup testID="custom-injected-toolbar-utilities">
        <CustomInjectedToolbarIconButton
          aria-label={`${reloadActionLabel}. Command-click for a clean session`}
          disabled={protocolControlsLocked}
          icon="RefreshCwOutline"
          iconProps={bundleChanged ? { color: '$iconInfo' } : undefined}
          testID="custom-injected-reload"
          title={reloadTooltip}
          onPress={(event) => {
            if (isCommandModifiedPress(event)) {
              void onPrepareE2EPass();
            } else {
              void reload();
            }
          }}
        />
        <CustomInjectedToolbarIconButton
          aria-label={
            newOperationErrorCount
              ? `View operation logs · ${String(newOperationErrorCount)} new errors`
              : 'View operation logs'
          }
          icon="FileTextOutline"
          overlay={
            newOperationErrorCount ? (
              <XStack
                alignItems="center"
                bg="$bgCriticalStrong"
                borderColor="$bgStrong"
                borderRadius="$full"
                borderWidth={2}
                h="$5"
                justifyContent="center"
                minWidth="$5"
                pointerEvents="none"
                position="absolute"
                px="$1"
                right="$-1"
                testID="custom-injected-operation-logs-error-badge"
                top="$-1"
                zIndex={1}
              >
                <SizableText color="$textOnColor" size="$bodyXsMedium">
                  {String(newOperationErrorCount)}
                </SizableText>
              </XStack>
            ) : undefined
          }
          testID="custom-injected-operation-logs-button"
          title={
            newOperationErrorCount
              ? `${String(newOperationErrorCount)} new errors · View logs`
              : 'View operation logs'
          }
          onPress={showOperationLogs}
        />
      </CustomInjectedToolbarIconGroup>
      <CustomInjectedReviewStatusIcons
        disabled={protocolControlsLocked || Boolean(reviewStateUpdating)}
        state={selectedProtocol.manualReview.state}
        updatingState={reviewStateUpdating}
        onChange={(state) => {
          void setReviewState(state);
        }}
      />
      <Stack bg="$borderSubdued" flexShrink={0} h="$5" w="$px" />
      <CustomInjectedE2EStatusIcons
        adapter={Boolean(e2eState?.adapter)}
        generated={Boolean(e2eState?.e2e?.current)}
        recorded={Boolean(e2eState?.recording)}
        testID="custom-injected-toolbar-e2e-statuses"
        validated={Boolean(
          e2eState?.validation?.current && e2eState.validation.passed,
        )}
      />
      <Stack bg="$borderSubdued" flexShrink={0} h="$5" w="$px" />
      {lastActionError ? (
        <Tooltip
          renderContent={lastActionError}
          renderTrigger={
            <Icon
              color="$iconCritical"
              name="ErrorOutline"
              size="$5"
              testID="custom-injected-last-action-error"
            />
          }
        />
      ) : null}
      <WorkflowStepCard
        action={currentWorkflowAction}
        active
        detail={currentStepDetail}
        iconColor={currentStepIconColor}
        number={currentWorkflowStep}
        status={currentStepStatus}
        statusIcon={currentStepStatusIcon}
        statusIconActive={currentStepStatusIconActive}
        testID="custom-injected-e2e-workflow-summary"
        title={currentWorkflowTitle}
        onPress={showE2EWorkflow}
      />
      <Button
        disabled={Boolean(recordingPhase)}
        display="none"
        testID="custom-injected-e2e-reset"
        onPress={(event) => {
          const element =
            (event as { currentTarget?: HTMLElement } | undefined)
              ?.currentTarget ||
            document.querySelector<HTMLElement>(
              '[data-testid="custom-injected-e2e-reset"]',
            );
          const mode = element?.getAttribute('data-adapter-mode');
          const token = element?.getAttribute('data-adapter-token');
          return onPrepareE2EPass(
            (mode === 'enabled' || mode === 'disabled') && token
              ? { mode, token }
              : undefined,
          );
        }}
      >
        Prepare clean E2E pass
      </Button>
    </XStack>
  );
}

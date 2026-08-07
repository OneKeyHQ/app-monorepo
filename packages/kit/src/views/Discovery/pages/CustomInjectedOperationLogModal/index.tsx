import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Button,
  Icon,
  IconButton,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  getCustomInjectedOperationLogVisibleAfter,
  setCustomInjectedOperationLogAppStartedAt,
  setCustomInjectedOperationLogVisibleAfter,
} from '@onekeyhq/kit/src/utils/customInjectedOperationLogRuntime';
import type { ICustomInjectedOperationLogRecord } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import type {
  EDiscoveryModalRoutes,
  IDiscoveryModalParamList,
} from '@onekeyhq/shared/src/routes/discovery.desktop';

import type { RouteProp } from '@react-navigation/core';

const LOG_LEVEL_CONFIG = {
  error: {
    backgroundColor: '$bgCriticalSubdued',
    borderColor: '$borderCritical',
    icon: 'XCircleSolid',
    iconColor: '$iconCritical',
    label: 'Error',
    textColor: '$textCritical',
  },
  info: {
    backgroundColor: '$bgInfoSubdued',
    borderColor: '$borderInfo',
    icon: 'InfoCircleSolid',
    iconColor: '$iconInfo',
    label: 'Info',
    textColor: '$textInfo',
  },
  success: {
    backgroundColor: '$bgSuccessSubdued',
    borderColor: '$borderSuccess',
    icon: 'CheckRadioSolid',
    iconColor: '$iconSuccess',
    label: 'Success',
    textColor: '$textSuccess',
  },
} as const;

type ILogLevel = keyof typeof LOG_LEVEL_CONFIG;

const LOG_FILTER_ORDER: ILogLevel[] = ['info', 'success', 'error'];

const OPERATION_LABELS: Record<string, string> = {
  'auto-review.process': 'Auto review',
  'dapp-directory.open': 'Open DApp directory',
  'dapp-directory.resolve': 'Resolve DApp directory',
  'dapp.reload': 'Reload DApp',
  'e2e.batch.validate': 'Validate pending E2Es',
  'e2e.clean-session.prepare': 'Prepare clean E2E session',
  'e2e.generate': 'Generate E2E',
  'e2e.generate.prepare': 'Prepare E2E generation',
  'e2e.runtime.restore': 'Restore protocol runtime',
  'e2e.state.read': 'Read E2E state',
  'e2e.states.read': 'Read E2E states',
  'e2e.validate': 'Validate E2E',
  'e2e.validate.orchestrate': 'Prepare E2E validation',
  'e2e.validate.prepare': 'Reset E2E review state',
  'e2e.validate.stop': 'Stop E2E validation',
  'protocol.redirect': 'Protocol redirect',
  'protocol.redirect.update': 'Update redirected URL',
  'protocol.select': 'Select protocol',
  'protocol.update': 'Update protocol',
  'protocols.refresh': 'Refresh protocols',
  'recording.recorder': 'Recording session',
  'recording.save': 'Save recording',
  'recording.start': 'Start recording',
  'recording.stop': 'Stop recording',
  'webview.devtools.toggle': 'Toggle WebView DevTools',
  'webview.url.read': 'Read WebView URL',
  'workflow.open': 'Open E2E workflow',
  'workspace.activate': 'Activate workspace',
  'workspace.close': 'Close workspace',
  'workspace.prepare': 'Prepare workspace',
  'workspace.progress.persist': 'Save Workbench progress',
  'workspace.read': 'Read workspace',
  'workspace.select': 'Select workspace',
  'workspace.settings.apply': 'Apply Workbench settings',
  'workspace.settings.select': 'Select Workbench workspace',
};

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
});

function objectField(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}

function isVisibleRecord(record: ICustomInjectedOperationLogRecord): boolean {
  return !record.operation.startsWith('logs.');
}

function coreMessage(record: ICustomInjectedOperationLogRecord): string {
  if (record.status === 'start') return '';
  if (record.status === 'error') {
    const message = objectField(record.error, 'message');
    return typeof message === 'string' && message ? message : 'Failed';
  }
  const message = objectField(record.result, 'message');
  if (typeof message === 'string' && message) return message;
  const relativeFile = objectField(record.result, 'relativeFile');
  if (typeof relativeFile === 'string' && relativeFile) {
    return `Completed · ${relativeFile}`;
  }
  const passed = objectField(record.result, 'passed');
  if (typeof passed === 'boolean') {
    return passed ? 'Validation passed' : 'Validation failed';
  }
  const state = objectField(record.result, 'state');
  if (typeof state === 'string' && state) return `State · ${state}`;
  const recordCount = objectField(record.result, 'recordCount');
  if (typeof recordCount === 'number') {
    return `Loaded ${String(recordCount)} records`;
  }
  const updated = objectField(record.result, 'updated');
  if (typeof updated === 'boolean') {
    return updated ? 'Update applied' : 'No update required';
  }
  return '';
}

function getLogLevel(record: ICustomInjectedOperationLogRecord): ILogLevel {
  if (
    record.status === 'error' ||
    (record.status === 'result' &&
      objectField(record.result, 'passed') === false)
  ) {
    return 'error';
  }
  return record.status === 'start' ? 'info' : 'success';
}

function emptyResultsMessage(loading: boolean, hasRecords: boolean): string {
  if (loading) return 'Loading…';
  if (hasRecords) return 'No matches.';
  return 'No new logs.';
}

function isAfterCursor(
  record: ICustomInjectedOperationLogRecord,
  cursor: number,
): boolean {
  const timestamp = Date.parse(record.timestamp);
  return Number.isFinite(timestamp) && timestamp > cursor;
}

function LogRecordCard({
  record,
}: {
  record: ICustomInjectedOperationLogRecord;
}) {
  const [expanded, setExpanded] = useState(false);
  const logLevel = getLogLevel(record);
  const levelConfig = LOG_LEVEL_CONFIG[logLevel];
  const message = coreMessage(record);
  const timestamp = new Date(record.timestamp);
  const formattedTimestamp = Number.isNaN(timestamp.getTime())
    ? record.timestamp
    : dateTimeFormat.format(timestamp);
  return (
    <YStack
      backgroundColor={levelConfig.backgroundColor}
      borderColor="$borderSubdued"
      borderRadius="$2"
      borderWidth={1}
      gap="$0.5"
      px="$2"
      py="$1"
      testID={`custom-injected-operation-log-${record.operationId}-${logLevel}`}
    >
      <XStack
        aria-expanded={expanded}
        alignItems="center"
        cursor="pointer"
        gap="$1.5"
        hoverStyle={{ opacity: 0.8 }}
        role="button"
        testID={`custom-injected-operation-log-${record.operationId}-${logLevel}-toggle`}
        onPress={() => setExpanded((value) => !value)}
      >
        <Icon
          color={levelConfig.iconColor}
          name={levelConfig.icon}
          size="$3.5"
        />
        <SizableText
          color="$textSubdued"
          flexShrink={0}
          fontFamily="$monoRegular"
          size="$bodyXs"
        >
          {formattedTimestamp}
        </SizableText>
        <SizableText
          flexShrink={0}
          maxWidth={176}
          numberOfLines={1}
          size="$bodySmMedium"
        >
          {OPERATION_LABELS[record.operation] || record.operation}
        </SizableText>
        {message ? (
          <SizableText
            color="$text"
            flex={1}
            minWidth={0}
            numberOfLines={1}
            selectable
            size="$bodyXs"
          >
            {message}
          </SizableText>
        ) : (
          <XStack flex={1} />
        )}
        {record.protocol ? (
          <SizableText
            color="$textSubdued"
            maxWidth={120}
            numberOfLines={1}
            size="$bodyXs"
          >
            {record.protocol.name}
          </SizableText>
        ) : null}
        {record.durationMs !== null && record.durationMs !== undefined ? (
          <SizableText color="$textSubdued" size="$bodyXs">
            {`${String(record.durationMs)} ms`}
          </SizableText>
        ) : null}
        <Icon
          color="$iconSubdued"
          name={expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$3.5"
        />
      </XStack>
      {expanded ? (
        <ScrollView
          borderColor="$borderSubdued"
          borderTopWidth={1}
          maxHeight={320}
          mt="$1"
          pt="$1.5"
          testID={`custom-injected-operation-log-${record.operationId}-${logLevel}-details`}
        >
          <SizableText
            color="$textSubdued"
            fontFamily="$monoRegular"
            selectable
            size="$bodyXs"
            whiteSpace="pre-wrap"
          >
            {JSON.stringify(record, null, 2)}
          </SizableText>
        </ScrollView>
      ) : null}
    </YStack>
  );
}

export default function CustomInjectedOperationLogModal() {
  const route =
    useRoute<
      RouteProp<
        IDiscoveryModalParamList,
        EDiscoveryModalRoutes.CustomInjectedOperationLogs
      >
    >();
  const { sessionId } = route.params;
  const [records, setRecords] = useState<ICustomInjectedOperationLogRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [openingLog, setOpeningLog] = useState(false);
  const [error, setError] = useState<string>();
  const [levelFilter, setLevelFilter] = useState<ILogLevel[]>(['error']);
  const [visibleAfter, setVisibleAfter] = useState(() =>
    getCustomInjectedOperationLogVisibleAfter(sessionId),
  );
  const visibleAfterRef = useRef(visibleAfter);

  const refresh = useCallback(
    async ({
      showLoading = true,
    }: {
      showLoading?: boolean;
    } = {}) => {
      if (showLoading) {
        setLoading(true);
        setError(undefined);
      }
      try {
        const nextRecords =
          await globalThis.desktopApiProxy.webview.getCustomInjectedRecentOperationLogs(
            sessionId,
          );
        setRecords(
          nextRecords.filter((record) =>
            isAfterCursor(record, visibleAfterRef.current),
          ),
        );
      } catch (loadError) {
        if (showLoading) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    let disposed = false;
    const initializeLogs = async () => {
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
        }
      } catch {
        // Fall back to the renderer start time if the desktop API is unavailable.
      }
      if (disposed) return;
      const cursor = getCustomInjectedOperationLogVisibleAfter(sessionId);
      visibleAfterRef.current = cursor;
      setVisibleAfter(cursor);
      await refresh();
    };

    void initializeLogs();
    const timer = setInterval(() => {
      void refresh({ showLoading: false });
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [refresh, sessionId]);

  const clearVisibleLogs = useCallback(() => {
    const cursor = Date.now();
    visibleAfterRef.current = cursor;
    setVisibleAfter(cursor);
    setRecords([]);
    setError(undefined);
    setCustomInjectedOperationLogVisibleAfter(sessionId, cursor);
  }, [sessionId]);

  const visibleRecords = useMemo(
    () => records.filter(isVisibleRecord),
    [records],
  );
  const levelCounts = useMemo(
    () =>
      visibleRecords.reduce<Record<ILogLevel, number>>(
        (counts, record) => {
          counts[getLogLevel(record)] += 1;
          return counts;
        },
        { error: 0, info: 0, success: 0 },
      ),
    [visibleRecords],
  );
  const newestFirstRecords = useMemo(
    () =>
      visibleRecords
        .filter((record) => levelFilter.includes(getLogLevel(record)))
        .toReversed(),
    [levelFilter, visibleRecords],
  );

  const toggleLevelFilter = useCallback((level: ILogLevel) => {
    setLevelFilter((current) =>
      current.includes(level)
        ? current.filter((value) => value !== level)
        : [...current, level],
    );
  }, []);

  const openLog = useCallback(async () => {
    if (openingLog) return;
    setOpeningLog(true);
    setError(undefined);
    try {
      await globalThis.desktopApiProxy.webview.openCustomInjectedOperationLogFile(
        sessionId,
      );
      await refresh();
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : String(openError),
      );
    } finally {
      setOpeningLog(false);
    }
  }, [openingLog, refresh, sessionId]);

  return (
    <Page>
      <Page.Header title="Logs" />
      <Page.Body>
        <YStack flex={1} gap="$2" minHeight={0} px="$4" pb="$3">
          <XStack
            alignItems="center"
            flexWrap="wrap"
            gap="$1.5"
            testID="custom-injected-operation-log-status-filters"
          >
            <Button
              aria-pressed={levelFilter.length === LOG_FILTER_ORDER.length}
              backgroundColor={
                levelFilter.length === LOG_FILTER_ORDER.length
                  ? '$bgInfoSubdued'
                  : '$bgStrong'
              }
              borderColor={
                levelFilter.length === LOG_FILTER_ORDER.length
                  ? '$borderInfo'
                  : '$transparent'
              }
              h="$6"
              px="$1.5"
              py="$0"
              size="small"
              testID="custom-injected-operation-log-filter-all"
              variant="secondary"
              onPress={() => setLevelFilter(LOG_FILTER_ORDER)}
            >
              All
            </Button>
            {LOG_FILTER_ORDER.map((level) => {
              const config = LOG_LEVEL_CONFIG[level];
              const selected = levelFilter.includes(level);
              return (
                <Button
                  key={level}
                  aria-pressed={selected}
                  backgroundColor={
                    selected ? config.backgroundColor : '$bgStrong'
                  }
                  borderColor={selected ? config.borderColor : '$transparent'}
                  childrenAsText={false}
                  h="$6"
                  px="$1.5"
                  py="$0"
                  size="small"
                  testID={`custom-injected-operation-log-filter-${level}`}
                  variant="secondary"
                  onPress={() => toggleLevelFilter(level)}
                >
                  <XStack alignItems="center" gap="$1">
                    <Icon
                      color={config.iconColor}
                      name={config.icon}
                      size="$3"
                    />
                    <SizableText
                      color={selected ? config.textColor : '$textSubdued'}
                      size="$bodyXsMedium"
                    >
                      {`${config.label} ${String(levelCounts[level])}`}
                    </SizableText>
                  </XStack>
                </Button>
              );
            })}
            <XStack flex={1} />
            <XStack alignItems="center" gap="$1.5">
              <IconButton
                aria-label="Clear log view"
                icon="BroomOutline"
                size="small"
                testID="custom-injected-operation-logs-clear"
                title="Clear view"
                variant="secondary"
                onPress={clearVisibleLogs}
              />
              <IconButton
                aria-label="Refresh logs"
                icon="RefreshCwOutline"
                loading={loading}
                size="small"
                testID="custom-injected-operation-logs-refresh"
                title="Refresh"
                variant="secondary"
                onPress={() => void refresh()}
              />
            </XStack>
          </XStack>
          {error ? (
            <SizableText color="$textCritical" size="$bodySm">
              {error}
            </SizableText>
          ) : null}
          <ScrollView
            flex={1}
            minHeight={400}
            testID="custom-injected-operation-logs-scroll"
          >
            <YStack gap="$1" testID="custom-injected-operation-logs">
              {newestFirstRecords.map((record) => (
                <LogRecordCard
                  key={`${record.timestamp}-${record.operationId}-${record.status}`}
                  record={record}
                />
              ))}
              {!newestFirstRecords.length ? (
                <SizableText color="$textSubdued" p="$2" size="$bodySm">
                  {emptyResultsMessage(loading, Boolean(visibleRecords.length))}
                </SizableText>
              ) : null}
            </YStack>
          </ScrollView>
        </YStack>
      </Page.Body>
      <Page.Footer>
        <XStack
          alignItems="center"
          gap="$2"
          px="$4"
          py="$2"
          testID="custom-injected-operation-log-file-bar"
        >
          <SizableText
            color="$textSubdued"
            flex={1}
            fontFamily="$monoRegular"
            minWidth={0}
            numberOfLines={1}
            selectable
            size="$bodyXs"
            testID="custom-injected-operation-log-file-path"
          >
            logs/custom-injection/operations.jsonl
          </SizableText>
          <Button
            icon="FolderOpenOutline"
            loading={openingLog}
            size="small"
            testID="custom-injected-operation-log-open"
            variant="secondary"
            onPress={() => void openLog()}
          >
            Open file
          </Button>
        </XStack>
      </Page.Footer>
    </Page>
  );
}

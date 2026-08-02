import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Badge,
  Button,
  Checkbox,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { sniRequest } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import type {
  ISniRequestConfig,
  ISniRequestDebugSnapshot,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

const QUEUE_TEST_REQUEST_COUNT = 20;
const QUEUE_TEST_ACTIVE_LIMIT = 16;
const QUEUE_TEST_PENDING_COUNT =
  QUEUE_TEST_REQUEST_COUNT - QUEUE_TEST_ACTIVE_LIMIT;
const SNAPSHOT_POLL_INTERVAL_MS = 25;
const SNAPSHOT_TIMEOUT_MS = 10_000;

const QA_CASE_IDS = [
  'https-success',
  'active-abort',
  'queue-pending-abort',
  'abort-all-recovery',
] as const;

type IQaCaseId = (typeof QA_CASE_IDS)[number];
type IQaCaseStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'stopped';
type IEvidenceTone = 'critical' | 'info' | 'success';
type IQueueRequestStatus =
  | 'starting'
  | 'active'
  | 'queued'
  | 'succeeded'
  | 'cancelled'
  | 'failed';

type IQaCaseDefinition = {
  id: IQaCaseId;
  title: string;
  description: string;
};

type IQaEvidence = {
  id: number;
  elapsedMs: number;
  label: string;
  value: string;
  tone: IEvidenceTone;
};

type IQaCaseResult = {
  status: IQaCaseStatus;
  durationMs?: number;
  evidence: IQaEvidence[];
  error?: string;
};

type IQueueRequestItem = {
  index: number;
  requestId: string;
  status: IQueueRequestStatus;
  detail: string;
};

type IQueueTarget = Pick<ISniRequestConfig, 'hostname' | 'ip' | 'path'>;

type IRequestOutcome =
  | {
      kind: 'response';
      statusCode: number;
    }
  | {
      kind: 'error';
      code: string;
      message: string;
    };

type ITrackedRequest = {
  controller: AbortController;
  outcome: Promise<IRequestOutcome>;
  requestId: string;
};

const QA_CASES: readonly IQaCaseDefinition[] = [
  {
    id: 'https-success',
    title: 'HTTPS request',
    description: 'Requires a real response with a valid HTTP status.',
  },
  {
    id: 'active-abort',
    title: 'Active AbortController',
    description:
      'Observes an active main-process request, aborts it, and requires SNI_CANCELLED.',
  },
  {
    id: 'queue-pending-abort',
    title: '20 requests: cancel pending',
    description:
      'Requires an observed 16 active / 4 pending queue, then cancels only the four pending requests.',
  },
  {
    id: 'abort-all-recovery',
    title: '20 requests: abort all + recovery',
    description:
      'Cancels pending first, then active requests, verifies drain, and performs a real recovery request.',
  },
];

const DEFAULT_QUEUE_TARGET: IQueueTarget = {
  ip: '104.18.31.39',
  hostname: 'wallet.onekeytest.com',
  path: '/wallet/v1/health',
};

const EMPTY_CASE_RESULTS: Record<IQaCaseId, IQaCaseResult> = {
  'https-success': { status: 'idle', evidence: [] },
  'active-abort': { status: 'idle', evidence: [] },
  'queue-pending-abort': { status: 'idle', evidence: [] },
  'abort-all-recovery': { status: 'idle', evidence: [] },
};

class QaRunnerError extends Error {
  constructor(
    message: string,
    readonly stopped = false,
  ) {
    super(message);
  }
}

function normalizeTarget(target: IQueueTarget): IQueueTarget {
  return {
    hostname: target.hostname.trim(),
    ip: target.ip.trim(),
    path: target.path.trim(),
  };
}

function getErrorDetails(error: unknown): { code: string; message: string } {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
  };
}

function isValidResponse(
  response: ISniResponse | null,
): response is ISniResponse {
  return Boolean(
    response &&
    Number.isInteger(response.statusCode) &&
    response.statusCode >= 100 &&
    response.statusCode <= 599,
  );
}

function isCancelledOutcome(outcome: IRequestOutcome): boolean {
  return outcome.kind === 'error' && outcome.code === 'SNI_CANCELLED';
}

function formatSnapshot(snapshot: ISniRequestDebugSnapshot): string {
  return `pair active=${snapshot.activeRequestsForPair}, pending=${snapshot.pendingRequestsForPair}; global active=${snapshot.activeRequests}, pending=${snapshot.pendingRequests}`;
}

function getCaseBadgeType(
  status: IQaCaseStatus,
): 'critical' | 'default' | 'info' | 'success' | 'warning' {
  if (status === 'passed') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'running') return 'info';
  if (status === 'pending') return 'warning';
  return 'default';
}

function getRequestBadgeType(
  status: IQueueRequestStatus,
): 'critical' | 'default' | 'info' | 'success' | 'warning' {
  if (status === 'active') return 'info';
  if (status === 'queued') return 'warning';
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'critical';
  return 'default';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireObservation(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new QaRunnerError(message);
}

function buildRequestConfig({
  caseId,
  index,
  requestId,
  target,
}: {
  caseId: IQaCaseId;
  index?: number;
  requestId: string;
  target: IQueueTarget;
}): ISniRequestConfig {
  const pathSeparator = target.path.includes('?') ? '&' : '?';
  const indexSuffix = index === undefined ? '' : `-${index}`;
  return {
    requestId,
    ip: target.ip,
    hostname: target.hostname,
    path: `${target.path}${pathSeparator}sniQa=${caseId}-${requestId}${indexSuffix}`,
    headers: {
      Accept: 'application/json',
      'X-OneKey-SNI-QA': caseId,
    },
    method: 'GET',
    body: null,
    timeout: 30_000,
  };
}

export function DesktopSniQueueTest() {
  const [target, setTarget] = useState<IQueueTarget>(DEFAULT_QUEUE_TARGET);
  const [selectedCaseIds, setSelectedCaseIds] = useState<IQaCaseId[]>([
    ...QA_CASE_IDS,
  ]);
  const [caseResults, setCaseResults] =
    useState<Record<IQaCaseId, IQaCaseResult>>(EMPTY_CASE_RESULTS);
  const [items, setItems] = useState<IQueueRequestItem[]>([]);
  const [snapshot, setSnapshot] = useState<ISniRequestDebugSnapshot | null>(
    null,
  );
  const [snapshotError, setSnapshotError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const [runCompleted, setRunCompleted] = useState(false);
  const generationRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const controllersRef = useRef(new Map<string, AbortController>());
  const caseStartedAtRef = useRef(new Map<IQaCaseId, number>());
  const evidenceIdRef = useRef(0);

  const abortOwnRequests = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
  }, []);

  const updateCaseResult = useCallback(
    (caseId: IQaCaseId, update: Partial<IQaCaseResult>) => {
      setCaseResults((current) => ({
        ...current,
        [caseId]: { ...current[caseId], ...update },
      }));
    },
    [],
  );

  const appendEvidence = useCallback(
    (
      caseId: IQaCaseId,
      label: string,
      value: string,
      tone: IEvidenceTone = 'info',
    ) => {
      const startedAt = caseStartedAtRef.current.get(caseId) ?? Date.now();
      evidenceIdRef.current += 1;
      const evidence: IQaEvidence = {
        id: evidenceIdRef.current,
        elapsedMs: Date.now() - startedAt,
        label,
        value,
        tone,
      };
      setCaseResults((current) => ({
        ...current,
        [caseId]: {
          ...current[caseId],
          evidence: [...current[caseId].evidence, evidence],
        },
      }));
    },
    [],
  );

  const updateBatchItem = useCallback(
    (generation: number, index: number, update: Partial<IQueueRequestItem>) => {
      if (generationRef.current !== generation) return;
      setItems((current) =>
        current.map((item) =>
          item.index === index ? { ...item, ...update } : item,
        ),
      );
    },
    [],
  );

  const handleRun = useCallback(async () => {
    if (selectedCaseIds.length === 0 || isRunning) return;

    abortOwnRequests();
    controllersRef.current.clear();
    generationRef.current += 1;
    const generation = generationRef.current;
    const runTarget = normalizeTarget(target);
    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const selectedSet = new Set(selectedCaseIds);
    stopRequestedRef.current = false;
    setIsRunning(true);
    setRunCompleted(false);
    setSnapshot(null);
    setSnapshotError(undefined);
    setItems([]);
    setCaseResults(() => {
      const next = { ...EMPTY_CASE_RESULTS };
      QA_CASE_IDS.forEach((caseId) => {
        next[caseId] = {
          status: selectedSet.has(caseId) ? 'pending' : 'idle',
          evidence: [],
        };
      });
      return next;
    });

    const ensureActive = () => {
      if (stopRequestedRef.current || generationRef.current !== generation) {
        throw new QaRunnerError('Stopped by QA', true);
      }
    };

    const proxy = globalThis.desktopApiProxy?.sniRequest;

    const readSnapshot = async (): Promise<ISniRequestDebugSnapshot> => {
      ensureActive();
      if (typeof proxy?.getDebugSnapshot !== 'function') {
        throw new QaRunnerError(
          'Electron main limiter snapshot API is unavailable',
        );
      }
      try {
        const nextSnapshot = await proxy.getDebugSnapshot(runTarget);
        ensureActive();
        setSnapshot(nextSnapshot);
        setSnapshotError(undefined);
        return nextSnapshot;
      } catch (error) {
        const { message } = getErrorDetails(error);
        setSnapshotError(message);
        throw new QaRunnerError(`Snapshot failed: ${message}`);
      }
    };

    const waitForSnapshot = async (
      caseId: IQaCaseId,
      label: string,
      predicate: (value: ISniRequestDebugSnapshot) => boolean,
      timeoutMs = SNAPSHOT_TIMEOUT_MS,
    ): Promise<ISniRequestDebugSnapshot> => {
      const deadline = Date.now() + timeoutMs;
      let latestSnapshot: ISniRequestDebugSnapshot | undefined;
      do {
        latestSnapshot = await readSnapshot();
        if (predicate(latestSnapshot)) {
          appendEvidence(
            caseId,
            label,
            formatSnapshot(latestSnapshot),
            'success',
          );
          return latestSnapshot;
        }
        await delay(SNAPSHOT_POLL_INTERVAL_MS);
        ensureActive();
      } while (Date.now() < deadline);

      const lastValue = latestSnapshot
        ? formatSnapshot(latestSnapshot)
        : 'no snapshot returned';
      appendEvidence(caseId, `${label} timeout`, lastValue, 'critical');
      throw new QaRunnerError(`${label} was not observed; ${lastValue}`);
    };

    const waitForDrain = (caseId: IQaCaseId, label = 'Limiter drained') =>
      waitForSnapshot(
        caseId,
        label,
        (value) =>
          value.activeRequestsForPair === 0 &&
          value.pendingRequestsForPair === 0,
      );

    const prepareCase = async (caseId: IQaCaseId) => {
      await waitForDrain(caseId, 'Target idle before case');
      if (typeof proxy?.clearDNSCache !== 'function') {
        throw new QaRunnerError('Electron main DNS cache API is unavailable');
      }
      const result = await proxy.clearDNSCache();
      requireObservation(
        result.success,
        'clearDNSCache returned success=false',
      );
      appendEvidence(caseId, 'Fresh Electron agent', 'clearDNSCache success');
    };

    const startRequest = ({
      caseId,
      index,
      phase,
    }: {
      caseId: IQaCaseId;
      index?: number;
      phase: string;
    }): ITrackedRequest => {
      ensureActive();
      const requestId = `qa-sni-${phase}-${runId}${
        index === undefined ? '' : `-${index}`
      }`;
      const controller = new AbortController();
      controllersRef.current.set(requestId, controller);
      const requestPromise = sniRequest(
        buildRequestConfig({
          caseId,
          index,
          requestId,
          target: runTarget,
        }),
        { signal: controller.signal },
      );
      const outcome = requestPromise
        .then((response): IRequestOutcome => {
          if (!isValidResponse(response)) {
            if (index !== undefined) {
              updateBatchItem(generation, index, {
                status: 'failed',
                detail: 'SNI response unavailable or invalid',
              });
            }
            return {
              kind: 'error',
              code: 'SNI_INVALID_RESPONSE',
              message: 'SNI response unavailable or invalid',
            };
          }
          if (index !== undefined) {
            updateBatchItem(generation, index, {
              status: 'succeeded',
              detail: `HTTP ${response.statusCode}`,
            });
          }
          return { kind: 'response', statusCode: response.statusCode };
        })
        .catch((error: unknown): IRequestOutcome => {
          const { code, message } = getErrorDetails(error);
          if (index !== undefined) {
            updateBatchItem(generation, index, {
              status: code === 'SNI_CANCELLED' ? 'cancelled' : 'failed',
              detail: code || message,
            });
          }
          return { kind: 'error', code, message };
        })
        .finally(() => {
          controllersRef.current.delete(requestId);
        });
      return { controller, outcome, requestId };
    };

    const startBatch = (caseId: IQaCaseId): ITrackedRequest[] => {
      const nextItems = Array.from(
        { length: QUEUE_TEST_REQUEST_COUNT },
        (_, index): IQueueRequestItem => ({
          index,
          requestId: `qa-sni-${caseId}-${runId}-${index}`,
          status: 'starting',
          detail: 'Waiting for observed main-process state',
        }),
      );
      setItems(nextItems);
      return nextItems.map((_, index) =>
        startRequest({ caseId, index, phase: caseId }),
      );
    };

    const observeSaturatedQueue = async (caseId: IQaCaseId) => {
      await waitForSnapshot(
        caseId,
        'Queue saturation observed',
        (value) =>
          value.activeRequestsForPair === QUEUE_TEST_ACTIVE_LIMIT &&
          value.pendingRequestsForPair === QUEUE_TEST_PENDING_COUNT,
      );
      setItems((current) =>
        current.map((item) => ({
          ...item,
          status: item.index < QUEUE_TEST_ACTIVE_LIMIT ? 'active' : 'queued',
          detail:
            item.index < QUEUE_TEST_ACTIVE_LIMIT
              ? 'Observed active in Electron main'
              : 'Observed pending in Electron main',
        })),
      );
    };

    const abortPendingFirst = (requests: ITrackedRequest[]) => {
      requests
        .slice(QUEUE_TEST_ACTIVE_LIMIT)
        .forEach((request) => request.controller.abort());
    };

    const abortActive = (requests: ITrackedRequest[]) => {
      requests
        .slice(0, QUEUE_TEST_ACTIVE_LIMIT)
        .forEach((request) => request.controller.abort());
    };

    const summarizeOutcomes = (outcomes: IRequestOutcome[]) => ({
      cancelled: outcomes.filter(isCancelledOutcome).length,
      failed: outcomes.filter(
        (outcome) => outcome.kind === 'error' && !isCancelledOutcome(outcome),
      ).length,
      responded: outcomes.filter((outcome) => outcome.kind === 'response')
        .length,
    });

    const runHttpsSuccess = async (caseId: IQaCaseId) => {
      await prepareCase(caseId);
      const request = startRequest({ caseId, phase: 'https-success' });
      const outcome = await request.outcome;
      requireObservation(
        outcome.kind === 'response',
        `Expected a real HTTPS response, got ${
          outcome.kind === 'error' ? outcome.code || outcome.message : 'unknown'
        }`,
      );
      appendEvidence(
        caseId,
        'HTTPS response',
        `HTTP ${outcome.statusCode}`,
        'success',
      );
      await waitForDrain(caseId);
    };

    const runActiveAbort = async (caseId: IQaCaseId) => {
      await prepareCase(caseId);
      const request = startRequest({ caseId, phase: 'active-abort' });
      await waitForSnapshot(
        caseId,
        'Active request observed',
        (value) => value.activeRequestsForPair === 1,
      );
      request.controller.abort();
      appendEvidence(caseId, 'Abort signal sent', request.requestId);
      const outcome = await request.outcome;
      requireObservation(
        isCancelledOutcome(outcome),
        `Expected SNI_CANCELLED, got ${
          outcome.kind === 'response'
            ? `HTTP ${outcome.statusCode}`
            : outcome.code || outcome.message
        }`,
      );
      appendEvidence(caseId, 'Renderer outcome', 'SNI_CANCELLED', 'success');
      await waitForDrain(caseId);
    };

    const runQueuePendingAbort = async (caseId: IQaCaseId) => {
      await prepareCase(caseId);
      const requests = startBatch(caseId);
      await observeSaturatedQueue(caseId);
      abortPendingFirst(requests);
      appendEvidence(
        caseId,
        'Pending abort signals sent',
        `${QUEUE_TEST_PENDING_COUNT} AbortController signals`,
      );
      const pendingOutcomes = await Promise.all(
        requests
          .slice(QUEUE_TEST_ACTIVE_LIMIT)
          .map((request) => request.outcome),
      );
      const pendingSummary = summarizeOutcomes(pendingOutcomes);
      appendEvidence(
        caseId,
        'Pending renderer outcomes',
        `cancelled=${pendingSummary.cancelled}, responded=${pendingSummary.responded}, failed=${pendingSummary.failed}`,
        pendingSummary.cancelled === QUEUE_TEST_PENDING_COUNT
          ? 'success'
          : 'critical',
      );
      requireObservation(
        pendingSummary.cancelled === QUEUE_TEST_PENDING_COUNT,
        `Expected ${QUEUE_TEST_PENDING_COUNT} pending SNI_CANCELLED outcomes; cancelled=${pendingSummary.cancelled}, responded=${pendingSummary.responded}, failed=${pendingSummary.failed}`,
      );
      await waitForSnapshot(
        caseId,
        'Pending queue drained',
        (value) => value.pendingRequestsForPair === 0,
      );

      abortActive(requests);
      const allOutcomes = await Promise.all(
        requests.map((request) => request.outcome),
      );
      const cleanupSummary = summarizeOutcomes(allOutcomes);
      appendEvidence(
        caseId,
        'Owned-request cleanup',
        `cancelled=${cleanupSummary.cancelled}, responded=${cleanupSummary.responded}, failed=${cleanupSummary.failed}`,
      );
      await waitForDrain(caseId);
    };

    const runAbortAllRecovery = async (caseId: IQaCaseId) => {
      await prepareCase(caseId);
      const requests = startBatch(caseId);
      await observeSaturatedQueue(caseId);
      abortPendingFirst(requests);
      abortActive(requests);
      appendEvidence(
        caseId,
        'Abort signals sent',
        `${QUEUE_TEST_PENDING_COUNT} pending first, then ${QUEUE_TEST_ACTIVE_LIMIT} active`,
      );
      const outcomes = await Promise.all(
        requests.map((request) => request.outcome),
      );
      const summary = summarizeOutcomes(outcomes);
      appendEvidence(
        caseId,
        'Batch renderer outcomes',
        `cancelled=${summary.cancelled}, responded=${summary.responded}, failed=${summary.failed}`,
        summary.cancelled === QUEUE_TEST_REQUEST_COUNT ? 'success' : 'critical',
      );
      requireObservation(
        summary.cancelled === QUEUE_TEST_REQUEST_COUNT,
        `Expected ${QUEUE_TEST_REQUEST_COUNT} SNI_CANCELLED outcomes; cancelled=${summary.cancelled}, responded=${summary.responded}, failed=${summary.failed}`,
      );
      await waitForDrain(caseId, 'Limiter drained after abort all');

      const recovery = startRequest({ caseId, phase: 'recovery' });
      const recoveryOutcome = await recovery.outcome;
      requireObservation(
        recoveryOutcome.kind === 'response',
        `Recovery request failed: ${
          recoveryOutcome.kind === 'error'
            ? recoveryOutcome.code || recoveryOutcome.message
            : 'unknown'
        }`,
      );
      appendEvidence(
        caseId,
        'Recovery response',
        `HTTP ${recoveryOutcome.statusCode}`,
        'success',
      );
      await waitForDrain(caseId, 'Limiter drained after recovery');
    };

    const runCase = async (caseId: IQaCaseId) => {
      if (caseId === 'https-success') return runHttpsSuccess(caseId);
      if (caseId === 'active-abort') return runActiveAbort(caseId);
      if (caseId === 'queue-pending-abort') {
        return runQueuePendingAbort(caseId);
      }
      return runAbortAllRecovery(caseId);
    };

    let stopped = false;
    for (const caseId of selectedCaseIds) {
      if (stopped) {
        updateCaseResult(caseId, { status: 'stopped' });
      } else {
        caseStartedAtRef.current.set(caseId, Date.now());
        updateCaseResult(caseId, {
          status: 'running',
          evidence: [],
          error: undefined,
          durationMs: undefined,
        });
        try {
          await runCase(caseId);
          ensureActive();
          const durationMs =
            Date.now() - (caseStartedAtRef.current.get(caseId) ?? Date.now());
          updateCaseResult(caseId, { status: 'passed', durationMs });
        } catch (error) {
          const durationMs =
            Date.now() - (caseStartedAtRef.current.get(caseId) ?? Date.now());
          if (
            (error instanceof QaRunnerError && error.stopped) ||
            stopRequestedRef.current
          ) {
            stopped = true;
            updateCaseResult(caseId, {
              status: 'stopped',
              durationMs,
              error:
                error instanceof QaRunnerError
                  ? error.message
                  : 'Stopped by QA',
            });
          } else {
            const { message } = getErrorDetails(error);
            appendEvidence(caseId, 'Case failed', message, 'critical');
            updateCaseResult(caseId, {
              status: 'failed',
              durationMs,
              error: message,
            });
          }
        } finally {
          abortOwnRequests();
          controllersRef.current.clear();
        }
      }
    }

    if (generationRef.current === generation) {
      setIsRunning(false);
      setRunCompleted(true);
    }
  }, [
    abortOwnRequests,
    appendEvidence,
    isRunning,
    selectedCaseIds,
    target,
    updateBatchItem,
    updateCaseResult,
  ]);

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true;
    abortOwnRequests();
  }, [abortOwnRequests]);

  const handleReset = useCallback(() => {
    stopRequestedRef.current = true;
    generationRef.current += 1;
    abortOwnRequests();
    controllersRef.current.clear();
    setIsRunning(false);
    setRunCompleted(false);
    setSnapshot(null);
    setSnapshotError(undefined);
    setItems([]);
    setCaseResults(EMPTY_CASE_RESULTS);
  }, [abortOwnRequests]);

  useEffect(
    () => () => {
      stopRequestedRef.current = true;
      generationRef.current += 1;
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    },
    [],
  );

  const selectedResults = selectedCaseIds.map((caseId) => caseResults[caseId]);
  const summary = useMemo(
    () => ({
      failed: selectedResults.filter((result) => result.status === 'failed')
        .length,
      passed: selectedResults.filter((result) => result.status === 'passed')
        .length,
      stopped: selectedResults.filter((result) => result.status === 'stopped')
        .length,
    }),
    [selectedResults],
  );

  let overallLabel = 'READY';
  let overallBadgeType: 'critical' | 'default' | 'info' | 'success' = 'default';
  if (isRunning) {
    overallLabel = 'RUNNING';
    overallBadgeType = 'info';
  } else if (runCompleted && summary.failed > 0) {
    overallLabel = 'FAIL';
    overallBadgeType = 'critical';
  } else if (runCompleted && summary.stopped > 0) {
    overallLabel = 'STOPPED';
  } else if (
    runCompleted &&
    selectedCaseIds.length > 0 &&
    summary.passed === selectedCaseIds.length
  ) {
    overallLabel = 'PASS';
    overallBadgeType = 'success';
  }

  const setCaseSelected = (caseId: IQaCaseId, selected: boolean) => {
    setRunCompleted(false);
    setSelectedCaseIds((current) => {
      if (selected) {
        return QA_CASE_IDS.filter(
          (candidate) => candidate === caseId || current.includes(candidate),
        );
      }
      return current.filter((candidate) => candidate !== caseId);
    });
  };

  return (
    <Stack gap="$5" testID="desktop-sni-queue-panel">
      <Stack gap="$1">
        <SizableText size="$headingMd">SNI request QA</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          Evidence comes from real renderer outcomes and Electron main limiter
          snapshots. A missing observation is reported as FAIL.
        </SizableText>
      </Stack>

      <XStack gap="$3" flexWrap="wrap">
        <Stack gap="$1" flex={1} minWidth={160}>
          <SizableText size="$bodySm" color="$textSubdued">
            IP
          </SizableText>
          <Input
            value={target.ip}
            onChangeText={(ip) => setTarget((current) => ({ ...current, ip }))}
            disabled={isRunning}
            autoCapitalize="none"
          />
        </Stack>
        <Stack gap="$1" flex={1} minWidth={200}>
          <SizableText size="$bodySm" color="$textSubdued">
            SNI hostname
          </SizableText>
          <Input
            value={target.hostname}
            onChangeText={(hostname) =>
              setTarget((current) => ({ ...current, hostname }))
            }
            disabled={isRunning}
            autoCapitalize="none"
          />
        </Stack>
        <Stack gap="$1" flex={1} minWidth={220}>
          <SizableText size="$bodySm" color="$textSubdued">
            Path
          </SizableText>
          <Input
            value={target.path}
            onChangeText={(path) =>
              setTarget((current) => ({ ...current, path }))
            }
            disabled={isRunning}
            autoCapitalize="none"
          />
        </Stack>
      </XStack>

      <Stack gap="$2">
        <XStack justifyContent="space-between" alignItems="center" gap="$3">
          <SizableText size="$headingSm">Select cases</SizableText>
          <XStack gap="$2">
            <Button
              size="small"
              variant="tertiary"
              disabled={isRunning}
              testID="desktop-sni-cases-select-all"
              onPress={() => {
                setSelectedCaseIds([...QA_CASE_IDS]);
                setRunCompleted(false);
              }}
            >
              Select all
            </Button>
            <Button
              size="small"
              variant="tertiary"
              disabled={isRunning}
              testID="desktop-sni-cases-clear"
              onPress={() => {
                setSelectedCaseIds([]);
                setRunCompleted(false);
              }}
            >
              Clear
            </Button>
          </XStack>
        </XStack>

        <Stack borderTopWidth={1} borderColor="$borderSubdued">
          {QA_CASES.map((qaCase) => {
            const result = caseResults[qaCase.id];
            const isSelected = selectedCaseIds.includes(qaCase.id);
            return (
              <Stack
                key={qaCase.id}
                py="$3"
                gap="$2"
                borderBottomWidth={1}
                borderColor="$borderSubdued"
              >
                <XStack gap="$3" alignItems="center">
                  <Checkbox
                    value={isSelected}
                    disabled={isRunning}
                    onChange={(value) =>
                      setCaseSelected(qaCase.id, Boolean(value))
                    }
                    testID={`desktop-sni-case-${qaCase.id}`}
                  />
                  <Stack flex={1} minWidth={0}>
                    <SizableText size="$bodyMdMedium">
                      {qaCase.title}
                    </SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      {qaCase.description}
                    </SizableText>
                  </Stack>
                  {result.durationMs === undefined ? null : (
                    <SizableText size="$bodyXs" color="$textSubdued">
                      {result.durationMs} ms
                    </SizableText>
                  )}
                  <Badge
                    badgeType={getCaseBadgeType(result.status)}
                    badgeSize="sm"
                    testID={`desktop-sni-case-${qaCase.id}-result`}
                  >
                    <Badge.Text>{result.status.toUpperCase()}</Badge.Text>
                  </Badge>
                </XStack>

                {result.evidence.length > 0 ? (
                  <Stack pl="$8" gap="$1">
                    {result.evidence.map((evidence) => (
                      <Stack key={evidence.id} gap="$1" py="$1">
                        <XStack gap="$2" alignItems="center">
                          <SizableText
                            minWidth={64}
                            size="$bodyXs"
                            color="$textSubdued"
                          >
                            +{evidence.elapsedMs} ms
                          </SizableText>
                          <Badge badgeType={evidence.tone} badgeSize="sm">
                            <Badge.Text>{evidence.label}</Badge.Text>
                          </Badge>
                        </XStack>
                        <SizableText
                          size="$bodyXs"
                          color={
                            evidence.tone === 'critical'
                              ? '$textCritical'
                              : '$textSubdued'
                          }
                        >
                          {evidence.value}
                        </SizableText>
                      </Stack>
                    ))}
                  </Stack>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      </Stack>

      <XStack gap="$3" flexWrap="wrap" alignItems="center">
        <Button
          variant="primary"
          onPress={() => void handleRun()}
          disabled={isRunning || selectedCaseIds.length === 0}
          testID="desktop-sni-queue-run"
        >
          Run selected ({selectedCaseIds.length})
        </Button>
        <Button
          variant="destructive"
          onPress={handleStop}
          disabled={!isRunning}
          testID="desktop-sni-queue-cancel-all"
        >
          Stop run
        </Button>
        <Button variant="secondary" onPress={handleReset} disabled={isRunning}>
          Reset results
        </Button>
        <Badge
          testID="desktop-sni-queue-result"
          badgeType={overallBadgeType}
          badgeSize="lg"
        >
          <Badge.Text>{overallLabel}</Badge.Text>
        </Badge>
        <SizableText size="$bodySm" color="$textSubdued">
          Passed {summary.passed} / Failed {summary.failed} / Stopped{' '}
          {summary.stopped}
        </SizableText>
      </XStack>

      <XStack gap="$5" flexWrap="wrap">
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Pair active
          </SizableText>
          <SizableText size="$headingLg" testID="desktop-sni-main-active">
            {snapshot?.activeRequestsForPair ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Pair pending
          </SizableText>
          <SizableText size="$headingLg" testID="desktop-sni-main-pending">
            {snapshot?.pendingRequestsForPair ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Global active
          </SizableText>
          <SizableText size="$headingLg">
            {snapshot?.activeRequests ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={120}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Global pending
          </SizableText>
          <SizableText size="$headingLg">
            {snapshot?.pendingRequests ?? '-'}
          </SizableText>
        </Stack>
      </XStack>

      {snapshotError ? (
        <SizableText color="$textCritical" size="$bodySm">
          Snapshot error: {snapshotError}
        </SizableText>
      ) : null}

      {items.length > 0 ? (
        <Stack gap="$2">
          <SizableText size="$headingSm">Latest 20-request batch</SizableText>
          <Stack borderTopWidth={1} borderColor="$borderSubdued">
            {items.map((item) => {
              const canCancel =
                isRunning &&
                (item.status === 'starting' ||
                  item.status === 'active' ||
                  item.status === 'queued');
              return (
                <XStack
                  key={item.requestId}
                  minHeight={40}
                  py="$2"
                  gap="$3"
                  alignItems="center"
                  borderBottomWidth={1}
                  borderColor="$borderSubdued"
                >
                  <SizableText width={32} size="$bodySmMedium">
                    {item.index + 1}
                  </SizableText>
                  <Badge
                    badgeType={getRequestBadgeType(item.status)}
                    badgeSize="sm"
                  >
                    <Badge.Text>{item.status}</Badge.Text>
                  </Badge>
                  <SizableText
                    flex={1}
                    minWidth={0}
                    size="$bodySm"
                    color="$textSubdued"
                  >
                    {item.detail}
                  </SizableText>
                  <Button
                    size="small"
                    variant="tertiary"
                    disabled={!canCancel}
                    onPress={() =>
                      controllersRef.current.get(item.requestId)?.abort()
                    }
                  >
                    Cancel
                  </Button>
                </XStack>
              );
            })}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

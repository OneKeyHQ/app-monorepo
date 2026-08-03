import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sniRequest } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import { sniRequestQaAdapter } from '@onekeyhq/shared/src/request/helpers/sniRequestQa';
import {
  getSniRequestCancelAckError,
  getSniRequestErrorCode,
  getSniRequestTransportSettledError,
  waitForSniRequestCancelAck,
  waitForSniRequestTransportSettled,
} from '@onekeyhq/shared/src/request/helpers/sniRequestQaUtils';
import type {
  ISniRequestCancelSettledResult,
  ISniRequestConfig,
  ISniRequestDebugSnapshot,
  ISniRequestTransportSettledResult,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

export const QUEUE_TEST_REQUEST_COUNT = 20;
export const QUEUE_TEST_ACTIVE_LIMIT = 16;
export const QUEUE_TEST_PENDING_COUNT =
  QUEUE_TEST_REQUEST_COUNT - QUEUE_TEST_ACTIVE_LIMIT;

const SNAPSHOT_POLL_INTERVAL_MS = 25;
const SNAPSHOT_TIMEOUT_MS = 10_000;

export const QA_CASE_IDS = [
  'https-success',
  'active-abort',
  'queue-pending-abort',
  'abort-all-recovery',
] as const;

export type IQaCaseId = (typeof QA_CASE_IDS)[number];
export type IQaCaseStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'stopped';
export type IEvidenceTone = 'critical' | 'info' | 'success';
export type IQueueRequestStatus =
  | 'starting'
  | 'active'
  | 'queued'
  | 'succeeded'
  | 'cancelled'
  | 'failed';

export type IQaCaseDefinition = {
  id: IQaCaseId;
  title: string;
  description: string;
};

export type IQaEvidence = {
  id: number;
  elapsedMs: number;
  label: string;
  value: string;
  tone: IEvidenceTone;
};

export type IQaCaseResult = {
  status: IQaCaseStatus;
  durationMs?: number;
  evidence: IQaEvidence[];
  error?: string;
};

export type IQueueRequestItem = {
  index: number;
  requestId: string;
  status: IQueueRequestStatus;
  detail: string;
};

export type IQueueTarget = Pick<ISniRequestConfig, 'hostname' | 'ip' | 'path'>;

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
  cancelAck: Promise<ISniRequestCancelSettledResult>;
  controller: AbortController;
  outcome: Promise<IRequestOutcome>;
  requestId: string;
  transportSettled: Promise<ISniRequestTransportSettledResult>;
};

type ISaturatedBatch = {
  activeRequests: ITrackedRequest[];
  pendingRequests: ITrackedRequest[];
  requests: ITrackedRequest[];
};

export const QA_CASES: readonly IQaCaseDefinition[] = [
  {
    id: 'https-success',
    title: 'HTTPS request',
    description: 'Requires a real response with a valid HTTP status.',
  },
  {
    id: 'active-abort',
    title: 'Active AbortController',
    description:
      'Observes an active transport request, aborts it, and requires SNI_CANCELLED plus cancelRequest success=true.',
  },
  {
    id: 'queue-pending-abort',
    title: '20 requests: cancel pending',
    description:
      'Observes 16 active and four pending requests, identifies the real pending request IDs, and verifies their transport cancellation acknowledgements.',
  },
  {
    id: 'abort-all-recovery',
    title: '20 requests: abort all + recovery',
    description:
      'Cancels pending first, then active requests, verifies every cancellation acknowledgement and drain, then performs a real recovery request.',
  },
];

export const DEFAULT_QUEUE_TARGET: IQueueTarget = {
  ip: '162.159.142.41',
  hostname: 'postman-echo.com',
  path: '/delay/3',
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
  return {
    code: getSniRequestErrorCode(error),
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

export function useSniRequestQa() {
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
  const [expandedEvidenceCaseIds, setExpandedEvidenceCaseIds] = useState<
    IQaCaseId[]
  >([]);
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
    setExpandedEvidenceCaseIds([]);
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

    const readSnapshot = async (): Promise<ISniRequestDebugSnapshot> => {
      ensureActive();
      try {
        const nextSnapshot =
          await sniRequestQaAdapter.getDebugSnapshot(runTarget);
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
      const result = await sniRequestQaAdapter.clearDNSCache();
      requireObservation(
        result.success,
        'clearDNSCache returned success=false',
      );
      appendEvidence(
        caseId,
        'Transport cache reset',
        `${sniRequestQaAdapter.transportLabel}: clearDNSCache success`,
      );
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
      let resolveCancelAck:
        | ((result: ISniRequestCancelSettledResult) => void)
        | undefined;
      const cancelAck = new Promise<ISniRequestCancelSettledResult>(
        (resolve) => {
          resolveCancelAck = resolve;
        },
      );
      let resolveTransportSettled:
        | ((result: ISniRequestTransportSettledResult) => void)
        | undefined;
      const transportSettled = new Promise<ISniRequestTransportSettledResult>(
        (resolve) => {
          resolveTransportSettled = resolve;
        },
      );
      const requestPromise = sniRequest(
        buildRequestConfig({
          caseId,
          index,
          requestId,
          target: runTarget,
        }),
        {
          signal: controller.signal,
          onCancelSettled: (result) => resolveCancelAck?.(result),
          onTransportSettled: (result) => resolveTransportSettled?.(result),
        },
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
      return {
        cancelAck,
        controller,
        outcome,
        requestId,
        transportSettled,
      };
    };

    const startSaturatedBatch = async (
      caseId: IQaCaseId,
    ): Promise<ISaturatedBatch> => {
      const nextItems = Array.from(
        { length: QUEUE_TEST_REQUEST_COUNT },
        (_, index): IQueueRequestItem => ({
          index,
          requestId: `qa-sni-${caseId}-${runId}-${index}`,
          status: 'starting',
          detail: 'Waiting for observed transport state',
        }),
      );
      setItems(nextItems);

      if (sniRequestQaAdapter.supportsRequestIdSnapshot) {
        const requests = Array.from(
          { length: QUEUE_TEST_REQUEST_COUNT },
          (_, index) => startRequest({ caseId, index, phase: caseId }),
        );
        const saturatedSnapshot = await waitForSnapshot(
          caseId,
          'Queue saturation observed with request IDs',
          (value) =>
            value.activeRequestsForPair === QUEUE_TEST_ACTIVE_LIMIT &&
            value.pendingRequestsForPair === QUEUE_TEST_PENDING_COUNT &&
            value.activeRequestIdsForPair?.length === QUEUE_TEST_ACTIVE_LIMIT &&
            value.pendingRequestIdsForPair?.length === QUEUE_TEST_PENDING_COUNT,
        );
        const requestsById = new Map(
          requests.map((request) => [request.requestId, request]),
        );
        const activeRequests =
          saturatedSnapshot.activeRequestIdsForPair?.map((requestId) =>
            requestsById.get(requestId),
          ) ?? [];
        const pendingRequests =
          saturatedSnapshot.pendingRequestIdsForPair?.map((requestId) =>
            requestsById.get(requestId),
          ) ?? [];
        requireObservation(
          activeRequests.every(
            (request): request is ITrackedRequest => request !== undefined,
          ) && activeRequests.length === QUEUE_TEST_ACTIVE_LIMIT,
          'Native active request IDs did not match the QA-owned batch',
        );
        requireObservation(
          pendingRequests.every(
            (request): request is ITrackedRequest => request !== undefined,
          ) && pendingRequests.length === QUEUE_TEST_PENDING_COUNT,
          'Native pending request IDs did not match the QA-owned batch',
        );
        const activeRequestIds = new Set(
          activeRequests.map((request) => request.requestId),
        );
        const pendingRequestIds = new Set(
          pendingRequests.map((request) => request.requestId),
        );
        setItems((current) =>
          current.map((item) => {
            if (activeRequestIds.has(item.requestId)) {
              return {
                ...item,
                status: 'active',
                detail: `Observed active in ${sniRequestQaAdapter.transportLabel}`,
              };
            }
            if (pendingRequestIds.has(item.requestId)) {
              return {
                ...item,
                status: 'queued',
                detail: `Observed pending in ${sniRequestQaAdapter.transportLabel}`,
              };
            }
            return {
              ...item,
              status: 'failed',
              detail: 'Request was not present in the Native limiter snapshot',
            };
          }),
        );
        appendEvidence(
          caseId,
          'QA-owned request IDs matched',
          `${activeRequests.length} active, ${pendingRequests.length} pending`,
          'success',
        );
        return { activeRequests, pendingRequests, requests };
      }

      const activeRequests = Array.from(
        { length: QUEUE_TEST_ACTIVE_LIMIT },
        (_, index) => startRequest({ caseId, index, phase: caseId }),
      );
      await waitForSnapshot(
        caseId,
        'Known active batch observed',
        (value) =>
          value.activeRequestsForPair === QUEUE_TEST_ACTIVE_LIMIT &&
          value.pendingRequestsForPair === 0,
      );
      setItems((current) =>
        current.map((item) =>
          item.index < QUEUE_TEST_ACTIVE_LIMIT
            ? {
                ...item,
                status: 'active',
                detail: `Observed active in ${sniRequestQaAdapter.transportLabel}`,
              }
            : item,
        ),
      );

      const pendingRequests = Array.from(
        { length: QUEUE_TEST_PENDING_COUNT },
        (_, offset) => {
          const index = QUEUE_TEST_ACTIVE_LIMIT + offset;
          return startRequest({ caseId, index, phase: caseId });
        },
      );
      await waitForSnapshot(
        caseId,
        'Queue saturation observed: known pending batch',
        (value) =>
          value.activeRequestsForPair === QUEUE_TEST_ACTIVE_LIMIT &&
          value.pendingRequestsForPair === QUEUE_TEST_PENDING_COUNT,
      );
      setItems((current) =>
        current.map((item) =>
          item.index >= QUEUE_TEST_ACTIVE_LIMIT
            ? {
                ...item,
                status: 'queued',
                detail: `Observed pending in ${sniRequestQaAdapter.transportLabel}`,
              }
            : item,
        ),
      );
      return {
        activeRequests,
        pendingRequests,
        requests: [...activeRequests, ...pendingRequests],
      };
    };

    const abortPendingFirst = (batch: ISaturatedBatch) => {
      batch.pendingRequests.forEach((request) => request.controller.abort());
    };

    const abortActive = (batch: ISaturatedBatch) => {
      batch.activeRequests.forEach((request) => request.controller.abort());
    };

    const summarizeOutcomes = (outcomes: IRequestOutcome[]) => ({
      cancelled: outcomes.filter(isCancelledOutcome).length,
      failed: outcomes.filter(
        (outcome) => outcome.kind === 'error' && !isCancelledOutcome(outcome),
      ).length,
      responded: outcomes.filter((outcome) => outcome.kind === 'response')
        .length,
    });

    const requireCancelAcknowledgements = async (
      caseId: IQaCaseId,
      label: string,
      requests: ITrackedRequest[],
    ) => {
      const results = await Promise.all(
        requests.map((request) =>
          waitForSniRequestCancelAck({
            ack: request.cancelAck,
            ensureActive,
            pollIntervalMs: SNAPSHOT_POLL_INTERVAL_MS,
            requestId: request.requestId,
            timeoutMs: SNAPSHOT_TIMEOUT_MS,
          }),
        ),
      );
      const errors = results
        .map(getSniRequestCancelAckError)
        .filter((message): message is string => Boolean(message));
      appendEvidence(
        caseId,
        label,
        errors.length === 0
          ? `${results.length}/${results.length} cancelRequest calls returned success=true`
          : errors.join('; '),
        errors.length === 0 ? 'success' : 'critical',
      );
      requireObservation(
        errors.length === 0,
        `Transport cancellation acknowledgement failed: ${errors.join('; ')}`,
      );
    };

    const requireTransportCancellations = async (
      caseId: IQaCaseId,
      label: string,
      requests: ITrackedRequest[],
    ) => {
      const results = await Promise.all(
        requests.map((request) =>
          waitForSniRequestTransportSettled({
            ensureActive,
            pollIntervalMs: SNAPSHOT_POLL_INTERVAL_MS,
            requestId: request.requestId,
            timeoutMs: SNAPSHOT_TIMEOUT_MS,
            transportSettled: request.transportSettled,
          }),
        ),
      );
      const errors = results
        .map(getSniRequestTransportSettledError)
        .filter((message): message is string => Boolean(message));
      appendEvidence(
        caseId,
        label,
        errors.length === 0
          ? `${results.length}/${results.length} transport promises rejected SNI_CANCELLED`
          : errors.join('; '),
        errors.length === 0 ? 'success' : 'critical',
      );
      requireObservation(
        errors.length === 0,
        `Transport cancellation outcome failed: ${errors.join('; ')}`,
      );
    };

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
      await requireCancelAcknowledgements(
        caseId,
        'Transport cancel acknowledged',
        [request],
      );
      await requireTransportCancellations(
        caseId,
        'Transport cancellation outcome',
        [request],
      );
      await waitForDrain(caseId);
    };

    const runQueuePendingAbort = async (caseId: IQaCaseId) => {
      await prepareCase(caseId);
      const batch = await startSaturatedBatch(caseId);
      abortPendingFirst(batch);
      appendEvidence(
        caseId,
        'Known pending abort signals sent',
        `${QUEUE_TEST_PENDING_COUNT} AbortController signals`,
      );
      const pendingOutcomes = await Promise.all(
        batch.pendingRequests.map((request) => request.outcome),
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
      await requireCancelAcknowledgements(
        caseId,
        'Pending transport cancels acknowledged',
        batch.pendingRequests,
      );
      await requireTransportCancellations(
        caseId,
        'Pending transport outcomes',
        batch.pendingRequests,
      );
      await waitForSnapshot(
        caseId,
        'Pending queue drained',
        (value) => value.pendingRequestsForPair === 0,
      );

      abortActive(batch);
      const allOutcomes = await Promise.all(
        batch.requests.map((request) => request.outcome),
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
      const batch = await startSaturatedBatch(caseId);
      abortPendingFirst(batch);
      abortActive(batch);
      appendEvidence(
        caseId,
        'Abort signals sent',
        `${QUEUE_TEST_PENDING_COUNT} known pending first, then ${QUEUE_TEST_ACTIVE_LIMIT} known active`,
      );
      const outcomes = await Promise.all(
        batch.requests.map((request) => request.outcome),
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
      await requireCancelAcknowledgements(
        caseId,
        'Batch transport cancels acknowledged',
        batch.requests,
      );
      await requireTransportCancellations(
        caseId,
        'Batch transport outcomes',
        batch.requests,
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
            setExpandedEvidenceCaseIds((current) =>
              current.includes(caseId) ? current : [...current, caseId],
            );
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

  const cancelOwnedRequest = useCallback((requestId: string) => {
    controllersRef.current.get(requestId)?.abort();
  }, []);

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
    setExpandedEvidenceCaseIds([]);
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

  const summary = useMemo(() => {
    const selectedResults = selectedCaseIds.map(
      (caseId) => caseResults[caseId],
    );
    return {
      failed: selectedResults.filter((result) => result.status === 'failed')
        .length,
      passed: selectedResults.filter((result) => result.status === 'passed')
        .length,
      stopped: selectedResults.filter((result) => result.status === 'stopped')
        .length,
    };
  }, [caseResults, selectedCaseIds]);

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

  return {
    caseResults,
    cancelOwnedRequest,
    expandedEvidenceCaseIds,
    handleReset,
    handleRun,
    handleStop,
    isRunning,
    items,
    overallBadgeType,
    overallLabel,
    runCompleted,
    selectedCaseIds,
    setCaseSelected,
    setExpandedEvidenceCaseIds,
    setRunCompleted,
    setSelectedCaseIds,
    setTarget,
    snapshot,
    snapshotError,
    summary,
    target,
  };
}

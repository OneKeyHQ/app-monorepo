import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { sniRequest } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import { sniRequestQaAdapter } from '@onekeyhq/shared/src/request/helpers/sniRequestQa';
import { getSniRequestErrorCode } from '@onekeyhq/shared/src/request/helpers/sniRequestQaUtils';
import type {
  ISniRequestCancelSettledResult,
  ISniRequestConfig,
  ISniRequestDebugSnapshot,
  ISniRequestTransportSettledResult,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

export const SNI_QA_ACTIVE_LIMIT = 16;
export const SNI_QA_FIXED_TARGET = {
  ip: '104.18.31.39',
  hostname: 'wallet.onekeytest.com',
  path: '/health',
} as const satisfies Pick<ISniRequestConfig, 'hostname' | 'ip' | 'path'>;

const BURST_20_COUNT = 20;
const BURST_40_COUNT = 40;
const STABILITY_ROUNDS = 3;
const SNAPSHOT_POLL_INTERVAL_MS = 10;
const SNAPSHOT_TIMEOUT_MS = 5000;
const CANCELLATION_OBSERVATION_TIMEOUT_MS = 1000;
const DIAGNOSTIC_TIMEOUT_MS = 2000;

export const QA_CASE_IDS = [
  'health',
  'burst-20',
  'burst-40',
  'active-abort',
  'pending-abort',
  'abort-all-recovery',
  'repeat-40',
] as const;

export type IQaCaseId = (typeof QA_CASE_IDS)[number];
export type IQaCaseStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'not-observed'
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
  index: number;
  outcome: Promise<IRequestOutcome>;
  requestId: string;
  settled: boolean;
  transportSettled: Promise<ISniRequestTransportSettledResult>;
};

type IBatchObservation = {
  peakActive: number;
  peakGlobalActive: number;
  peakPending: number;
  peakGlobalPending: number;
};

type IOutcomeSummary = {
  cancelled: number;
  failed: number;
  responded: number;
};

type ICancellationSummary = {
  ackFalse: number;
  ackMissing: number;
  ackRejected: number;
  ackSuccess: number;
  transportCancelled: number;
  transportFulfilled: number;
  transportMissing: number;
  transportUnexpected: number;
};

export const QA_CASES: readonly IQaCaseDefinition[] = [
  {
    id: 'health',
    title: 'Single /health request',
    description:
      'Performs one real HTTPS request through the SNI transport and validates its HTTP status.',
  },
  {
    id: 'burst-20',
    title: '20 request burst',
    description:
      'Starts 20 requests together, records real limiter peaks, and verifies every request settles without a slot leak.',
  },
  {
    id: 'burst-40',
    title: '40 request burst',
    description:
      'Applies a larger same-target burst and reports the active and pending queue state actually observed.',
  },
  {
    id: 'active-abort',
    title: 'Abort an active request',
    description:
      'Aborts a request ID confirmed active by the native limiter. Fast completion is reported as NOT OBSERVED.',
  },
  {
    id: 'pending-abort',
    title: 'Abort pending requests',
    description:
      'Aborts request IDs confirmed pending by the native limiter and verifies renderer and transport outcomes.',
  },
  {
    id: 'abort-all-recovery',
    title: 'Abort 40 and recover',
    description:
      'Immediately aborts a 40-request burst, records cancellation races, drains the limiter, then sends a recovery request.',
  },
  {
    id: 'repeat-40',
    title: 'Three rounds of 40',
    description:
      'Runs three consecutive 40-request bursts to expose request registry or limiter slot leaks.',
  },
];

function createEmptyCaseResults(): Record<IQaCaseId, IQaCaseResult> {
  return {
    health: { status: 'idle', evidence: [] },
    'burst-20': { status: 'idle', evidence: [] },
    'burst-40': { status: 'idle', evidence: [] },
    'active-abort': { status: 'idle', evidence: [] },
    'pending-abort': { status: 'idle', evidence: [] },
    'abort-all-recovery': { status: 'idle', evidence: [] },
    'repeat-40': { status: 'idle', evidence: [] },
  };
}

class QaRunnerError extends Error {
  constructor(
    message: string,
    readonly kind: 'failed' | 'not-observed' | 'stopped' = 'failed',
  ) {
    super(message);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function summarizeOutcomes(outcomes: IRequestOutcome[]): IOutcomeSummary {
  return {
    cancelled: outcomes.filter(isCancelledOutcome).length,
    failed: outcomes.filter(
      (outcome) => outcome.kind === 'error' && !isCancelledOutcome(outcome),
    ).length,
    responded: outcomes.filter((outcome) => outcome.kind === 'response').length,
  };
}

function formatOutcomeSummary(summary: IOutcomeSummary): string {
  return `responded=${summary.responded}, cancelled=${summary.cancelled}, failed=${summary.failed}`;
}

function requireObservation(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new QaRunnerError(message);
}

function buildRequestConfig({
  caseId,
  requestId,
}: {
  caseId: IQaCaseId;
  requestId: string;
}): ISniRequestConfig {
  return {
    requestId,
    ...SNI_QA_FIXED_TARGET,
    headers: {
      Accept: 'application/json',
      'X-OneKey-SNI-QA': caseId,
    },
    method: 'GET',
    body: null,
    timeout: 15_000,
  };
}

function updatePeak(
  peak: IBatchObservation,
  snapshot: ISniRequestDebugSnapshot,
): void {
  peak.peakActive = Math.max(peak.peakActive, snapshot.activeRequestsForPair);
  peak.peakPending = Math.max(
    peak.peakPending,
    snapshot.pendingRequestsForPair,
  );
  peak.peakGlobalActive = Math.max(
    peak.peakGlobalActive,
    snapshot.activeRequests,
  );
  peak.peakGlobalPending = Math.max(
    peak.peakGlobalPending,
    snapshot.pendingRequests,
  );
}

export function useSniRequestQa() {
  const [caseResults, setCaseResults] = useState<
    Record<IQaCaseId, IQaCaseResult>
  >(createEmptyCaseResults);
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

  const caseStartedAtRef = useRef(new Map<IQaCaseId, number>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const evidenceIdRef = useRef(0);
  const generationRef = useRef(0);
  const stopRequestedRef = useRef(false);

  const updateCaseResult = useCallback(
    (caseId: IQaCaseId, patch: Partial<IQaCaseResult>) => {
      setCaseResults((current) => ({
        ...current,
        [caseId]: { ...current[caseId], ...patch },
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
      evidenceIdRef.current += 1;
      const evidence: IQaEvidence = {
        id: evidenceIdRef.current,
        elapsedMs:
          Date.now() - (caseStartedAtRef.current.get(caseId) ?? Date.now()),
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

  const abortOwnRequests = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
  }, []);

  const handleRun = useCallback(
    async (requestedCaseIds: readonly IQaCaseId[] = QA_CASE_IDS) => {
      if (isRunning || requestedCaseIds.length === 0) return;

      const generation = generationRef.current + 1;
      generationRef.current = generation;
      stopRequestedRef.current = false;
      setIsRunning(true);
      setRunCompleted(false);
      setSnapshotError(undefined);

      const ensureActive = () => {
        if (stopRequestedRef.current || generationRef.current !== generation) {
          throw new QaRunnerError('Stopped by QA', 'stopped');
        }
      };

      const getSnapshot = async () => {
        ensureActive();
        try {
          const next =
            await sniRequestQaAdapter.getDebugSnapshot(SNI_QA_FIXED_TARGET);
          ensureActive();
          setSnapshot(next);
          setSnapshotError(undefined);
          return next;
        } catch (error) {
          const { message } = getErrorDetails(error);
          setSnapshotError(message);
          throw error;
        }
      };

      const waitForDrain = async (
        caseId: IQaCaseId,
        label = 'Limiter drained',
      ) => {
        const deadline = Date.now() + SNAPSHOT_TIMEOUT_MS;
        for (;;) {
          const current = await getSnapshot();
          if (
            current.activeRequestsForPair === 0 &&
            current.pendingRequestsForPair === 0
          ) {
            appendEvidence(caseId, label, formatSnapshot(current), 'success');
            return;
          }
          if (Date.now() >= deadline) {
            throw new QaRunnerError(
              `${label} timed out: ${formatSnapshot(current)}`,
            );
          }
          await delay(SNAPSHOT_POLL_INTERVAL_MS);
        }
      };

      const prepareCase = async (caseId: IQaCaseId) => {
        setItems([]);
        await waitForDrain(caseId, 'Initial limiter state');
        appendEvidence(
          caseId,
          'Fixed target',
          `${SNI_QA_FIXED_TARGET.hostname} (${SNI_QA_FIXED_TARGET.ip})${SNI_QA_FIXED_TARGET.path}`,
        );
      };

      const updateBatchItem = (
        index: number,
        patch: Partial<IQueueRequestItem>,
      ) => {
        if (generationRef.current !== generation) return;
        setItems((current) =>
          current.map((item) =>
            item.index === index ? { ...item, ...patch } : item,
          ),
        );
      };

      const startRequest = ({
        caseId,
        index,
        phase,
      }: {
        caseId: IQaCaseId;
        index: number;
        phase: string;
      }): ITrackedRequest => {
        const requestId = `qa-sni-${caseId}-${generation}-${phase}-${index}`;
        const controller = new AbortController();
        controllersRef.current.set(requestId, controller);

        let resolveCancelAck!: (value: ISniRequestCancelSettledResult) => void;
        const cancelAck = new Promise<ISniRequestCancelSettledResult>(
          (resolve) => {
            resolveCancelAck = resolve;
          },
        );
        let resolveTransportSettled!: (
          value: ISniRequestTransportSettledResult,
        ) => void;
        const transportSettled = new Promise<ISniRequestTransportSettledResult>(
          (resolve) => {
            resolveTransportSettled = resolve;
          },
        );

        const tracked: ITrackedRequest = {
          cancelAck,
          controller,
          index,
          outcome: Promise.resolve({
            kind: 'error',
            code: 'SNI_QA_NOT_STARTED',
            message: 'Request was not started',
          }),
          requestId,
          settled: false,
          transportSettled,
        };

        tracked.outcome = sniRequest(
          buildRequestConfig({ caseId, requestId }),
          {
            signal: controller.signal,
            onCancelSettled: resolveCancelAck,
            onTransportSettled: resolveTransportSettled,
          },
        )
          .then((response): IRequestOutcome => {
            if (!isValidResponse(response)) {
              updateBatchItem(index, {
                status: 'failed',
                detail: 'Transport returned no valid HTTP response',
              });
              return {
                kind: 'error',
                code: 'SNI_INVALID_RESPONSE',
                message: 'Transport returned no valid HTTP response',
              };
            }
            updateBatchItem(index, {
              status: 'succeeded',
              detail: `HTTP ${response.statusCode}`,
            });
            return { kind: 'response', statusCode: response.statusCode };
          })
          .catch((error: unknown): IRequestOutcome => {
            const { code, message } = getErrorDetails(error);
            updateBatchItem(index, {
              status: code === 'SNI_CANCELLED' ? 'cancelled' : 'failed',
              detail: code || message,
            });
            return { kind: 'error', code, message };
          })
          .finally(() => {
            tracked.settled = true;
            controllersRef.current.delete(requestId);
          });

        return tracked;
      };

      const startBatch = (caseId: IQaCaseId, count: number, phase: string) => {
        setItems(
          Array.from({ length: count }, (_, index) => ({
            index,
            requestId: `qa-sni-${caseId}-${generation}-${phase}-${index}`,
            status: 'starting' as const,
            detail: 'Waiting for the real transport outcome',
          })),
        );
        return Array.from({ length: count }, (_, index) =>
          startRequest({ caseId, index, phase }),
        );
      };

      const observeBatch = async (
        caseId: IQaCaseId,
        requests: ITrackedRequest[],
      ) => {
        const peak: IBatchObservation = {
          peakActive: 0,
          peakGlobalActive: 0,
          peakPending: 0,
          peakGlobalPending: 0,
        };
        while (requests.some((request) => !request.settled)) {
          const current = await getSnapshot();
          updatePeak(peak, current);
          if (current.activeRequestIdsForPair) {
            const activeIds = new Set(current.activeRequestIdsForPair);
            const pendingIds = new Set(current.pendingRequestIdsForPair ?? []);
            requests.forEach((request) => {
              if (activeIds.has(request.requestId)) {
                updateBatchItem(request.index, {
                  status: 'active',
                  detail: 'Observed active by the native limiter',
                });
              } else if (pendingIds.has(request.requestId)) {
                updateBatchItem(request.index, {
                  status: 'queued',
                  detail: 'Observed pending by the native limiter',
                });
              }
            });
          }
          await delay(SNAPSHOT_POLL_INTERVAL_MS);
        }
        const outcomes = await Promise.all(
          requests.map((request) => request.outcome),
        );
        const finalSnapshot = await getSnapshot();
        updatePeak(peak, finalSnapshot);
        appendEvidence(
          caseId,
          'Observed limiter peaks',
          `pair active=${peak.peakActive}, pending=${peak.peakPending}; global active=${peak.peakGlobalActive}, pending=${peak.peakGlobalPending}`,
          peak.peakPending > 0 ? 'success' : 'info',
        );
        requireObservation(
          peak.peakActive <= SNI_QA_ACTIVE_LIMIT,
          `Pair active limit exceeded: observed ${peak.peakActive}, limit ${SNI_QA_ACTIVE_LIMIT}`,
        );
        requireObservation(
          peak.peakGlobalActive <= 64,
          `Global active limit exceeded: observed ${peak.peakGlobalActive}, limit 64`,
        );
        return { outcomes, peak };
      };

      const waitForOwnedRequestIds = async (
        requests: ITrackedRequest[],
        state: 'active' | 'pending',
      ): Promise<ITrackedRequest[]> => {
        const deadline = Date.now() + CANCELLATION_OBSERVATION_TIMEOUT_MS;
        const requestsById = new Map(
          requests.map((request) => [request.requestId, request]),
        );
        while (
          Date.now() < deadline &&
          requests.some((request) => !request.settled)
        ) {
          const current = await getSnapshot();
          const ids =
            state === 'active'
              ? current.activeRequestIdsForPair
              : current.pendingRequestIdsForPair;
          const owned = (ids ?? [])
            .map((requestId) => requestsById.get(requestId))
            .filter((request): request is ITrackedRequest => Boolean(request));
          if (owned.length > 0) return owned;
          await delay(SNAPSHOT_POLL_INTERVAL_MS);
        }
        return [];
      };

      const getCancellationSummary = async (
        requests: ITrackedRequest[],
      ): Promise<ICancellationSummary> => {
        const withTimeout = async <T>(promise: Promise<T>) =>
          Promise.race([
            promise.then((value) => ({ kind: 'result' as const, value })),
            delay(DIAGNOSTIC_TIMEOUT_MS).then(() => ({
              kind: 'timeout' as const,
            })),
          ]);
        const [acknowledgements, transportResults] = await Promise.all([
          Promise.all(
            requests.map((request) => withTimeout(request.cancelAck)),
          ),
          Promise.all(
            requests.map((request) => withTimeout(request.transportSettled)),
          ),
        ]);
        return {
          ackFalse: acknowledgements.filter(
            (result) =>
              result.kind === 'result' &&
              result.value.status === 'fulfilled' &&
              !result.value.success,
          ).length,
          ackMissing: acknowledgements.filter(
            (result) => result.kind === 'timeout',
          ).length,
          ackRejected: acknowledgements.filter(
            (result) =>
              result.kind === 'result' && result.value.status === 'rejected',
          ).length,
          ackSuccess: acknowledgements.filter(
            (result) =>
              result.kind === 'result' &&
              result.value.status === 'fulfilled' &&
              result.value.success,
          ).length,
          transportCancelled: transportResults.filter(
            (result) =>
              result.kind === 'result' &&
              result.value.status === 'rejected' &&
              getSniRequestErrorCode(result.value.error) === 'SNI_CANCELLED',
          ).length,
          transportFulfilled: transportResults.filter(
            (result) =>
              result.kind === 'result' && result.value.status === 'fulfilled',
          ).length,
          transportMissing: transportResults.filter(
            (result) => result.kind === 'timeout',
          ).length,
          transportUnexpected: transportResults.filter(
            (result) =>
              result.kind === 'result' &&
              result.value.status === 'rejected' &&
              getSniRequestErrorCode(result.value.error) !== 'SNI_CANCELLED',
          ).length,
        };
      };

      const appendCancellationEvidence = (
        caseId: IQaCaseId,
        summary: ICancellationSummary,
      ) => {
        appendEvidence(
          caseId,
          'cancelRequest acknowledgements',
          `success=${summary.ackSuccess}, already-finished=${summary.ackFalse}, missing=${summary.ackMissing}, rejected=${summary.ackRejected}`,
          summary.ackRejected > 0 ? 'critical' : 'info',
        );
        appendEvidence(
          caseId,
          'Raw transport outcomes',
          `SNI_CANCELLED=${summary.transportCancelled}, fulfilled-before-cancel=${summary.transportFulfilled}, missing=${summary.transportMissing}, unexpected=${summary.transportUnexpected}`,
          summary.transportUnexpected > 0 ? 'critical' : 'info',
        );
        requireObservation(
          summary.ackRejected === 0,
          `${summary.ackRejected} cancelRequest acknowledgements rejected`,
        );
        requireObservation(
          summary.transportUnexpected === 0,
          `${summary.transportUnexpected} transports rejected with an unexpected error`,
        );
      };

      const runHealth = async (caseId: IQaCaseId) => {
        await prepareCase(caseId);
        const request = startRequest({ caseId, index: 0, phase: 'health' });
        const outcome = await request.outcome;
        requireObservation(
          outcome.kind === 'response',
          `Expected a real HTTPS response, got ${
            outcome.kind === 'error'
              ? outcome.code || outcome.message
              : 'unknown'
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

      const runBurst = async (
        caseId: IQaCaseId,
        count: number,
        phase: string,
      ) => {
        await prepareCase(caseId);
        const requests = startBatch(caseId, count, phase);
        const { outcomes } = await observeBatch(caseId, requests);
        const summary = summarizeOutcomes(outcomes);
        appendEvidence(
          caseId,
          'Renderer outcomes',
          formatOutcomeSummary(summary),
          summary.responded === count ? 'success' : 'critical',
        );
        requireObservation(
          summary.responded === count,
          `Expected ${count} HTTP responses; ${formatOutcomeSummary(summary)}`,
        );
        await waitForDrain(caseId);
      };

      const runAbortObserved = async (
        caseId: IQaCaseId,
        state: 'active' | 'pending',
      ) => {
        await prepareCase(caseId);
        const requests = startBatch(caseId, BURST_40_COUNT, state);
        const observed = await waitForOwnedRequestIds(requests, state);
        if (observed.length === 0) {
          const outcomes = await Promise.all(
            requests.map((request) => request.outcome),
          );
          appendEvidence(
            caseId,
            `${state} state not observed`,
            `The fixed /health endpoint completed before a QA-owned ${state} request ID was visible. ${formatOutcomeSummary(
              summarizeOutcomes(outcomes),
            )}`,
          );
          await waitForDrain(caseId);
          throw new QaRunnerError(
            `No QA-owned ${state} request remained observable long enough to cancel`,
            'not-observed',
          );
        }

        const targets = state === 'active' ? observed.slice(0, 1) : observed;
        targets.forEach((request) => {
          updateBatchItem(request.index, {
            status: state === 'active' ? 'active' : 'queued',
            detail: `Confirmed ${state}; AbortController signal sent`,
          });
          request.controller.abort();
        });
        appendEvidence(
          caseId,
          'Abort signals sent',
          `${targets.length} snapshot-confirmed ${state} request ID(s)`,
        );

        const outcomes = await Promise.all(
          requests.map((request) => request.outcome),
        );
        const targetOutcomes = await Promise.all(
          targets.map((request) => request.outcome),
        );
        const targetSummary = summarizeOutcomes(targetOutcomes);
        appendEvidence(
          caseId,
          'Target renderer outcomes',
          formatOutcomeSummary(targetSummary),
          targetSummary.cancelled === targets.length ? 'success' : 'critical',
        );
        requireObservation(
          targetSummary.cancelled === targets.length,
          `AbortController did not cancel every selected renderer request: ${formatOutcomeSummary(
            targetSummary,
          )}`,
        );
        const cancellationSummary = await getCancellationSummary(targets);
        appendCancellationEvidence(caseId, cancellationSummary);
        appendEvidence(
          caseId,
          'Whole batch outcomes',
          formatOutcomeSummary(summarizeOutcomes(outcomes)),
        );
        await waitForDrain(caseId);

        if (
          cancellationSummary.ackSuccess !== targets.length ||
          cancellationSummary.transportCancelled !== targets.length ||
          cancellationSummary.ackMissing > 0 ||
          cancellationSummary.transportMissing > 0
        ) {
          throw new QaRunnerError(
            'The request completed during the bridge cancellation race; renderer abort worked but transport termination was not fully observed',
            'not-observed',
          );
        }
      };

      const runAbortAllRecovery = async (caseId: IQaCaseId) => {
        await prepareCase(caseId);
        const requests = startBatch(caseId, BURST_40_COUNT, 'abort-all');
        requests.forEach((request) => request.controller.abort());
        appendEvidence(
          caseId,
          'Abort signals sent',
          `${BURST_40_COUNT} AbortController signals in the launch tick`,
        );
        const outcomes = await Promise.all(
          requests.map((request) => request.outcome),
        );
        const summary = summarizeOutcomes(outcomes);
        appendEvidence(
          caseId,
          'Renderer outcomes',
          formatOutcomeSummary(summary),
          summary.cancelled === BURST_40_COUNT ? 'success' : 'critical',
        );
        requireObservation(
          summary.cancelled === BURST_40_COUNT,
          `Expected ${BURST_40_COUNT} renderer cancellations; ${formatOutcomeSummary(
            summary,
          )}`,
        );
        const cancellationSummary = await getCancellationSummary(requests);
        appendCancellationEvidence(caseId, cancellationSummary);
        await waitForDrain(caseId, 'Limiter drained after abort all');

        const recovery = startRequest({
          caseId,
          index: BURST_40_COUNT,
          phase: 'recovery',
        });
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

        if (cancellationSummary.transportCancelled === 0) {
          throw new QaRunnerError(
            'All transports completed before native cancellation took effect; recovery passed but transport termination was not observed',
            'not-observed',
          );
        }
      };

      const runRepeat40 = async (caseId: IQaCaseId) => {
        await prepareCase(caseId);
        for (let round = 1; round <= STABILITY_ROUNDS; round += 1) {
          ensureActive();
          const requests = startBatch(caseId, BURST_40_COUNT, `round-${round}`);
          const { outcomes, peak } = await observeBatch(caseId, requests);
          const summary = summarizeOutcomes(outcomes);
          appendEvidence(
            caseId,
            `Round ${round}`,
            `${formatOutcomeSummary(summary)}; peak active=${
              peak.peakActive
            }, pending=${peak.peakPending}`,
            summary.responded === BURST_40_COUNT ? 'success' : 'critical',
          );
          requireObservation(
            summary.responded === BURST_40_COUNT,
            `Round ${round} did not complete ${BURST_40_COUNT} responses: ${formatOutcomeSummary(
              summary,
            )}`,
          );
          await waitForDrain(caseId, `Round ${round} limiter drained`);
        }
      };

      const runCase = async (caseId: IQaCaseId) => {
        if (caseId === 'health') return runHealth(caseId);
        if (caseId === 'burst-20') {
          return runBurst(caseId, BURST_20_COUNT, 'burst-20');
        }
        if (caseId === 'burst-40') {
          return runBurst(caseId, BURST_40_COUNT, 'burst-40');
        }
        if (caseId === 'active-abort') {
          return runAbortObserved(caseId, 'active');
        }
        if (caseId === 'pending-abort') {
          return runAbortObserved(caseId, 'pending');
        }
        if (caseId === 'abort-all-recovery') {
          return runAbortAllRecovery(caseId);
        }
        return runRepeat40(caseId);
      };

      let stopped = false;
      for (const caseId of requestedCaseIds) {
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
            updateCaseResult(caseId, {
              status: 'passed',
              durationMs:
                Date.now() -
                (caseStartedAtRef.current.get(caseId) ?? Date.now()),
            });
          } catch (error) {
            const durationMs =
              Date.now() - (caseStartedAtRef.current.get(caseId) ?? Date.now());
            if (
              (error instanceof QaRunnerError && error.kind === 'stopped') ||
              stopRequestedRef.current
            ) {
              stopped = true;
              updateCaseResult(caseId, {
                status: 'stopped',
                durationMs,
                error: error instanceof Error ? error.message : 'Stopped by QA',
              });
            } else if (
              error instanceof QaRunnerError &&
              error.kind === 'not-observed'
            ) {
              appendEvidence(caseId, 'Not observed', error.message);
              updateCaseResult(caseId, {
                status: 'not-observed',
                durationMs,
                error: error.message,
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
    },
    [abortOwnRequests, appendEvidence, isRunning, updateCaseResult],
  );

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
    setCaseResults(createEmptyCaseResults());
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
    const results = QA_CASE_IDS.map((caseId) => caseResults[caseId]);
    return {
      failed: results.filter((result) => result.status === 'failed').length,
      notObserved: results.filter((result) => result.status === 'not-observed')
        .length,
      passed: results.filter((result) => result.status === 'passed').length,
      stopped: results.filter((result) => result.status === 'stopped').length,
    };
  }, [caseResults]);

  let overallLabel = 'READY';
  let overallBadgeType:
    | 'critical'
    | 'default'
    | 'info'
    | 'success'
    | 'warning' = 'default';
  if (isRunning) {
    overallLabel = 'RUNNING';
    overallBadgeType = 'info';
  } else if (runCompleted && summary.failed > 0) {
    overallLabel = 'FAIL';
    overallBadgeType = 'critical';
  } else if (runCompleted && summary.stopped > 0) {
    overallLabel = 'STOPPED';
  } else if (runCompleted && summary.notObserved > 0) {
    overallLabel = 'PARTIAL';
    overallBadgeType = 'warning';
  } else if (runCompleted) {
    overallLabel = 'PASS';
    overallBadgeType = 'success';
  }

  return {
    cancelOwnedRequest,
    caseResults,
    expandedEvidenceCaseIds,
    handleReset,
    handleRun,
    handleStop,
    isRunning,
    items,
    overallBadgeType,
    overallLabel,
    runCompleted,
    setExpandedEvidenceCaseIds,
    snapshot,
    snapshotError,
    summary,
  };
}

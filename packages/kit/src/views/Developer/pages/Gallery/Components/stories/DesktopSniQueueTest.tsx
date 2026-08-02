import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Badge,
  Button,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { sniRequest } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import type {
  ISniRequestConfig,
  ISniRequestDebugSnapshot,
} from '@onekeyhq/shared/src/request/types/ipTable';

const QUEUE_TEST_REQUEST_COUNT = 20;
const QUEUE_TEST_ACTIVE_LIMIT = 16;
const QUEUE_TEST_PENDING_COUNT =
  QUEUE_TEST_REQUEST_COUNT - QUEUE_TEST_ACTIVE_LIMIT;
const QUEUE_SNAPSHOT_POLL_INTERVAL_MS = 50;

type IQueueRequestStatus =
  | 'starting'
  | 'active'
  | 'queued'
  | 'succeeded'
  | 'cancelled'
  | 'failed';

type IQueueRequestItem = {
  index: number;
  requestId: string;
  status: IQueueRequestStatus;
  detail?: string;
};

type IQueueTarget = Pick<ISniRequestConfig, 'hostname' | 'ip' | 'path'>;

const DEFAULT_QUEUE_TARGET: IQueueTarget = {
  ip: '104.18.31.39',
  hostname: 'wallet.onekeytest.com',
  path: '/wallet/v1/health',
};

const ACTIVE_REQUEST_STATUSES = new Set<IQueueRequestStatus>([
  'starting',
  'active',
  'queued',
]);

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

function getStatusBadgeType(
  status: IQueueRequestStatus,
): 'critical' | 'default' | 'info' | 'success' | 'warning' {
  if (status === 'active') return 'info';
  if (status === 'queued') return 'warning';
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'critical';
  return 'default';
}

function normalizeTarget(target: IQueueTarget): IQueueTarget {
  return {
    hostname: target.hostname.trim(),
    ip: target.ip.trim(),
    path: target.path.trim(),
  };
}

export function DesktopSniQueueTest() {
  const [target, setTarget] = useState<IQueueTarget>(DEFAULT_QUEUE_TARGET);
  const [items, setItems] = useState<IQueueRequestItem[]>([]);
  const [snapshot, setSnapshot] = useState<ISniRequestDebugSnapshot | null>(
    null,
  );
  const [snapshotError, setSnapshotError] = useState<string>();
  const [queueObserved, setQueueObserved] = useState(false);
  const controllersRef = useRef(new Map<number, AbortController>());
  const generationRef = useRef(0);
  const queueObservedRef = useRef(false);
  const runActiveRef = useRef(false);
  const snapshotInFlightRef = useRef(false);
  const activeTargetRef = useRef<IQueueTarget>(DEFAULT_QUEUE_TARGET);

  const updateItem = useCallback(
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

  const cancelQueuedRequests = useCallback(() => {
    for (
      let index = QUEUE_TEST_ACTIVE_LIMIT;
      index < QUEUE_TEST_REQUEST_COUNT;
      index += 1
    ) {
      controllersRef.current.get(index)?.abort();
    }
  }, []);

  const cancelAllRequests = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (snapshotInFlightRef.current || !runActiveRef.current) return;
    const generation = generationRef.current;
    const sniRequestProxy = globalThis.desktopApiProxy?.sniRequest;
    if (typeof sniRequestProxy?.getDebugSnapshot !== 'function') {
      setSnapshotError('Desktop SNI debug snapshot is unavailable');
      return;
    }

    snapshotInFlightRef.current = true;
    try {
      const nextSnapshot = await sniRequestProxy.getDebugSnapshot(
        activeTargetRef.current,
      );
      if (generationRef.current !== generation) return;
      setSnapshot(nextSnapshot);
      setSnapshotError(undefined);

      if (
        !queueObservedRef.current &&
        nextSnapshot.activeRequestsForPair === QUEUE_TEST_ACTIVE_LIMIT &&
        nextSnapshot.pendingRequestsForPair === QUEUE_TEST_PENDING_COUNT
      ) {
        queueObservedRef.current = true;
        setQueueObserved(true);
        setItems((current) =>
          current.map((item) => {
            if (item.status !== 'starting') return item;
            return {
              ...item,
              status:
                item.index < QUEUE_TEST_ACTIVE_LIMIT ? 'active' : 'queued',
            };
          }),
        );
        cancelQueuedRequests();
      }
    } catch (error) {
      if (generationRef.current === generation) {
        setSnapshotError(getErrorDetails(error).message);
      }
    } finally {
      snapshotInFlightRef.current = false;
    }
  }, [cancelQueuedRequests]);

  const handleRun = useCallback(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    cancelAllRequests();
    controllersRef.current.clear();
    queueObservedRef.current = false;
    runActiveRef.current = true;
    setQueueObserved(false);
    setSnapshot(null);
    setSnapshotError(undefined);

    const requestTarget = normalizeTarget(target);
    activeTargetRef.current = requestTarget;
    const runId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const nextItems = Array.from(
      { length: QUEUE_TEST_REQUEST_COUNT },
      (_, index): IQueueRequestItem => ({
        index,
        requestId: `qa-sni-queue-${runId}-${index}`,
        status: 'starting',
      }),
    );
    setItems(nextItems);

    nextItems.forEach((item) => {
      const controller = new AbortController();
      controllersRef.current.set(item.index, controller);
      const pathSeparator = requestTarget.path.includes('?') ? '&' : '?';
      void sniRequest(
        {
          requestId: item.requestId,
          ip: requestTarget.ip,
          hostname: requestTarget.hostname,
          path: `${requestTarget.path}${pathSeparator}qaSniQueue=${runId}-${item.index}`,
          headers: {
            Accept: 'application/json',
            'X-OneKey-SNI-QA': 'queue-test',
          },
          method: 'GET',
          body: null,
          timeout: 30_000,
        },
        { signal: controller.signal },
      )
        .then((response) => {
          updateItem(generation, item.index, {
            status: response ? 'succeeded' : 'failed',
            detail: response
              ? `HTTP ${response.statusCode}`
              : 'SNI response unavailable',
          });
        })
        .catch((error: unknown) => {
          const { code, message } = getErrorDetails(error);
          updateItem(generation, item.index, {
            status:
              code === 'SNI_CANCELLED' || controller.signal.aborted
                ? 'cancelled'
                : 'failed',
            detail: code || message,
          });
        })
        .finally(() => {
          if (generationRef.current === generation) {
            controllersRef.current.delete(item.index);
            void refreshSnapshot();
          }
        });
    });

    setTimeout(() => {
      if (generationRef.current === generation) {
        void refreshSnapshot();
      }
    }, 0);
  }, [cancelAllRequests, refreshSnapshot, target, updateItem]);

  const handleReset = useCallback(() => {
    generationRef.current += 1;
    runActiveRef.current = false;
    cancelAllRequests();
    controllersRef.current.clear();
    queueObservedRef.current = false;
    setQueueObserved(false);
    setSnapshot(null);
    setSnapshotError(undefined);
    setItems([]);
  }, [cancelAllRequests]);

  const hasUnsettledRequests = items.some((item) =>
    ACTIVE_REQUEST_STATUSES.has(item.status),
  );

  useEffect(
    () => () => {
      generationRef.current += 1;
      runActiveRef.current = false;
      controllersRef.current.forEach((controller) => controller.abort());
      controllersRef.current.clear();
    },
    [],
  );

  const counts = useMemo(
    () => ({
      succeeded: items.filter((item) => item.status === 'succeeded').length,
      cancelled: items.filter((item) => item.status === 'cancelled').length,
      failed: items.filter((item) => item.status === 'failed').length,
      settled: items.filter((item) => !ACTIVE_REQUEST_STATUSES.has(item.status))
        .length,
      queuedCancelled: items
        .slice(QUEUE_TEST_ACTIVE_LIMIT)
        .filter((item) => item.status === 'cancelled').length,
    }),
    [items],
  );
  const queuePassed =
    queueObserved &&
    counts.queuedCancelled === QUEUE_TEST_PENDING_COUNT &&
    counts.settled === QUEUE_TEST_REQUEST_COUNT &&
    snapshot?.activeRequestsForPair === 0 &&
    snapshot.pendingRequestsForPair === 0;
  const allRequestsSettled =
    items.length === QUEUE_TEST_REQUEST_COUNT &&
    counts.settled === QUEUE_TEST_REQUEST_COUNT;
  const mainRequestPairDrained =
    snapshot?.activeRequestsForPair === 0 &&
    snapshot.pendingRequestsForPair === 0;
  const testFinished =
    allRequestsSettled &&
    (mainRequestPairDrained || snapshotError !== undefined);
  const testRunning = items.length > 0 && !testFinished;
  let resultBadgeType: 'critical' | 'default' | 'success' = 'default';
  let resultLabel = 'RUNNING';
  if (queuePassed) {
    resultBadgeType = 'success';
    resultLabel = 'PASS';
  } else if (testFinished) {
    resultBadgeType = 'critical';
    resultLabel = 'FAIL';
  }

  useEffect(() => {
    runActiveRef.current = testRunning;
    if (!testRunning) return undefined;
    void refreshSnapshot();
    const intervalId = setInterval(() => {
      void refreshSnapshot();
    }, QUEUE_SNAPSHOT_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [refreshSnapshot, testRunning]);

  return (
    <Stack gap="$4" testID="desktop-sni-queue-panel">
      <XStack gap="$3" flexWrap="wrap">
        <Stack gap="$1" flex={1} minWidth={160}>
          <SizableText size="$bodySm" color="$textSubdued">
            IP
          </SizableText>
          <Input
            value={target.ip}
            onChangeText={(ip) => setTarget((current) => ({ ...current, ip }))}
            disabled={hasUnsettledRequests}
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
            disabled={hasUnsettledRequests}
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
            disabled={hasUnsettledRequests}
            autoCapitalize="none"
          />
        </Stack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap" alignItems="center">
        <Button
          variant="primary"
          onPress={handleRun}
          disabled={testRunning}
          testID="desktop-sni-queue-run"
        >
          Run 20-request queue test
        </Button>
        <Button
          variant="destructive"
          onPress={cancelAllRequests}
          disabled={!hasUnsettledRequests}
          testID="desktop-sni-queue-cancel-all"
        >
          Cancel all
        </Button>
        <Button variant="secondary" onPress={handleReset}>
          Reset
        </Button>
        {items.length > 0 ? (
          <Badge
            testID="desktop-sni-queue-result"
            badgeType={resultBadgeType}
            badgeSize="lg"
          >
            <Badge.Text>{resultLabel}</Badge.Text>
          </Badge>
        ) : null}
      </XStack>

      <XStack gap="$5" flexWrap="wrap">
        <Stack minWidth={110}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Main active
          </SizableText>
          <SizableText size="$headingLg" testID="desktop-sni-main-active">
            {snapshot?.activeRequestsForPair ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={110}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Main pending
          </SizableText>
          <SizableText size="$headingLg" testID="desktop-sni-main-pending">
            {snapshot?.pendingRequestsForPair ?? '-'}
          </SizableText>
        </Stack>
        <Stack minWidth={110}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Succeeded
          </SizableText>
          <SizableText size="$headingLg">{counts.succeeded}</SizableText>
        </Stack>
        <Stack minWidth={110}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Cancelled
          </SizableText>
          <SizableText size="$headingLg">{counts.cancelled}</SizableText>
        </Stack>
        <Stack minWidth={110}>
          <SizableText size="$bodyXs" color="$textSubdued">
            Failed
          </SizableText>
          <SizableText size="$headingLg">{counts.failed}</SizableText>
        </Stack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <Badge badgeType={queueObserved ? 'success' : 'default'} badgeSize="sm">
          <Badge.Text>
            {queueObserved ? '16 active + 4 pending observed' : 'Queue pending'}
          </Badge.Text>
        </Badge>
        <Badge
          badgeType={
            counts.queuedCancelled === QUEUE_TEST_PENDING_COUNT
              ? 'success'
              : 'default'
          }
          badgeSize="sm"
        >
          <Badge.Text>
            Queued cancelled {counts.queuedCancelled}/{QUEUE_TEST_PENDING_COUNT}
          </Badge.Text>
        </Badge>
      </XStack>

      {snapshotError ? (
        <SizableText color="$textCritical" size="$bodySm">
          {snapshotError}
        </SizableText>
      ) : null}

      {items.length > 0 ? (
        <Stack borderTopWidth={1} borderColor="$borderSubdued">
          {items.map((item) => {
            const canCancel = ACTIVE_REQUEST_STATUSES.has(item.status);
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
                  badgeType={getStatusBadgeType(item.status)}
                  badgeSize="sm"
                >
                  <Badge.Text>{item.status}</Badge.Text>
                </Badge>
                <SizableText
                  flex={1}
                  minWidth={0}
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {item.detail ?? item.requestId}
                </SizableText>
                <Button
                  size="small"
                  variant="tertiary"
                  disabled={!canCancel}
                  onPress={() =>
                    controllersRef.current.get(item.index)?.abort()
                  }
                >
                  Cancel
                </Button>
              </XStack>
            );
          })}
        </Stack>
      ) : null}
    </Stack>
  );
}

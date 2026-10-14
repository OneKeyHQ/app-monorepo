import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  ISwapReviewAnalyticsContext,
  ISwapReviewClose,
  ISwapReviewCloseReason,
  ISwapReviewConfirm,
  ISwapReviewOpen,
  ISwapReviewReady,
  ISwapReviewStage,
} from '@onekeyhq/shared/types/swap/reviewAnalytics';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

import { getSwapExecutionTypeFromQuoteResult } from './swapTypeUtils';

function now() {
  return globalThis.performance?.now() ?? Date.now();
}

function duration(start: number, end: number) {
  return Math.max(0, Math.round(end - start));
}

export function getSwapReviewErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message.slice(0, 300);
  }
  return 'Unknown error';
}

export function getSwapReviewOrderId(swapInfo?: ISwapTxInfo) {
  return swapInfo?.reviewAnalyticsContext
    ? swapInfo.reviewAnalyticsContext.orderId
    : swapInfo?.swapBuildResData.orderId;
}

export type ISwapReviewPreparation = {
  timings: Partial<Record<`${ISwapReviewStage}Ms`, number>>;
  failedStage?: ISwapReviewStage;
  message?: string;
  fail: (stage: ISwapReviewStage, error: unknown) => void;
  measure: <T>(stage: ISwapReviewStage, action: () => Promise<T>) => Promise<T>;
};

export function measureSwapReviewStage<T>(
  preparation: ISwapReviewPreparation | undefined,
  stage: ISwapReviewStage,
  action: () => Promise<T>,
): Promise<T> {
  return preparation ? preparation.measure(stage, action) : action();
}

type ISwapReviewLogger = {
  swapReviewOpen: (params: ISwapReviewOpen) => void;
  swapReviewReady: (params: ISwapReviewReady) => void;
  swapReviewConfirm: (params: ISwapReviewConfirm) => void;
  swapReviewClose: (params: ISwapReviewClose) => void;
};

function safelyLogSwapReview(action: () => void) {
  try {
    action();
  } catch {
    // Telemetry failures must not interrupt review actions or cleanup.
  }
}

/** UI-runtime session; only context() is passed across the background bridge. */
export function createSwapReviewAnalytics({
  clock = now,
  reviewSessionId = generateUUID(),
  logger = defaultLogger.swap.swapReview,
}: {
  clock?: () => number;
  reviewSessionId?: string;
  logger?: ISwapReviewLogger;
} = {}) {
  const clickedAt = clock();
  let openedAt: number | undefined;
  let readyAt: number | undefined;
  let closed = false;
  let confirmed = false;
  let readyReported = false;
  let supportsPreBuild = false;
  let closeStage: ISwapReviewClose['closeStage'] = 'loading';
  let preparation: ISwapReviewPreparation | undefined;
  let identity: ISwapReviewAnalyticsContext = { reviewSessionId };
  let orderId: string | undefined;

  return {
    isConfirmed() {
      return confirmed;
    },
    context(quoteId?: string): ISwapReviewAnalyticsContext {
      return { reviewSessionId, quoteId: quoteId ?? identity.quoteId };
    },
    open(params: Omit<ISwapReviewOpen, 'reviewSessionId' | 'openDelayMs'>) {
      if (closed || openedAt !== undefined) return;
      const currentOpenedAt = clock();
      openedAt = currentOpenedAt;
      supportsPreBuild = params.supportPreBuild;
      identity = { reviewSessionId, quoteId: params.quoteId };
      safelyLogSwapReview(() => {
        logger.swapReviewOpen({
          ...params,
          ...identity,
          openDelayMs: duration(clickedAt, currentOpenedAt),
        });
      });
    },
    beginPreparation(): ISwapReviewPreparation | undefined {
      // Before-open Market work belongs to openDelayMs, not totalMs.
      if (
        closed ||
        openedAt === undefined ||
        !supportsPreBuild ||
        preparation ||
        readyReported
      ) {
        return undefined;
      }
      const stageIntervals: Partial<
        Record<ISwapReviewStage, [number, number][]>
      > = {};
      const result: ISwapReviewPreparation = {
        timings: {},
        fail(stage, error) {
          result.failedStage ??= stage;
          result.message ??= getSwapReviewErrorMessage(error);
        },
        async measure<T>(stage: ISwapReviewStage, action: () => Promise<T>) {
          const startedAt = clock();
          try {
            return await action();
          } catch (error) {
            result.fail(stage, error);
            throw error;
          } finally {
            // Concurrent and nested work in one stage contributes wall time once.
            const intervals = stageIntervals[stage] ?? [];
            intervals.push([startedAt, Math.max(startedAt, clock())]);
            intervals.sort(([left], [right]) => left - right);
            stageIntervals[stage] = intervals;
            let elapsed = 0;
            let previousEnd = Number.NEGATIVE_INFINITY;
            for (const [start, end] of intervals) {
              elapsed += Math.max(0, end - Math.max(start, previousEnd));
              previousEnd = Math.max(previousEnd, end);
            }
            const key = `${stage}Ms` as const;
            result.timings[key] = Math.round(elapsed);
          }
        },
      };
      preparation = result;
      return result;
    },
    observe({
      ready,
      error,
      loading,
      fallback,
      supportPreBuild,
      quoteId,
      orderId: currentOrderId,
    }: {
      ready: boolean;
      error: boolean;
      loading: boolean;
      fallback: boolean;
      supportPreBuild: boolean;
      quoteId?: string;
      orderId?: string;
    }) {
      const currentOpenedAt = openedAt;
      if (closed || currentOpenedAt === undefined) return;
      identity = { reviewSessionId, quoteId };
      orderId = currentOrderId;
      if (error) {
        closeStage = 'error';
      } else if (loading) {
        closeStage = 'loading';
      } else if (ready || readyAt !== undefined) {
        closeStage = 'ready';
      }
      if (ready && !loading && !error && readyAt === undefined) {
        readyAt = clock();
      }
      if (readyReported || loading || (!ready && !error)) return;
      readyReported = true;
      let status: ISwapReviewReady['status'] = 'ready';
      if (error) {
        status = 'error';
      } else if (fallback) {
        status = 'fallback';
      } else if (preparation?.failedStage) {
        status = 'error';
      }
      safelyLogSwapReview(() => {
        logger.swapReviewReady({
          ...identity,
          orderId,
          status,
          supportPreBuild,
          totalMs: duration(currentOpenedAt, clock()),
          ...(supportPreBuild ? preparation?.timings : undefined),
          failedStage:
            status === 'error' ? preparation?.failedStage : undefined,
          message: status === 'error' ? preparation?.message : undefined,
        });
      });
    },
    confirm(quoteId?: string, currentOrderId?: string) {
      const currentOpenedAt = openedAt;
      if (closed || confirmed || currentOpenedAt === undefined) return;
      confirmed = true;
      const confirmedAt = clock();
      safelyLogSwapReview(() => {
        logger.swapReviewConfirm({
          ...identity,
          quoteId: quoteId ?? identity.quoteId,
          orderId: currentOrderId ?? orderId,
          sinceOpenMs: duration(currentOpenedAt, confirmedAt),
          sinceReadyMs:
            readyAt === undefined ? undefined : duration(readyAt, confirmedAt),
        });
      });
    },
    close(closeReason: ISwapReviewCloseReason = 'user') {
      if (closed) return;
      closed = true;
      const currentOpenedAt = openedAt;
      if (confirmed || currentOpenedAt === undefined) return;
      safelyLogSwapReview(() => {
        logger.swapReviewClose({
          ...identity,
          closeStage,
          closeReason,
          sinceOpenMs: duration(currentOpenedAt, clock()),
        });
      });
    },
  };
}

export type ISwapReviewAnalytics = ReturnType<typeof createSwapReviewAnalytics>;

export function logSwapReviewApiResult({
  event,
  swapInfo,
  status,
  error,
  isBatch,
}: {
  event: 'estimateFee' | 'sendTx';
  swapInfo?: ISwapTxInfo;
  status: ESwapEventAPIStatus;
  error?: unknown;
  isBatch?: boolean;
}) {
  if (!swapInfo) return;
  try {
    const quote = swapInfo.swapBuildResData.result;
    const params = {
      ...swapInfo.reviewAnalyticsContext,
      quoteId: swapInfo.reviewAnalyticsContext?.quoteId ?? quote.quoteId,
      orderId: getSwapReviewOrderId(swapInfo) ?? '',
      status,
      message:
        error === undefined ? undefined : getSwapReviewErrorMessage(error),
      swapType: getSwapExecutionTypeFromQuoteResult(quote),
      slippage: String(quote.slippage ?? ''),
      fromNetworkId: swapInfo.sender.token.networkId,
      toNetworkId: swapInfo.receiver.token.networkId,
      fromTokenSymbol: swapInfo.sender.token.symbol,
      toTokenSymbol: swapInfo.receiver.token.symbol,
      fromTokenAmount: swapInfo.sender.amount,
      toTokenAmount: swapInfo.receiver.amount,
      provider: quote.info.provider,
      providerName: quote.info.providerName ?? '',
      networkId: swapInfo.sender.token.networkId,
      accountId: '',
      encodedTx: '',
      fromAddress: '',
      toAddress: '',
    };
    if (event === 'estimateFee') {
      defaultLogger.swap.swapEstimateFee.swapEstimateFee({
        ...params,
        isBatch,
      });
    } else {
      defaultLogger.swap.swapSendTx.swapSendTx(params);
    }
  } catch {
    // Analytics payload/transport failures must not interrupt transaction execution.
  }
}

/** The catch covers the request only; parsing/history failures keep their owner. */
export async function trackSwapReviewApi<T>(
  event: 'estimateFee' | 'sendTx',
  swapInfo: ISwapTxInfo | undefined,
  request: () => Promise<T>,
  isBatch?: boolean,
  options?: {
    shouldReportError?: (error: unknown) => boolean;
  },
): Promise<T> {
  let result: T;
  try {
    result = await request();
  } catch (error) {
    if (options?.shouldReportError?.(error) !== false) {
      logSwapReviewApiResult({
        event,
        swapInfo,
        status: ESwapEventAPIStatus.FAIL,
        error,
        isBatch,
      });
    }
    throw error;
  }
  logSwapReviewApiResult({
    event,
    swapInfo,
    status: ESwapEventAPIStatus.SUCCESS,
    isBatch,
  });
  return result;
}

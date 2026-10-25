import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '../../types/swap/types';

import type {
  ILiveActivityContent,
  ILiveActivityOrder,
  ILiveActivityPushContent,
  ILiveActivitySnapshot,
  ILiveActivityStatus,
} from '../../types/liveActivity';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '../../types/swap/types';

export const LIVE_ACTIVITY_DEFAULT_DURATION_SECONDS = 10 * 60;
export const LIVE_ACTIVITY_MAX_DURATION_MS = 8 * 60 * 60 * 1000;
export const LIVE_ACTIVITY_TERMINAL_RETENTION_SECONDS = 180;

export function normalizeLiveActivityDuration(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? seconds
    : LIVE_ACTIVITY_DEFAULT_DURATION_SECONDS;
}

export function getLiveActivityStatus(
  history: Pick<ISwapTxHistory, 'status' | 'extraStatus' | 'crossChainStatus'>,
): ILiveActivityStatus {
  const { status, extraStatus, crossChainStatus } = history;
  if (
    status === ESwapTxHistoryStatus.REFUNDED ||
    extraStatus === ESwapExtraStatus.REFUNDED ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDED
  ) {
    return 'refunded';
  }
  if (crossChainStatus === ESwapCrossChainStatus.REFUNDING) {
    return 'refunding';
  }
  if (status === ESwapTxHistoryStatus.CANCELED) {
    return 'canceled';
  }
  if (
    status === ESwapTxHistoryStatus.FAILED ||
    status === ESwapTxHistoryStatus.EXPIRED ||
    crossChainStatus === ESwapCrossChainStatus.FROM_FAILED ||
    crossChainStatus === ESwapCrossChainStatus.BRIDGE_FAILED ||
    crossChainStatus === ESwapCrossChainStatus.TO_FAILED ||
    crossChainStatus === ESwapCrossChainStatus.REFUND_FAILED ||
    crossChainStatus === ESwapCrossChainStatus.EXPIRED ||
    crossChainStatus === ESwapCrossChainStatus.PROVIDER_ERROR
  ) {
    return 'failed';
  }
  if (
    status === ESwapTxHistoryStatus.SUCCESS ||
    crossChainStatus === ESwapCrossChainStatus.TO_SUCCESS
  ) {
    return 'done';
  }
  if (crossChainStatus === ESwapCrossChainStatus.TO_PENDING) {
    return 'receiving';
  }
  if (
    crossChainStatus === ESwapCrossChainStatus.FROM_SUCCESS ||
    crossChainStatus === ESwapCrossChainStatus.BRIDGE_PENDING ||
    crossChainStatus === ESwapCrossChainStatus.BRIDGE_SUCCESS
  ) {
    return 'swapping';
  }
  return 'confirming';
}

export function isLiveActivityTerminal(status: ILiveActivityStatus) {
  return ['done', 'failed', 'refunded', 'canceled'].includes(status);
}

export function canAdvanceLiveActivityStatus(
  previous: ILiveActivityStatus,
  next: ILiveActivityStatus,
) {
  if (previous === 'failed') {
    return ['failed', 'refunding', 'refunded'].includes(next);
  }
  if (isLiveActivityTerminal(previous)) {
    return previous === next;
  }
  if (previous === 'refunding') {
    return ['refunding', 'refunded', 'failed'].includes(next);
  }
  return true;
}

export function getLiveActivityTimeProjection(
  order: Pick<ILiveActivityOrder, 'startedAtMs' | 'estimatedEndAtMs'>,
  status: ILiveActivityStatus,
  nowMs: number,
) {
  const remainingMs = Math.max(0, order.estimatedEndAtMs - nowMs);
  const durationMs = Math.max(1, order.estimatedEndAtMs - order.startedAtMs);
  return {
    minutes: Math.ceil(remainingMs / 60_000),
    almostDone: !isLiveActivityTerminal(status) && remainingMs < 10_000,
    progress:
      status === 'done'
        ? 1
        : Math.min(0.95, Math.max(0, (nowMs - order.startedAtMs) / durationMs)),
  };
}

export function buildSwapLiveActivitySnapshot(
  history: ISwapTxHistory,
  authoritativeStatus?: IFetchSwapTxHistoryStatusResponse,
): ILiveActivitySnapshot | undefined {
  const { fromToken, toToken, fromNetwork, toNetwork } = history.baseInfo;
  const { txId } = history.txInfo;
  if (
    history.protocol !== EProtocolOfExchange.SWAP ||
    fromToken.networkId !== 'btc--0' ||
    !fromToken.isNative ||
    !txId
  ) {
    return undefined;
  }
  const startedAtMs = history.date.created;
  const durationSeconds = normalizeLiveActivityDuration(
    history.swapInfo.estimatedTimeSeconds,
  );
  return {
    order: {
      schemaVersion: 1,
      orderKey: getSwapLiveActivityOrderKey(history),
      serviceOrderId: history.swapInfo.orderId,
      depositTxId: txId,
      networkId: fromToken.networkId,
      provider: history.swapInfo.provider.provider,
      fromToken: {
        symbol: fromToken.symbol,
        iconUrl: fromToken.logoURI ?? '',
        networkName: fromNetwork?.name ?? 'Bitcoin',
      },
      toToken: {
        symbol: toToken.symbol,
        iconUrl: toToken.logoURI ?? '',
        networkName: toNetwork?.name ?? toToken.symbol,
      },
      startedAtMs,
      estimatedEndAtMs: startedAtMs + durationSeconds * 1000,
      expiresAtMs: startedAtMs + LIVE_ACTIVITY_MAX_DURATION_MS,
      isMock: false,
    },
    content: {
      status: getLiveActivityStatus({
        status:
          history.status === ESwapTxHistoryStatus.CANCELING &&
          authoritativeStatus?.state === ESwapTxHistoryStatus.SUCCESS
            ? ESwapTxHistoryStatus.CANCELED
            : (authoritativeStatus?.state ?? history.status),
        extraStatus: authoritativeStatus?.extraStatus ?? history.extraStatus,
        crossChainStatus:
          authoritativeStatus?.crossChainStatus ?? history.crossChainStatus,
      }),
      updatedAtMs: history.date.updated,
      revision: history.date.updated,
    },
  };
}

export function getSwapLiveActivityOrderKey(history: ISwapTxHistory) {
  return (
    history.swapInfo.liveActivityOrderKey ??
    (history.swapInfo.orderId
      ? `swap:${history.swapInfo.orderId}`
      : `${history.baseInfo.fromToken.networkId}:${history.txInfo.txId}`)
  );
}

export function buildLiveActivityPushContent(
  order: ILiveActivityOrder,
  content: ILiveActivityContent,
  nowMs: number,
): ILiveActivityPushContent {
  const projection = getLiveActivityTimeProjection(
    order,
    content.status,
    nowMs,
  );
  return {
    ...content,
    displayPhase: 'eta',
    etaMinutes: projection.minutes,
    almostDone: projection.almostDone,
    imageRevision: 0,
    ...(content.status === 'refunding'
      ? { progressStoppedAtMs: content.updatedAtMs }
      : {}),
  };
}

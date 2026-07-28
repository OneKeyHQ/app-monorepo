import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

type IShowToastPayload = IAppEventBusPayload[EAppEventBusNames.ShowToast];

const OFFLINE_NETWORK_ERROR_TEXT_REGEXP =
  /network\s+(error|request\s+failed)|failed\s+to\s+fetch|网络错误/i;

const EXACT_NETWORK_ERROR_TEXTS = new Set(['network error', '网络错误']);

const EXACT_30000MS_TIMEOUT_TEXT = 'timeout of 30000ms exceeded';

const OFFLINE_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ERR_NETWORK',
]);

const TRANSPORT_NETWORK_ERROR_CODES = new Set(['ERR_NETWORK']);

const TIMEOUT_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

function hasOfflineNetworkErrorText(payload: IShowToastPayload) {
  const text = [payload.title, payload.message, payload.errorCode]
    .filter(Boolean)
    .map(String)
    .join('\n');

  return OFFLINE_NETWORK_ERROR_TEXT_REGEXP.test(text);
}

function hasExactNetworkErrorText(payload: IShowToastPayload) {
  return [payload.title, payload.message, payload.errorCode]
    .filter(Boolean)
    .some((value) =>
      EXACT_NETWORK_ERROR_TEXTS.has(String(value).trim().toLowerCase()),
    );
}

function hasExact30000MsTimeoutText(payload: IShowToastPayload) {
  return [payload.title, payload.message, payload.errorCode]
    .filter(Boolean)
    .some(
      (value) =>
        String(value).trim().toLowerCase() === EXACT_30000MS_TIMEOUT_TEXT,
    );
}

function hasTimeoutCode(payload: IShowToastPayload) {
  return (
    typeof payload.errorCode === 'string' &&
    TIMEOUT_ERROR_CODES.has(payload.errorCode.toUpperCase())
  );
}

function hasOfflineNetworkErrorCode(payload: IShowToastPayload) {
  return (
    typeof payload.errorCode === 'string' &&
    OFFLINE_NETWORK_ERROR_CODES.has(payload.errorCode.toUpperCase())
  );
}

function hasTransportNetworkErrorCode(payload: IShowToastPayload) {
  return (
    typeof payload.errorCode === 'string' &&
    TRANSPORT_NETWORK_ERROR_CODES.has(payload.errorCode.toUpperCase())
  );
}

function isTransportNetworkError(payload: IShowToastPayload) {
  return (
    payload.errorClassName === EOneKeyErrorClassNames.AxiosNetworkError ||
    hasTransportNetworkErrorCode(payload) ||
    hasExactNetworkErrorText(payload)
  );
}

function isValidHttpStatusCode(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
  );
}

export function getEffectiveHttpStatusCode(payload: IShowToastPayload) {
  if (isValidHttpStatusCode(payload.httpStatusCode)) {
    return payload.httpStatusCode;
  }

  if (isValidHttpStatusCode(payload.errorCode)) {
    return payload.errorCode;
  }

  return undefined;
}

export type INetworkErrorToastSuppressReason =
  | 'transport-timeout-code'
  | 'exact-30000ms-timeout'
  | 'transport-network-error'
  | 'offline-network-error';

export function getNetworkErrorToastSuppressReason({
  isInternetReachable,
  payload,
}: {
  isInternetReachable: boolean | null | undefined;
  payload: IShowToastPayload;
}): INetworkErrorToastSuppressReason | null {
  if (payload.method !== 'error') {
    return null;
  }

  if (typeof getEffectiveHttpStatusCode(payload) === 'number') {
    return null;
  }

  const hasNetworkErrorCode = hasOfflineNetworkErrorCode(payload);
  if (isInternetReachable === false) {
    if (hasTimeoutCode(payload)) {
      return 'transport-timeout-code';
    }

    if (
      payload.errorClassName === EOneKeyErrorClassNames.AxiosNetworkError ||
      hasNetworkErrorCode ||
      hasOfflineNetworkErrorText(payload)
    ) {
      return 'offline-network-error';
    }
  }

  if (hasExact30000MsTimeoutText(payload)) {
    return 'exact-30000ms-timeout';
  }

  if (isTransportNetworkError(payload)) {
    return 'transport-network-error';
  }

  return null;
}

export function shouldSuppressNetworkErrorToast({
  isInternetReachable,
  payload,
}: {
  isInternetReachable: boolean | null | undefined;
  payload: IShowToastPayload;
}) {
  return (
    getNetworkErrorToastSuppressReason({ isInternetReachable, payload }) !==
    null
  );
}

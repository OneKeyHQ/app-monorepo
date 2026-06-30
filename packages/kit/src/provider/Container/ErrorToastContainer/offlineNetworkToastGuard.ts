import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

type IShowToastPayload = IAppEventBusPayload[EAppEventBusNames.ShowToast];

const OFFLINE_NETWORK_ERROR_TEXT_REGEXP =
  /network\s+(error|request\s+failed)|failed\s+to\s+fetch|网络错误/i;

const EXACT_30000MS_TIMEOUT_TEXT = 'timeout of 30000ms exceeded';

const OFFLINE_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ERR_NETWORK',
]);

const TIMEOUT_ERROR_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

function hasOfflineNetworkErrorText(payload: IShowToastPayload) {
  const text = [payload.title, payload.message, payload.errorCode]
    .filter(Boolean)
    .map(String)
    .join('\n');

  return OFFLINE_NETWORK_ERROR_TEXT_REGEXP.test(text);
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

function isAxiosNetworkTimeout(payload: IShowToastPayload) {
  const isAxiosOrNetworkError =
    payload.errorName === 'AxiosError' ||
    payload.errorClassName === EOneKeyErrorClassNames.AxiosNetworkError;

  return isAxiosOrNetworkError && hasExact30000MsTimeoutText(payload);
}

export function shouldSuppressNetworkErrorToast({
  isInternetReachable,
  payload,
}: {
  isInternetReachable: boolean | null | undefined;
  payload: IShowToastPayload;
}) {
  if (payload.method !== 'error') {
    return false;
  }

  if (hasTimeoutCode(payload)) {
    return true;
  }

  if (hasExact30000MsTimeoutText(payload)) {
    return true;
  }

  if (typeof payload.httpStatusCode === 'number') {
    return false;
  }

  if (isAxiosNetworkTimeout(payload)) {
    return true;
  }

  if (isInternetReachable !== false) {
    return false;
  }

  const hasNetworkErrorCode = hasOfflineNetworkErrorCode(payload);
  return (
    payload.errorClassName === EOneKeyErrorClassNames.AxiosNetworkError ||
    hasNetworkErrorCode ||
    hasOfflineNetworkErrorText(payload)
  );
}

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

type IShowToastPayload = IAppEventBusPayload[EAppEventBusNames.ShowToast];

const OFFLINE_NETWORK_ERROR_TEXT_REGEXP =
  /network\s+(error|request\s+failed)|failed\s+to\s+fetch|网络错误/i;

const OFFLINE_NETWORK_TIMEOUT_TEXT_REGEXP =
  /\btimeout\b|\btimed\s+out\b|请求超时/i;

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

function hasTimeoutText(payload: IShowToastPayload) {
  const text = [payload.title, payload.message, payload.errorCode]
    .filter(Boolean)
    .map(String)
    .join('\n');

  return OFFLINE_NETWORK_TIMEOUT_TEXT_REGEXP.test(text);
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

  return isAxiosOrNetworkError && hasTimeoutText(payload);
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

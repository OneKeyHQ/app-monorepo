import type { IJsonRpcResponse } from '@onekeyfe/cross-inpage-provider-types';

export interface IJsonRpcResponsePro<T> extends IJsonRpcResponse<T> {
  error?: any;
}

export type IOneKeyAPIBaseResponse<T = any> = {
  code: number;
  message: string;
  messageId?: string;
  translatedMessage?: string;
  data: T;
  disableAutoToast?: boolean;
  // When true on a non-zero `code`, the client should keep the error message
  // visible and stop any active polling for this request — retrying with the
  // same input will not change the outcome (e.g. allowance shortage, expired
  // swap quote, missing permission).
  stopPolling?: boolean;
};

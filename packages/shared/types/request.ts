import type { IJsonRpcResponse } from '@onekeyfe/cross-inpage-provider-types';

export interface IJsonRpcResponsePro<T> extends IJsonRpcResponse<T> {
  error?: any;
}

export type IOneKeyAPIBaseResponse<T = any> = {
  code: number;
  message: string;
  data: T;
};

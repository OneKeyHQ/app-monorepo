/* eslint-disable max-classes-per-file */
import type { IJsonRpcResponsePro } from '../../../types/request';
import type { AxiosResponse } from 'axios';

// For Fetch API
type IErrorResponse = Response | IJsonRpcResponsePro<any>;
export class ResponseError extends Error {
  readonly response?: IErrorResponse;

  constructor(message?: string, response?: IErrorResponse) {
    super(message);
    if (response) {
      if ('jsonrpc' in response) {
        this.response = { ...response };
      } else {
        this.response = response;
      }
    }
  }
}

export class JsonRPCResponseError extends ResponseError {
  readonly error?: unknown;

  constructor(message?: string, response?: IErrorResponse, error?: unknown) {
    super(message, response);
    this.error = error;
  }
}

// For Axios
export type IAxiosErrorResponse = AxiosResponse | IJsonRpcResponsePro<any>;
export class AxiosResponseError extends Error {
  readonly response?: IAxiosErrorResponse;

  constructor(message?: string, response?: IAxiosErrorResponse) {
    super(message);
    if (response) {
      if ('jsonrpc' in response) {
        this.response = { ...response };
      } else {
        this.response = response;
      }
    }
  }
}

/* eslint-disable max-classes-per-file */
import type { IJsonRpcResponsePro } from '../../../types/request';

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

export class JsonPRCResponseError extends ResponseError {
  readonly error?: unknown;

  constructor(message?: string, response?: IErrorResponse, error?: unknown) {
    super(message, response);
    this.error = error;
  }
}

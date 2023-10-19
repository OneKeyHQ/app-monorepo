/* eslint-disable max-classes-per-file */
import type { IJsonRpcResponsePro } from '@onekeyhq/engine/src/types';

// import type { Response as FetchResponse } from 'cross-fetch';

type ErrorResponse = Response | IJsonRpcResponsePro<any>;
export class ResponseError extends Error {
  readonly response?: ErrorResponse;

  constructor(message?: string, response?: ErrorResponse) {
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

  constructor(message?: string, response?: ErrorResponse, error?: unknown) {
    super(message, response);
    this.error = error;
  }
}

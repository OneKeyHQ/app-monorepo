/* eslint-disable max-classes-per-file */
// import type { IJsonRpcResponsePro } from '@onekeyhq/engine/src/types';

// import type { Response as FetchResponse } from 'cross-fetch';

export class ResponseError extends Error {
  readonly response?: Response;

  constructor(message?: string, response?: Response) {
    super(message);
    this.response = response?.clone();
  }
}

export class JsonPRCResponseError extends ResponseError {
  readonly error?: unknown;

  constructor(message?: string, response?: Response, error?: unknown) {
    super(message, response);
    this.error = error;
  }
}

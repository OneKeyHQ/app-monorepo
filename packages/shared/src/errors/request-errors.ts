// eslint-disable-next-line max-classes-per-file
import type { IJsonRpcResponsePro } from '@onekeyhq/engine/src/types';

import type { Response } from 'cross-fetch';

class ResponseError extends Error {
  readonly response?: Response | IJsonRpcResponsePro<any>;

  constructor(
    message?: string,
    response?: Response | IJsonRpcResponsePro<any>,
  ) {
    super(message);
    this.response = response;
  }
}

class JsonPRCResponseError extends ResponseError {
  readonly error?: unknown;

  constructor(
    message?: string,
    response?: Response | IJsonRpcResponsePro<any>,
    error?: unknown,
  ) {
    super(message, response);
    this.error = error;
  }
}

export { ResponseError, JsonPRCResponseError };

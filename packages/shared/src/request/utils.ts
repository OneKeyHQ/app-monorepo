import { JsonPRCResponseError, ResponseError } from '../errors';

import type { IJsonRpcResponsePro } from '../../types/request';

export function parseRPCResponse<T>(
  response: IJsonRpcResponsePro<T>,
): Promise<T> {
  if (typeof response !== 'object') {
    throw new ResponseError(
      'Invalid JSON RPC response, typeof response should be an object',
      response,
    );
  } else if (response.error) {
    let message = 'Error JSON PRC response';
    const error = response.error as { message?: string };
    if (error?.message && typeof error?.message === 'string') {
      message = `Error JSON PRC response: ${error?.message}`;
    }
    throw new JsonPRCResponseError(message, response);
  } else if (!('result' in response)) {
    throw new ResponseError(
      'Invalid JSON RPC response, result not found',
      response,
    );
  }

  return Promise.resolve(response.result as T);
}

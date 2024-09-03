import { JsonRPCResponseError, ResponseError } from '../errors';

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
    let message = 'Error JSON RPC response';
    const error = response.error as { message?: string };
    if (error?.message && typeof error?.message === 'string') {
      message = `Error JSON RPC response: ${error?.message}`;
    } 
    throw new JsonRPCResponseError(message, response);
  } else if (!('result' in response)) {
    throw new ResponseError(
      'Invalid JSON RPC response, result not found',
      response,
    );
  }

  return Promise.resolve(response.result as T);
}

export function isRequestIdMessage(message?: string) {
  return message?.startsWith('RequestId:') ?? false;
}

export async function executeRequestsInBatches<T>(
  requests: (() => Promise<T | undefined>)[],
  batchSize: number,
) {
  let index = 0;
  while (index < requests.length) {
    const batch = requests
      .slice(index, index + batchSize)
      .map((request) => request());
    try {
      await Promise.all(batch);
    } catch (e) {
      console.error(e);
      // handle error
    }
    index += batchSize;
  }
}

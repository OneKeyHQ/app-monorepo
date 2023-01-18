import { Response } from 'cross-fetch';

import { JsonPRCResponseError, ResponseError } from '../errors/request-errors';

import { JsonRPCRequest } from './JsonRPCRequest';

const mockFetch = jest.fn();

test.skip('Call RPC as expected', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            pong: 'success',
          },
        }),
      ),
    ),
  );

  const response = await new JsonRPCRequest('https://mytest.com/rpc', {
    H1: '1',
    H2: '2',
  }).call('ping', { v1: 1001, v2: '777' }, { H2: '2-2', H3: '3' });

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      H1: '1',
      H2: '2-2',
      H3: '3',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'ping',
      params: { v1: 1001, v2: '777' },
    }),
    signal: expect.anything(),
  });
});

test.skip('Call RPC but failed', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(new Response('{}', { status: 404 })),
  );

  const responsePromise = new JsonRPCRequest('https://mytest.com/rpc').call(
    'ping',
    [],
  );
  await expect(responsePromise).rejects.toThrow(
    new ResponseError('Wrong response<404>'),
  );
});

test.skip('Call RPC but get error from response', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            errorCode: 10001,
            errorMessage: 'Internal Error',
          },
        }),
      ),
    ),
  );

  const responsePromise = new JsonRPCRequest('https://mytest.com/rpc').call(
    'ping',
    [],
  );

  await expect(responsePromise).rejects.toThrow(
    new JsonPRCResponseError('Error JSON PRC response'),
  );
});

test.skip('Call RPC but result not found in response', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
        }),
      ),
    ),
  );

  const responsePromise = new JsonRPCRequest('https://mytest.com/rpc').call(
    'ping',
    [],
  );

  await expect(responsePromise).rejects.toThrow(
    new ResponseError('Invalid JSON RPC response, result not found'),
  );
});

test.skip('Call RPC and get null from result', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: null,
        }),
      ),
    ),
  );

  const response = await new JsonRPCRequest('https://mytest.com/rpc').call(
    'ping',
    [],
  );

  expect(response).toBe(null);
});

test.skip('Batch call RPC as expected', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify([
          {
            jsonrpc: '2.0',
            id: 1,
            result: {
              pong2: 'success',
            },
          },
          {
            jsonrpc: '2.0',
            id: 0,
            result: {
              pong1: 'success',
            },
          },
        ]),
      ),
    ),
  );

  const response = await new JsonRPCRequest('https://mytest.com/rpc', {
    H1: '1',
    H2: '2',
  }).batchCall(
    [
      ['ping1', { v1: 1001 }],
      ['ping2', { v2: '777' }],
    ],
    { H2: '2-2', H3: '3' },
  );

  expect(response).toStrictEqual([
    {
      pong1: 'success',
    },
    {
      pong2: 'success',
    },
  ]);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/rpc', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      H1: '1',
      H2: '2-2',
      H3: '3',
    },
    body: JSON.stringify([
      {
        jsonrpc: '2.0',
        id: 0,
        method: 'ping1',
        params: { v1: 1001 },
      },
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping2',
        params: { v2: '777' },
      },
    ]),
    signal: expect.anything(),
  });
});

test.skip('Batch call RPC but failed', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(new Response('{}', { status: 404 })),
  );

  const responsePromise = new JsonRPCRequest(
    'https://mytest.com/rpc',
  ).batchCall([
    ['ping1', { v1: 1001 }],
    ['ping2', { v2: '777' }],
  ]);
  await expect(responsePromise).rejects.toThrow(
    new ResponseError('Wrong response<404>'),
  );
});

test.skip('Batch call RPC but receive invalid non-array responses', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: {
            pong1: 'success',
          },
        }),
      ),
    ),
  );

  const responsePromise = new JsonRPCRequest(
    'https://mytest.com/rpc',
  ).batchCall([
    ['ping1', { v1: 1001 }],
    ['ping2', { v2: '777' }],
  ]);

  await expect(responsePromise).rejects.toThrow(
    new ResponseError(
      `Invalid JSON Batch RPC response, response should be an array`,
    ),
  );
});

test.skip('Batch call RPC but receive insufficient responses', async () => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(
      new Response(
        JSON.stringify([
          {
            jsonrpc: '2.0',
            result: {
              pong1: 'success',
            },
          },
        ]),
      ),
    ),
  );

  const responsePromise = new JsonRPCRequest(
    'https://mytest.com/rpc',
  ).batchCall([
    ['ping1', { v1: 1001 }],
    ['ping2', { v2: '777' }],
  ]);

  await expect(responsePromise).rejects.toThrow(
    new ResponseError(
      `Invalid JSON Batch RPC response, batch with 2 calls, but got 1 responses`,
    ),
  );
});

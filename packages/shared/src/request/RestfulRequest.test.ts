import fetch, { Response } from 'cross-fetch';
import { mocked } from 'ts-jest/utils';

import { ResponseError } from '../errors/request-errors';

import { RestfulRequest } from './RestfulRequest';

const mockFetch = mocked(fetch, true);

beforeEach(() => {
  mockFetch.mockReturnValueOnce(
    Promise.resolve(new Response(JSON.stringify({ pong: 'success' }))),
  );
});

test.skip('GET method as expected', async () => {
  const response = await new RestfulRequest('https://mytest.com')
    .get('/ping')
    .then((i) => i.json());

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/ping', {
    headers: {},
    signal: expect.anything(),
  });
});

test.skip('GET method with params as expected', async () => {
  const response = await new RestfulRequest('https://mytest.com')
    .get('/ping', { value: 1221 })
    .then((i) => i.json());

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/ping?value=1221', {
    headers: {},
    signal: expect.anything(),
  });
});

test.skip('GET method but failed', async () => {
  mockFetch.mockReset();
  mockFetch.mockReturnValueOnce(
    Promise.resolve(new Response('{}', { status: 404 })),
  );

  const responsePromise = new RestfulRequest('https://mytest.com').get('/ping');
  await expect(responsePromise).rejects.toThrow(
    new ResponseError('Wrong response<404>'),
  );
});

test.skip('POST method with data as expected', async () => {
  const response = await new RestfulRequest('https://mytest.com')
    .post('/ping', { a: 1, b: 2 })
    .then((i) => i.json());

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/ping', {
    method: 'POST',
    headers: {},
    body: 'a=1&b=2',
    signal: expect.anything(),
  });
});

test.skip('POST method with json as expected', async () => {
  const response = await new RestfulRequest('https://mytest.com')
    .post('/ping', { a: 1, b: 2 }, true)
    .then((i) => i.json());

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/ping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{"a":1,"b":2}',
    signal: expect.anything(),
  });
});

test.skip('POST method but failed', async () => {
  mockFetch.mockReset();
  mockFetch.mockReturnValueOnce(
    Promise.resolve(new Response('{}', { status: 404 })),
  );

  const responsePromise = new RestfulRequest('https://mytest.com').post(
    '/ping',
  );
  await expect(responsePromise).rejects.toThrow(
    new ResponseError('Wrong response<404>'),
  );
});

test.skip('Assemble headers - GET', async () => {
  const response = await new RestfulRequest('https://mytest.com', {
    H1: '1',
    H2: '2',
  })
    .get('/ping', undefined, { H2: '2-2', H3: '3' })
    .then((i) => i.json());

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/ping', {
    headers: { H1: '1', H2: '2-2', H3: '3' },
    signal: expect.anything(),
  });
});

test.skip('Assemble headers - POST', async () => {
  const response = await new RestfulRequest('https://mytest.com', {
    H1: '1',
    H2: '2',
  })
    .post('/ping', undefined, false, { H2: '2-2', H3: '3' })
    .then((i) => i.json());

  expect(response).toStrictEqual({ pong: 'success' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('https://mytest.com/ping', {
    headers: { H1: '1', H2: '2-2', H3: '3' },
    method: 'POST',
    body: undefined,
    signal: expect.anything(),
  });
});

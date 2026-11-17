import { fetch as expoFetch } from 'expo/fetch';

import { streamingFetch } from './streamingFetch.native';

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(async () => new Response('ok')),
}));

afterEach(() => jest.restoreAllMocks());

it('uses native streaming fetch with the relay signal and security options', async () => {
  const init: RequestInit = {
    method: 'POST',
    body: new Uint8Array([1]),
    signal: new AbortController().signal,
    credentials: 'omit',
    redirect: 'error',
  };
  const bufferedFetch = jest.spyOn(globalThis, 'fetch');
  const response = await streamingFetch('https://node.example/rpc', init);
  await expect(response.text()).resolves.toBe('ok');
  expect(expoFetch).toHaveBeenCalledWith('https://node.example/rpc', init);
  expect(bufferedFetch).not.toHaveBeenCalled();
});

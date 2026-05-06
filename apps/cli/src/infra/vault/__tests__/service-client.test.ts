import axios from 'axios';

import { LOCK_TIMEOUT_MS, REVOKE_TIMEOUT_MS } from '../constants';
import { serviceFetch, serviceRevoke } from '../service-client';

import type { AxiosResponse } from 'axios';

function createResponse<T>(status: number, data: T): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: String(status),
    headers: {},
    config: { headers: {} },
  } as AxiosResponse<T>;
}

function createHttpError(status: number): Error & {
  response: AxiosResponse<{ error: string }>;
} {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: createResponse(status, { error: 'ERR' }),
  });
}

describe('service-client', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps 200 with keyBase64 to ok', async () => {
    const getSpy = jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce(createResponse(200, { keyBase64: 'abc' }));
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({ kind: 'ok', keyBase64: 'abc' });

    expect(timeoutSpy).toHaveBeenCalledWith(LOCK_TIMEOUT_MS);
    expect(getSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/v1/bot-wallet-keys/key-1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [401, 'TOKEN_INVALID'],
    [403, 'REVOKED'],
    [404, 'KEY_NOT_FOUND'],
  ] as const)('maps HTTP %s to self-heal %s', async (status, reason) => {
    jest.spyOn(axios, 'get').mockRejectedValueOnce(createHttpError(status));

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({ kind: 'self-heal', reason });
  });

  it.each([
    ['HTTP 500', () => createHttpError(500)],
    ['network error', () => new Error('ECONNREFUSED')],
  ] as const)('maps %s to fail-secure', async (_name, createError) => {
    jest.spyOn(axios, 'get').mockRejectedValueOnce(createError());

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toMatchObject({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
    });
  });

  it('forwards ECONNREFUSED as a fail-secure cause for clearer downstream errors', async () => {
    const refusedError = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:8787'),
      { code: 'ECONNREFUSED' },
    );
    jest.spyOn(axios, 'get').mockRejectedValueOnce(refusedError);

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
      cause: {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:8787',
      },
    });
  });

  it('maps malformed 200 response to fail-secure with an invalid-payload cause', async () => {
    jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce(createResponse(200, { key: 'missing' }));

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
      cause: {
        message: 'service returned an invalid key payload',
      },
    });
  });

  it('revoke uses the logout timeout and swallows failures with warn', async () => {
    const warn = jest.fn();
    const revokeError = Object.assign(
      new Error('Request failed with status code 500'),
      {
        code: 'ERR_BAD_RESPONSE',
        config: {
          headers: { Authorization: 'Bearer token-1' },
        },
        response: createResponse(500, { error: 'ERR' }),
      },
    );
    const postSpy = jest
      .spyOn(axios, 'post')
      .mockRejectedValueOnce(revokeError);
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    await expect(
      serviceRevoke({ keyId: 'key-1', accessToken: 'token-1', warn }),
    ).resolves.toBeUndefined();

    expect(timeoutSpy).toHaveBeenCalledWith(REVOKE_TIMEOUT_MS);
    expect(postSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/v1/bot-wallet-keys/key-1/revoke',
      undefined,
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-1' },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(warn).toHaveBeenCalledWith('service.revoke.failed', {
      error: {
        code: 'ERR_BAD_RESPONSE',
        message: 'Request failed with status code 500',
        name: 'Error',
        status: 500,
      },
      keyId: 'key-1',
    });
    expect(JSON.stringify(warn.mock.calls[0][1])).not.toContain('token-1');
  });
});

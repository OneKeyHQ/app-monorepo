import { AppError, ERROR_CODES } from '../../../errors';
import { apiClient } from '../../api-client';
import { KEY_API_TIMEOUT_MS, REVOKE_TIMEOUT_MS } from '../constants';
import {
  BOT_WALLET_KEY_API_PATH,
  BOT_WALLET_KEY_API_TOKEN_HEADER,
  serviceFetch,
  serviceRevoke,
} from '../service-client';

function createHttpError(status: number): AppError {
  return new AppError(
    ERROR_CODES.NET_HTTP_ERROR.code,
    `HTTP ${status}`,
    'Check request parameters',
    {
      details: {
        statusCode: status,
      },
    },
  );
}

function createApiEnvelopeError(code: number): AppError {
  return new AppError(
    ERROR_CODES.BIZ_UNKNOWN.code,
    `OneKey API error (code ${code})`,
    'Check parameters or retry',
    {
      details: {
        upstreamCode: code,
      },
    },
  );
}

describe('service-client', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps 200 with keyBase64 to ok', async () => {
    const getSpy = jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ keyBase64: 'abc' });
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({ kind: 'ok', keyBase64: 'abc' });

    expect(timeoutSpy).toHaveBeenCalledWith(KEY_API_TIMEOUT_MS);
    expect(getSpy).toHaveBeenCalledWith(
      'prime',
      `${BOT_WALLET_KEY_API_PATH}/key-1`,
      undefined,
      expect.objectContaining({
        headers: { [BOT_WALLET_KEY_API_TOKEN_HEADER]: 'token-1' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [401, 'TOKEN_INVALID'],
    [403, 'REVOKED'],
    [404, 'KEY_NOT_FOUND'],
  ] as const)('maps HTTP %s to self-heal %s', async (status, reason) => {
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(createHttpError(status));

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({ kind: 'self-heal', reason });
  });

  it.each([
    [401, 'TOKEN_INVALID'],
    [403, 'REVOKED'],
    [404, 'KEY_NOT_FOUND'],
  ] as const)(
    'maps Prime API envelope code %s to self-heal %s',
    async (code, reason) => {
      jest
        .spyOn(apiClient, 'get')
        .mockRejectedValueOnce(createApiEnvelopeError(code));

      await expect(
        serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
      ).resolves.toEqual({ kind: 'self-heal', reason });
    },
  );

  it.each([
    ['HTTP 500', () => createHttpError(500)],
    ['network error', () => new Error('ECONNREFUSED')],
  ] as const)('maps %s to fail-secure', async (_name, createError) => {
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(createError());

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toMatchObject({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
    });
  });

  it('forwards ECONNREFUSED as a fail-secure cause for clearer downstream errors', async () => {
    const refusedError = Object.assign(
      new Error('connect ECONNREFUSED prime.onekeytest.com:443'),
      { code: 'ECONNREFUSED' },
    );
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(refusedError);

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
      cause: {
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED prime.onekeytest.com:443',
      },
    });
  });

  it('maps malformed 200 response to fail-secure with an invalid-payload cause', async () => {
    jest
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ key: 'missing' } as never);

    await expect(
      serviceFetch({ keyId: 'key-1', accessToken: 'token-1' }),
    ).resolves.toEqual({
      kind: 'fail-secure',
      reason: 'SERVICE_UNREACHABLE',
      cause: {
        message: 'Prime API returned an invalid key payload',
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
          headers: { [BOT_WALLET_KEY_API_TOKEN_HEADER]: 'token-1' },
        },
        details: { statusCode: 500 },
      },
    );
    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(revokeError);
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    await expect(
      serviceRevoke({ keyId: 'key-1', accessToken: 'token-1', warn }),
    ).resolves.toBeUndefined();

    expect(timeoutSpy).toHaveBeenCalledWith(REVOKE_TIMEOUT_MS);
    expect(postSpy).toHaveBeenCalledWith(
      'prime',
      `${BOT_WALLET_KEY_API_PATH}/key-1/revoke`,
      undefined,
      { [BOT_WALLET_KEY_API_TOKEN_HEADER]: 'token-1' },
      expect.objectContaining({
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

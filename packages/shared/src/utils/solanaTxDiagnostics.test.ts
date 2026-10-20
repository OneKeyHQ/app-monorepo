/* eslint-disable onekey/no-raw-error */
import {
  getSolanaDiagnosticElapsed,
  getSolanaDiagnosticError,
  sanitizeSolanaTxDiagnosticEvent,
} from './solanaTxDiagnostics';

import type { ISolanaTxDiagnosticEvent } from '../../types/solanaTxDiagnostics';

const correlationId = '11111111-2222-4333-8444-555555555555';
const event: ISolanaTxDiagnosticEvent = {
  correlationId,
  startedAt: 1000,
  timestamp: '2026-01-01T00:00:01.000Z',
  stage: 'broadcast',
  status: 'failed',
  runtime: 'bg',
  errorCode: 40_034,
};

describe('Solana local diagnostic privacy boundary', () => {
  it('projects only explicit public metadata and drops sensitive extra fields', () => {
    const output = sanitizeSolanaTxDiagnosticEvent({
      ...event,
      recentBlockhash: '11111111111111111111111111111111',
      contextSlot: 123,
      lastValidBlockHeight: 99,
      commitment: 'confirmed',
      accountId: 'synthetic-account',
      address: 'synthetic-address',
      rawTx: 'synthetic-raw-tx',
      signedTx: { signature: 'synthetic-signature' },
      rpcUrl: 'https://rpc.invalid/?apiKey=synthetic-secret',
      errorMessage: 'synthetic-private-message',
    } as ISolanaTxDiagnosticEvent);
    expect(output).toEqual(
      expect.objectContaining({
        correlationId,
        contextSlot: 123,
        lastValidBlockHeight: 99,
      }),
    );
    expect(JSON.stringify(output)).not.toContain('synthetic');
  });

  it('keeps unknown acquisition/height absent and never treats slot as block height', () => {
    const output = sanitizeSolanaTxDiagnosticEvent({
      ...event,
      contextSlot: 123,
      elapsedMs: -1,
    });
    expect(output?.lastValidBlockHeight).toBeUndefined();
    expect(output?.blockhashFetchedAt).toBeUndefined();
    expect(output?.elapsedMs).toBeUndefined();
    expect(getSolanaDiagnosticElapsed(event, 900)).toBeUndefined();
  });

  it('rejects malformed context and throwing accessors without coercing or logging them', () => {
    const toString = jest.fn(() => {
      throw new Error('synthetic-private-value');
    });
    expect(
      sanitizeSolanaTxDiagnosticEvent({
        ...event,
        correlationId: { toString },
      } as unknown as ISolanaTxDiagnosticEvent),
    ).toBeUndefined();
    expect(toString).not.toHaveBeenCalled();
    const hostile = { ...event };
    Object.defineProperty(hostile, 'recentBlockhash', {
      get: () => {
        throw new Error('synthetic-private-value');
      },
    });
    expect(() => sanitizeSolanaTxDiagnosticEvent(hostile)).not.toThrow();
    expect(sanitizeSolanaTxDiagnosticEvent(hostile)).toBeUndefined();
  });

  it('drops arbitrary dynamic values, nonfinite numbers and non-UUID request IDs', () => {
    const output = sanitizeSolanaTxDiagnosticEvent({
      ...event,
      reason: 'synthetic-secret',
      errorCategory: 'synthetic-secret',
      rpcMode: 'https://rpc.invalid',
      httpRequestId: 'synthetic-token',
      contextSlot: Infinity,
      lastValidBlockHeight: NaN,
      httpStatus: 999,
    } as unknown as ISolanaTxDiagnosticEvent);
    expect(output?.reason).toBeUndefined();
    expect(output?.errorCategory).toBeUndefined();
    expect(output?.rpcMode).toBeUndefined();
    expect(output?.httpRequestId).toBeUndefined();
    expect(output?.httpStatus).toBeUndefined();
    expect(output?.contextSlot).toBeUndefined();
    expect(output?.lastValidBlockHeight).toBeUndefined();
  });

  it.each([
    [{ code: 40_028 }, 'blockhashNotFound'],
    [{ code: '40034' }, 'executionFailed'],
    [{ code: 'ECONNABORTED' }, 'timeout'],
    [{ className: 'AxiosNetworkError' }, 'network'],
    [
      {
        className: 'OneKeyAppError',
        constructor: { name: 'OneKeyErrorAirGapInvalidQrCode' },
      },
      'invalidQrOrSignature',
    ],
    [{ className: 'PasswordPromptDialogCancel' }, 'cancelled'],
  ])(
    'classifies known failures without returning raw errors: %j',
    (error, category) => {
      expect(getSolanaDiagnosticError(error).errorCategory).toBe(category);
    },
  );

  it('records only a server-error HTTP UUID/status, never QR/sign IDs', () => {
    const server = getSolanaDiagnosticError({
      code: 40_034,
      className: 'OneKeyServerApiError',
      requestId: correlationId,
      httpStatusCode: 400,
      data: 'synthetic-private-response',
      message: 'synthetic-private-message',
    });
    expect(server).toEqual({
      errorCode: 40_034,
      errorCategory: 'executionFailed',
      httpRequestId: correlationId,
      httpStatus: 400,
    });
    expect(
      getSolanaDiagnosticError({ code: 40_034, requestId: correlationId })
        .httpRequestId,
    ).toBeUndefined();
  });

  it('does not coerce or expose hostile error properties', () => {
    const valueOf = jest.fn(() => {
      throw new Error('synthetic-private-value');
    });
    expect(getSolanaDiagnosticError({ code: { valueOf } }).errorCategory).toBe(
      'unknown',
    );
    expect(valueOf).not.toHaveBeenCalled();
    const error = Object.defineProperty({}, 'code', {
      get: () => {
        throw new Error('synthetic-private-value');
      },
    });
    expect(getSolanaDiagnosticError(error)).toEqual({
      errorCategory: 'unknown',
    });
  });
});

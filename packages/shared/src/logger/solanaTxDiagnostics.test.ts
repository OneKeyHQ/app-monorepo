/* eslint-disable onekey/no-raw-error */
/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions do not use this binding. */
import { defaultLogger } from './logger';
import {
  createSolanaTxDiagnosticContext,
  logSolanaTxDiagnostic,
} from './solanaTxDiagnostics';

import type { ISolanaTxDiagnosticContext } from '../../types/solanaTxDiagnostics';

jest.mock('./logger', () => ({
  defaultLogger: { transaction: { send: { solanaTxDiagnostic: jest.fn() } } },
}));
jest.mock('../utils/miscUtils', () => ({
  generateUUID: jest.fn(() => '11111111-2222-4333-8444-555555555555'),
}));

const context: ISolanaTxDiagnosticContext = {
  correlationId: '11111111-2222-4333-8444-555555555555',
  startedAt: 1000,
  recentBlockhash: '11111111111111111111111111111111',
  blockhashFetchedAt: 1100,
};

describe('Solana local diagnostic emission', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('preserves per-transaction metadata and UTC/device-clock timing across copied contexts', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1500);
    logSolanaTxDiagnostic(
      { ...context },
      { stage: 'qrRenderReady', status: 'succeeded', runtime: 'main' },
    );
    expect(
      defaultLogger.transaction.send.solanaTxDiagnostic,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: context.correlationId,
        timestamp: '1970-01-01T00:00:01.500Z',
        elapsedMs: 500,
        recentBlockhash: context.recentBlockhash,
        blockhashFetchedAt: 1100,
        runtime: 'main',
      }),
    );
  });

  it('fails open if the local logger or context access fails', () => {
    jest
      .mocked(defaultLogger.transaction.send.solanaTxDiagnostic)
      .mockImplementation(() => {
        throw new Error('synthetic-local-log-failure');
      });
    expect(() =>
      logSolanaTxDiagnostic(context, { stage: 'sign', status: 'started' }),
    ).not.toThrow();
    const malformed = Object.defineProperty({}, 'correlationId', {
      get: () => {
        throw new Error('synthetic-private-value');
      },
    });
    expect(() =>
      logSolanaTxDiagnostic(malformed as ISolanaTxDiagnosticContext, {
        stage: 'sign',
        status: 'started',
      }),
    ).not.toThrow();
  });

  it('creates an independent opaque diagnostic identifier rather than a signing/session ID', () => {
    expect(createSolanaTxDiagnosticContext()?.correlationId).toBe(
      context.correlationId,
    );
    logSolanaTxDiagnostic(undefined, { stage: 'finished', status: 'skipped' });
    expect(
      defaultLogger.transaction.send.solanaTxDiagnostic,
    ).not.toHaveBeenCalled();
  });
});

import { OneKeyLocalError } from '../../errors';

import {
  getSniRequestCancelAckError,
  getSniRequestErrorCode,
  getSniRequestTransportSettledError,
  waitForSniRequestCancelAck,
  waitForSniRequestTransportSettled,
} from './sniRequestQaUtils';

describe('getSniRequestErrorCode', () => {
  test('reads a structured error code', () => {
    expect(
      getSniRequestErrorCode(
        Object.assign(new Error('Request cancelled'), {
          code: 'SNI_CANCELLED',
        }),
      ),
    ).toBe('SNI_CANCELLED');
  });

  test('recovers an SNI code from an Electron IPC-safe message', () => {
    expect(
      getSniRequestErrorCode(
        new Error(
          "Error invoking remote method 'DESKTOP_API_CALL': SNI_CANCELLED: Request cancelled",
        ),
      ),
    ).toBe('SNI_CANCELLED');
  });
});

describe('getSniRequestCancelAckError', () => {
  test('accepts an explicit transport cancellation acknowledgement', () => {
    expect(
      getSniRequestCancelAckError({
        requestId: 'request-1',
        status: 'fulfilled',
        success: true,
      }),
    ).toBeUndefined();
  });

  test('rejects success=false instead of treating the local abort as proof', () => {
    expect(
      getSniRequestCancelAckError({
        requestId: 'request-2',
        status: 'fulfilled',
        success: false,
      }),
    ).toBe('cancelRequest returned success=false for request-2');
  });

  test('reports a rejected transport cancellation call', () => {
    expect(
      getSniRequestCancelAckError({
        requestId: 'request-3',
        status: 'rejected',
        error: new Error('bridge unavailable'),
      }),
    ).toBe('cancelRequest rejected for request-3: bridge unavailable');
  });
});

describe('getSniRequestTransportSettledError', () => {
  test('accepts a real transport SNI_CANCELLED rejection', () => {
    expect(
      getSniRequestTransportSettledError({
        requestId: 'request-transport-cancelled',
        status: 'rejected',
        error: Object.assign(new Error('Request cancelled'), {
          code: 'SNI_CANCELLED',
        }),
      }),
    ).toBeUndefined();
  });

  test('accepts an Electron IPC-safe SNI_CANCELLED rejection', () => {
    expect(
      getSniRequestTransportSettledError({
        requestId: 'request-desktop-cancelled',
        status: 'rejected',
        error: new Error('SNI_CANCELLED: Request cancelled'),
      }),
    ).toBeUndefined();
  });

  test('rejects a transport that naturally fulfilled after abort', () => {
    expect(
      getSniRequestTransportSettledError({
        requestId: 'request-transport-fulfilled',
        status: 'fulfilled',
      }),
    ).toBe('transport fulfilled after abort for request-transport-fulfilled');
  });

  test('rejects a non-cancellation transport error', () => {
    expect(
      getSniRequestTransportSettledError({
        requestId: 'request-transport-failed',
        status: 'rejected',
        error: Object.assign(new Error('socket failed'), {
          code: 'SNI_REQUEST_FAILED',
        }),
      }),
    ).toBe(
      'transport rejected with SNI_REQUEST_FAILED for request-transport-failed: socket failed',
    );
  });
});

describe('waitForSniRequestCancelAck', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('fails when the bridge cancellation promise never settles', async () => {
    const waiting = waitForSniRequestCancelAck({
      ack: new Promise(() => undefined),
      ensureActive: () => undefined,
      pollIntervalMs: 10,
      requestId: 'request-never-settles',
      timeoutMs: 100,
    });
    const rejection = waiting.catch((error: unknown) => error);

    await jest.advanceTimersByTimeAsync(100);

    await expect(rejection).resolves.toMatchObject({
      message:
        'cancelRequest acknowledgement timed out for request-never-settles after 100 ms',
    });
  });

  test('allows the caller to interrupt an acknowledgement wait', async () => {
    let active = true;
    const waiting = waitForSniRequestCancelAck({
      ack: new Promise(() => undefined),
      ensureActive: () => {
        if (!active) throw new OneKeyLocalError('Stopped by QA');
      },
      pollIntervalMs: 10,
      requestId: 'request-stopped',
      timeoutMs: 100,
    });
    const rejection = waiting.catch((error: unknown) => error);
    active = false;

    await jest.advanceTimersByTimeAsync(10);

    await expect(rejection).resolves.toMatchObject({
      message: 'Stopped by QA',
    });
  });

  test('waits for the unwrapped transport outcome', async () => {
    const transportSettled = Promise.resolve({
      requestId: 'request-transport',
      status: 'rejected' as const,
      error: Object.assign(new Error('Request cancelled'), {
        code: 'SNI_CANCELLED',
      }),
    });

    await expect(
      waitForSniRequestTransportSettled({
        ensureActive: () => undefined,
        pollIntervalMs: 10,
        requestId: 'request-transport',
        timeoutMs: 100,
        transportSettled,
      }),
    ).resolves.toMatchObject({
      requestId: 'request-transport',
      status: 'rejected',
    });
  });
});

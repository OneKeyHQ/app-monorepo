import {
  createTransferPairingRuntime,
  startTransferPairingRuntimeTimeout,
} from '../core/prime-transfer/pairing-session-runtime';

describe('pairing-session-runtime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('transitions to timeout once and ignores late events after the timer starts', async () => {
    const dispose = jest.fn(async () => undefined);
    const runtime = createTransferPairingRuntime({
      roomId: 'room-1',
      userId: 'user-1',
      pairingCode: 'ABCDEFGH123-ABCDE-FGHIJ-KLMNP-QRSTU-VWXYZ-12345-6789A',
      now: () => new Date('2026-04-06T07:00:00.000Z'),
      dispose,
    });

    const timeoutWindow = startTransferPairingRuntimeTimeout(runtime, {
      timeoutMs: 1000,
      now: () => new Date('2026-04-06T07:05:00.000Z'),
    });
    const duplicateWindow = startTransferPairingRuntimeTimeout(runtime, {
      timeoutMs: 5000,
      now: () => new Date('2026-04-06T07:10:00.000Z'),
    });

    expect(timeoutWindow).toEqual({
      startedAt: '2026-04-06T07:05:00.000Z',
      expiresAt: '2026-04-06T07:05:01.000Z',
    });
    expect(duplicateWindow).toEqual(timeoutWindow);

    jest.advanceTimersByTime(1000);

    expect(runtime.getState()).toMatchObject({
      event: 'transfer_timeout',
      status: 'timeout',
      isTerminal: true,
    });

    runtime.transition('transfer_completed');

    expect(runtime.getState()).toMatchObject({
      event: 'transfer_timeout',
      status: 'timeout',
      isTerminal: true,
    });

    await runtime.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

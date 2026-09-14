import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { runAfterActionListClose } from './runAfterClose';

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(),
  },
}));

const mockWait = jest.mocked(timerUtils.wait);

describe('runAfterActionListClose', () => {
  beforeEach(() => {
    mockWait.mockReset();
  });

  it('closes and waits before running an asynchronous callback', async () => {
    const order: string[] = [];
    let finishWait: (() => void) | undefined;
    mockWait.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishWait = resolve;
        }),
    );
    const close = jest.fn(() => {
      order.push('close');
    });
    const callback = jest.fn(async () => {
      order.push('callback');
      return 'result';
    });

    const resultPromise = runAfterActionListClose(close, callback);

    expect(order).toEqual(['close']);
    await Promise.resolve();
    expect(mockWait).toHaveBeenCalledWith(150);
    expect(callback).not.toHaveBeenCalled();

    finishWait?.();

    await expect(resultPromise).resolves.toBe('result');
    expect(order).toEqual(['close', 'callback']);
  });

  it('rejects when the callback throws synchronously', async () => {
    mockWait.mockResolvedValue(undefined);
    const error = new Error('sync failure');

    await expect(
      runAfterActionListClose(jest.fn(), () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it('runs immediately after closing when no animation wait is needed', async () => {
    const order: string[] = [];

    await runAfterActionListClose(
      () => {
        order.push('close');
      },
      () => {
        order.push('callback');
      },
      { waitForAnimation: false },
    );

    expect(mockWait).not.toHaveBeenCalled();
    expect(order).toEqual(['close', 'callback']);
  });

  it('preserves an asynchronous callback rejection', async () => {
    mockWait.mockResolvedValue(undefined);
    const error = new Error('async failure');

    await expect(
      runAfterActionListClose(jest.fn(), () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('does not run the callback when closing rejects', async () => {
    const error = new Error('close failure');
    const callback = jest.fn();

    await expect(
      runAfterActionListClose(() => Promise.reject(error), callback),
    ).rejects.toBe(error);
    expect(mockWait).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});

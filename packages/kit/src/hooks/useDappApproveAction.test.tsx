/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

// The non-standalone resolve path fire-and-forgets its resolveCallback RPC
// (`void ...`), which is fine for flows that don't care about delivery — but
// BatchTxConfirm's Done must know the callback actually reached bg on
// split-runtime targets (mobile / ext side panel) so a failed RPC keeps the
// page open for retry instead of silently dropping collected signatures.
// These tests pin the `awaitAck` contract that makes that possible.

// Mock fns are created inside the (hoisted) factory and bridged out via
// globalThis so tests can reference them without an unbound member access
// on the typed proxy object.
jest.mock('../background/instance/backgroundApiProxy', () => {
  const resolveCallback = jest.fn();
  const rejectCallback = jest.fn();
  (globalThis as any).__dappApproveActionMocks = {
    resolveCallback,
    rejectCallback,
  };
  return {
    __esModule: true,
    default: {
      servicePromise: {
        resolveCallback,
        rejectCallback,
      },
    },
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  // Non-standalone, non-side-panel: the platform shape of mobile / desktop /
  // ext side panel's resolve branch under test.
  default: {
    isExtensionUiStandaloneWindow: false,
    isExtensionUiSidePanel: false,
  },
}));

import { act, renderHook } from '@testing-library/react';

import useDappApproveAction from './useDappApproveAction';

const { resolveCallback: mockResolveCallback } = (globalThis as any)
  .__dappApproveActionMocks as {
  resolveCallback: jest.Mock;
  rejectCallback: jest.Mock;
};

describe('useDappApproveAction resolve ack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('default resolve does not wait for the resolveCallback ack', async () => {
    // A never-settling ack: if resolve awaited it, this test would time out.
    mockResolveCallback.mockReturnValue(new Promise(() => {}));
    const close = jest.fn();
    const { result } = renderHook(() => useDappApproveAction({ id: 1 }));

    await act(async () => {
      await result.current.resolve({ close, result: ['hex'] });
    });

    expect(mockResolveCallback).toHaveBeenCalledWith({
      id: 1,
      data: ['hex'],
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('awaitAck resolve waits for the ack before closing', async () => {
    let settleAck!: () => void;
    mockResolveCallback.mockReturnValue(
      new Promise<void>((resolvePromise) => {
        settleAck = resolvePromise;
      }),
    );
    const close = jest.fn();
    const { result } = renderHook(() => useDappApproveAction({ id: 1 }));

    await act(async () => {
      const pending = result.current.resolve({
        close,
        result: ['hex'],
        awaitAck: true,
      });
      // Flush microtasks: the resolveCallback RPC has been issued but its
      // ack has not settled — close must not have run yet.
      await Promise.resolve();
      await Promise.resolve();
      expect(close).not.toHaveBeenCalled();
      settleAck();
      await pending;
    });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('awaitAck resolve propagates an ack failure and skips close', async () => {
    const ackError = new Error('bridge down');
    mockResolveCallback.mockReturnValue(Promise.reject(ackError));
    const close = jest.fn();
    const { result } = renderHook(() => useDappApproveAction({ id: 1 }));

    await act(async () => {
      await expect(
        result.current.resolve({ close, result: ['hex'], awaitAck: true }),
      ).rejects.toBe(ackError);
    });

    expect(close).not.toHaveBeenCalled();
  });
});

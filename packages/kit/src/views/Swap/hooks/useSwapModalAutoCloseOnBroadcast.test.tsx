import { act, renderHook } from '@testing-library/react-native';

import { useSwapModalAutoCloseOnBroadcast } from './useSwapModalAutoCloseOnBroadcast';

function createDeferred() {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderAutoClose({
  enabled = true,
  isFocused = true,
  close = jest.fn().mockResolvedValue(undefined),
  onPopStack = jest.fn(),
}: {
  enabled?: boolean;
  isFocused?: boolean;
  close?: jest.Mock<Promise<void>, []>;
  onPopStack?: jest.Mock<void, []>;
} = {}) {
  const dialogRef = { current: { close } };
  const view = renderHook(
    (props: { enabled: boolean; isFocused: boolean }) =>
      useSwapModalAutoCloseOnBroadcast({
        ...props,
        dialogRef,
        onPopStack,
      }),
    { initialProps: { enabled, isFocused } },
  );
  return { ...view, close, onPopStack };
}

describe('useSwapModalAutoCloseOnBroadcast', () => {
  it('closes the owned review dialog before popping the focused Swap modal', async () => {
    const { result, close, onPopStack } = renderAutoClose();

    await act(async () => {
      await result.current();
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(onPopStack).toHaveBeenCalledTimes(1);
    expect(close.mock.invocationCallOrder[0]).toBeLessThan(
      onPopStack.mock.invocationCallOrder[0],
    );
  });

  it('waits for an overlaid signature modal to return focus to Swap', async () => {
    const { result, rerender, close, onPopStack } = renderAutoClose({
      isFocused: false,
    });

    await act(async () => {
      await result.current();
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(onPopStack).not.toHaveBeenCalled();

    rerender({ enabled: true, isFocused: true });
    expect(onPopStack).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the caller did not opt in', async () => {
    const { result, close, onPopStack } = renderAutoClose({ enabled: false });

    await act(async () => {
      await result.current();
    });

    expect(close).not.toHaveBeenCalled();
    expect(onPopStack).not.toHaveBeenCalled();
  });

  it('handles duplicate broadcast callbacks only once', async () => {
    const { result, close, onPopStack } = renderAutoClose();

    await act(async () => {
      await result.current();
      await result.current();
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(onPopStack).toHaveBeenCalledTimes(1);
  });

  it('does not navigate after the Swap modal unmounts during dialog close', async () => {
    const deferred = createDeferred();
    const close = jest.fn(() => deferred.promise);
    const { result, unmount, onPopStack } = renderAutoClose({ close });

    let broadcastPromise: Promise<void> | undefined;
    act(() => {
      broadcastPromise = result.current();
    });
    unmount();
    await act(async () => {
      deferred.resolve();
      await broadcastPromise;
    });

    expect(onPopStack).not.toHaveBeenCalled();
  });
});

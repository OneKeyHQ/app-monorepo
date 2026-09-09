import { runAddAccountFlowOnce } from './addAccountFlowGuard';

describe('runAddAccountFlowOnce', () => {
  it('shares one in-flight flow across concurrent callers', async () => {
    let finishFlow: (() => void) | undefined;
    const flow = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFlow = resolve;
        }),
    );

    const first = runAddAccountFlowOnce('wallet-1', flow);
    const second = runAddAccountFlowOnce('wallet-1', flow);

    expect(second).toBe(first);
    expect(flow).toHaveBeenCalledTimes(1);

    finishFlow?.();
    await first;

    const third = runAddAccountFlowOnce('wallet-1', flow);
    expect(flow).toHaveBeenCalledTimes(2);
    finishFlow?.();
    await third;
  });

  it('runs flows for different wallets independently', async () => {
    let finishFirstFlow: (() => void) | undefined;
    const firstFlow = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFirstFlow = resolve;
        }),
    );
    const secondFlow = jest.fn(async () => undefined);

    const first = runAddAccountFlowOnce('wallet-2', firstFlow);
    const second = runAddAccountFlowOnce('wallet-3', secondFlow);

    expect(second).not.toBe(first);
    await expect(second).resolves.toBeUndefined();
    expect(firstFlow).toHaveBeenCalledTimes(1);
    expect(secondFlow).toHaveBeenCalledTimes(1);

    finishFirstFlow?.();
    await first;
  });

  it('releases the guard after a rejected flow', async () => {
    const flow = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(undefined);

    await expect(runAddAccountFlowOnce('wallet-4', flow)).rejects.toThrow(
      'failed',
    );
    await expect(
      runAddAccountFlowOnce('wallet-4', flow),
    ).resolves.toBeUndefined();
    expect(flow).toHaveBeenCalledTimes(2);
  });
});

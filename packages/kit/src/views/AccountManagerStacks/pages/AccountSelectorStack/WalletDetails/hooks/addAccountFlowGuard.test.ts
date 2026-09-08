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

    const first = runAddAccountFlowOnce(flow);
    const second = runAddAccountFlowOnce(flow);

    expect(second).toBe(first);
    expect(flow).toHaveBeenCalledTimes(1);

    finishFlow?.();
    await first;

    const third = runAddAccountFlowOnce(flow);
    expect(flow).toHaveBeenCalledTimes(2);
    finishFlow?.();
    await third;
  });

  it('releases the guard after a rejected flow', async () => {
    const flow = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce(undefined);

    await expect(runAddAccountFlowOnce(flow)).rejects.toThrow('failed');
    await expect(runAddAccountFlowOnce(flow)).resolves.toBeUndefined();
    expect(flow).toHaveBeenCalledTimes(2);
  });
});

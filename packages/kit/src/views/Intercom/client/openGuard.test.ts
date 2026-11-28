import { createIntercomOpenGuard } from './openGuard';

describe('createIntercomOpenGuard', () => {
  it('runs a new compose while an open with the same request id is still pending', async () => {
    const guard = createIntercomOpenGuard(() => undefined);
    let releaseFirst: (opened: boolean) => void = () => undefined;
    const first = guard.run(
      null,
      { requestId: 'r-1' },
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const opened: string[] = [];
    const second = guard.run(
      null,
      { requestId: 'r-1', composeId: 'compose-2' },
      async () => {
        opened.push('compose-2');
        return true;
      },
    );

    await second;
    expect(opened).toEqual(['compose-2']);
    releaseFirst(true);
    await first;
  });

  it('still coalesces two opens that share only a request id', async () => {
    const guard = createIntercomOpenGuard(() => undefined);
    let calls = 0;
    let releaseFirst: (opened: boolean) => void = () => undefined;
    const first = guard.run(
      null,
      { requestId: 'r-1' },
      () =>
        new Promise((resolve) => {
          calls += 1;
          releaseFirst = resolve;
        }),
    );
    const second = guard.run(null, { requestId: 'r-1' }, async () => {
      calls += 1;
      return true;
    });

    expect(second).toBe(first);
    await Promise.resolve();
    expect(calls).toBe(1);
    releaseFirst(true);
    await first;
  });
});

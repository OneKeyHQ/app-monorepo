import { publishLatestOrderBookOptions } from './instrumentSwitch';

describe('publishLatestOrderBookOptions', () => {
  it('does not publish stale options after a newer instrument switch starts', async () => {
    let resolveRead: (value: { coin: string } | undefined) => void = () =>
      undefined;
    const read = new Promise<{ coin: string } | undefined>((resolve) => {
      resolveRead = resolve;
    });
    const write = jest.fn<Promise<void>, [{ coin: string }]>(() =>
      Promise.resolve(),
    );
    let latestRequestId = 1;

    const publish = publishLatestOrderBookOptions({
      read: () => read,
      write,
      next: { coin: '@107' },
      isLatest: () => latestRequestId === 1,
    });

    latestRequestId = 2;
    resolveRead(undefined);

    await expect(publish).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  it('publishes options when the instrument switch is still current', async () => {
    const write = jest.fn<Promise<void>, [{ coin: string }]>(() =>
      Promise.resolve(),
    );

    await expect(
      publishLatestOrderBookOptions({
        read: () => Promise.resolve({ coin: '@106' }),
        write,
        next: { coin: '@107' },
        isLatest: () => true,
      }),
    ).resolves.toBe(true);
    expect(write).toHaveBeenCalledWith({ coin: '@107' });
  });

  it('serializes writes so the latest instrument remains committed', async () => {
    let latestRequestId = 1;
    let committed = { coin: '@106' };
    let releaseFirstWrite: (() => void) | undefined;
    let markFirstWriteStarted: (() => void) | undefined;
    const firstWriteStarted = new Promise<void>((resolve) => {
      markFirstWriteStarted = resolve;
    });
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const write = async (value: { coin: string }) => {
      if (value.coin === '@107') {
        markFirstWriteStarted?.();
        await firstWriteBlocked;
      }
      committed = value;
    };

    const first = publishLatestOrderBookOptions({
      read: () => Promise.resolve(committed),
      write,
      next: { coin: '@107' },
      isLatest: () => latestRequestId === 1,
    });
    await firstWriteStarted;

    latestRequestId = 2;
    const latest = publishLatestOrderBookOptions({
      read: () => Promise.resolve(committed),
      write,
      next: { coin: '@108' },
      isLatest: () => latestRequestId === 2,
    });
    await Promise.resolve();
    releaseFirstWrite?.();

    await expect(first).resolves.toBe(false);
    await expect(latest).resolves.toBe(true);
    expect(committed).toEqual({ coin: '@108' });
  });
});

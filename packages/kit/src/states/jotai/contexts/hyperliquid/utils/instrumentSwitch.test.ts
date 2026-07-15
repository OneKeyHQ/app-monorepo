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
});

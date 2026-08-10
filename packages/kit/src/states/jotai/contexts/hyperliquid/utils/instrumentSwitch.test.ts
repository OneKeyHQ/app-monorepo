import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  captureSubscriptionRecoveryProof,
  publishLatestOrderBookOptions,
  recoverSubscriptionsWithProof,
  shouldSyncSubscriptionsAfterInstrumentChange,
} from './instrumentSwitch';

describe('recoverSubscriptionsWithProof', () => {
  it('does not call recover when no proof is present', async () => {
    const recover = jest.fn<Promise<boolean>, [number]>();

    await expect(
      recoverSubscriptionsWithProof({
        recoveryProof: undefined,
        recover,
      }),
    ).resolves.toBe(false);
    expect(recover).not.toHaveBeenCalled();
  });

  it('forwards the proof generation to recover and returns its result', async () => {
    const recover = jest
      .fn<Promise<boolean>, [number]>()
      .mockResolvedValue(true);

    await expect(
      recoverSubscriptionsWithProof({
        recoveryProof: { disabledCount: 6, source: 'token-selector' },
        recover,
      }),
    ).resolves.toBe(true);
    expect(recover).toHaveBeenCalledWith(6);
  });

  it('falls back safely when recover rejects', async () => {
    await expect(
      recoverSubscriptionsWithProof({
        recoveryProof: { disabledCount: 6, source: 'token-selector' },
        recover: async () => {
          throw new OneKeyLocalError('bridge unavailable');
        },
      }),
    ).resolves.toBe(false);
  });
});

describe('captureSubscriptionRecoveryProof', () => {
  it('captures the bg generation while the UI source stays live', async () => {
    await expect(
      captureSubscriptionRecoveryProof({
        source: 'token-selector',
        isSourceLive: () => true,
        isAppVisible: () => true,
        isAppLocked: async () => false,
        readDisabledCount: async () => 4,
      }),
    ).resolves.toEqual({
      disabledCount: 4,
      source: 'token-selector',
    });
  });

  it('drops the proof when the UI source disappears during the bridge read', async () => {
    let live = true;

    await expect(
      captureSubscriptionRecoveryProof({
        source: 'token-selector',
        isSourceLive: () => live,
        isAppVisible: () => true,
        isAppLocked: async () => false,
        readDisabledCount: async () => {
          live = false;
          return 4;
        },
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['hidden', false, false],
    ['locked', true, true],
  ])('drops the proof when the app is %s', async (_name, visible, locked) => {
    await expect(
      captureSubscriptionRecoveryProof({
        source: 'token-selector',
        isSourceLive: () => true,
        isAppVisible: () => visible,
        isAppLocked: async () => locked,
        readDisabledCount: async () => 4,
      }),
    ).resolves.toBeUndefined();
  });

  it('falls back safely when the bg generation read rejects', async () => {
    await expect(
      captureSubscriptionRecoveryProof({
        source: 'token-selector',
        isSourceLive: () => true,
        isAppVisible: () => true,
        isAppLocked: async () => false,
        readDisabledCount: async () => {
          throw new OneKeyLocalError('bridge unavailable');
        },
      }),
    ).resolves.toBeUndefined();
  });
});

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

describe('shouldSyncSubscriptionsAfterInstrumentChange', () => {
  it('keeps a token-selector proof valid after the selector closes', () => {
    expect(
      shouldSyncSubscriptionsAfterInstrumentChange({
        viewState: {
          routeFocused: false,
          tokenSelectorOpen: false,
          tokenSelectorTab: 'perps',
          infoPanelTab: 'Positions',
          favoritesBarSpotActive: false,
        },
        recoveryProof: {
          disabledCount: 3,
          source: 'token-selector',
        },
      }),
    ).toBe(true);
  });
});

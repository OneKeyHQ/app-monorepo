/* eslint-disable import/first */

jest.mock('@onekeyhq/components/src/primitives/Image/preload', () => ({
  preloadImage: jest.fn(),
  s: (size: number) => size,
}));
jest.mock('@onekeyhq/kit/src/utils/deferHeavyWork', () => ({
  deferHeavyWorkUntilUIIdle: jest.fn(async () => undefined),
}));

import { waitFor } from '@testing-library/react-native';

import { preloadImage } from '@onekeyhq/components/src/primitives/Image/preload';
import { deferHeavyWorkUntilUIIdle } from '@onekeyhq/kit/src/utils/deferHeavyWork';
import type {
  IBorrowMarketItem,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import {
  createBorrowImagePrewarmSession,
  getBorrowMarketIconSources,
  getBorrowVisibleAssetIconSources,
  invalidateBorrowImagePrewarmCache,
  prewarmBorrowImages,
  prewarmBorrowImagesAndWait,
  waitForBorrowImagePrewarmIdle,
} from './borrowImagePrewarm';

const market = {
  logoURI: 'https://example.com/kamino.png',
  network: { logoURI: 'https://example.com/solana.png' },
} as IBorrowMarketItem;

describe('Borrow image prewarm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the trigger and menu image sizes for both logo and badge', () => {
    expect(getBorrowMarketIconSources(market, 'md')).toEqual([
      { uri: market.logoURI, resizeWidth: 32 },
      { uri: market.network.logoURI, resizeWidth: 16 },
    ]);
    expect(getBorrowMarketIconSources(market, 'sm')).toEqual([
      { uri: market.logoURI, resizeWidth: 24 },
      { uri: market.network.logoURI, resizeWidth: 12 },
    ]);
  });

  it('bounds visible position and row image variants', () => {
    const reserves = {
      supplied: {
        assets: [
          'position-a',
          'position-b',
          'position-c',
          'position-d',
          'position-e',
        ].map((uri, index) => ({
          reserveAddress: uri,
          token: { logoURI: uri },
          suppliedAmount: { number: '1', fiatValue: String(3 - index) },
        })),
      },
      borrowed: { assets: [] },
      supply: {
        assets: ['row-a', 'row-b', 'row-c', 'row-d', 'row-e'].map(
          (uri, index) => ({
            reserveAddress: uri,
            token: { logoURI: uri },
            walletBalance: { fiatValue: String(index) },
          }),
        ),
      },
    } as unknown as IBorrowReserveItem;

    expect(getBorrowVisibleAssetIconSources({ reserves, market })).toEqual([
      { uri: 'position-a', resizeWidth: 40 },
      { uri: 'position-b', resizeWidth: 40 },
      { uri: 'position-c', resizeWidth: 40 },
      { uri: 'position-d', resizeWidth: 40 },
      { uri: 'row-e', resizeWidth: 32 },
      { uri: 'row-d', resizeWidth: 32 },
      { uri: 'row-c', resizeWidth: 32 },
      { uri: 'row-b', resizeWidth: 32 },
    ]);
  });

  it('does not spend the image budget on rows hidden by Borrow filters', () => {
    const reserves = {
      supplied: { assets: [] },
      borrowed: { assets: [] },
      supply: {
        assets: [
          {
            reserveAddress: '',
            token: { logoURI: 'native-hidden' },
            walletBalance: { fiatValue: '100' },
          },
          {
            reserveAddress: '0xusdc',
            token: { logoURI: 'usdc-visible' },
            walletBalance: { fiatValue: '1' },
          },
        ],
      },
    } as unknown as IBorrowReserveItem;

    expect(
      getBorrowVisibleAssetIconSources({
        reserves,
        market: { provider: 'aave', networkId: 'evm--137' },
      }),
    ).toEqual([{ uri: 'usdc-visible', resizeWidth: 32 }]);
  });

  it('starts selected-market images while a background image is still loading', async () => {
    let releaseFirst: ((value: boolean) => void) | undefined;
    let releaseSelected: ((value: boolean) => void) | undefined;
    const firstRequest = new Promise<boolean>((resolve) => {
      releaseFirst = resolve;
    });
    const selectedRequest = new Promise<boolean>((resolve) => {
      releaseSelected = resolve;
    });
    jest
      .mocked(preloadImage)
      .mockImplementationOnce(() => firstRequest)
      .mockImplementationOnce(() => selectedRequest)
      .mockResolvedValue(true);

    prewarmBorrowImages([
      { uri: 'https://example.com/first.png', resizeWidth: 24 },
      { uri: 'https://example.com/background.png', resizeWidth: 24 },
    ]);
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));

    prewarmBorrowImages(
      [{ uri: 'https://example.com/selected.png', resizeWidth: 32 }],
      { priority: true },
    );
    const cancelObsolete = prewarmBorrowImages([
      { uri: 'https://example.com/obsolete.png', resizeWidth: 24 },
    ]);
    cancelObsolete();
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(2));
    expect(
      jest.mocked(preloadImage).mock.calls.map(([source]) => source.uri),
    ).toEqual([
      'https://example.com/first.png',
      'https://example.com/selected.png',
    ]);
    releaseFirst?.(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preloadImage).toHaveBeenCalledTimes(2);
    releaseSelected?.(true);

    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(3));
    expect(
      jest.mocked(preloadImage).mock.calls.map(([source]) => source.uri),
    ).toEqual([
      'https://example.com/first.png',
      'https://example.com/selected.png',
      'https://example.com/background.png',
    ]);
  });

  it('starts the latest selected market while an obsolete foreground image is still loading', async () => {
    let releaseObsolete: ((value: boolean) => void) | undefined;
    jest
      .mocked(preloadImage)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseObsolete = resolve;
          }),
      )
      .mockResolvedValue(true);

    const cancelObsolete = prewarmBorrowImages(
      [
        { uri: 'https://example.com/obsolete-active.png', resizeWidth: 32 },
        { uri: 'https://example.com/obsolete-queued.png', resizeWidth: 16 },
      ],
      { priority: true },
    );
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));

    cancelObsolete();
    prewarmBorrowImages(
      [{ uri: 'https://example.com/latest-market.png', resizeWidth: 32 }],
      { priority: true },
    );
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(2));
    expect(
      jest.mocked(preloadImage).mock.calls.map(([source]) => source.uri),
    ).toEqual([
      'https://example.com/obsolete-active.png',
      'https://example.com/latest-market.png',
    ]);

    releaseObsolete?.(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preloadImage).toHaveBeenCalledTimes(2);
  });

  it('rechecks a successful native preload after its short freshness window', async () => {
    let now = 100_000;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      jest.mocked(preloadImage).mockResolvedValue(true);
      const source = {
        uri: 'https://example.com/ttl-refresh.png',
        resizeWidth: 32,
      };

      prewarmBorrowImages([source], { priority: true });
      await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 0));

      now += 29_999;
      prewarmBorrowImages([source], { priority: true });
      expect(preloadImage).toHaveBeenCalledTimes(1);

      now += 1;
      prewarmBorrowImages([source], { priority: true });
      await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(2));
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('rechecks an image immediately after native cache clearing', async () => {
    jest.mocked(preloadImage).mockResolvedValue(true);
    const source = {
      uri: 'https://example.com/cache-cleared.png',
      resizeWidth: 32,
    };

    prewarmBorrowImages([source], { priority: true });
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    invalidateBorrowImagePrewarmCache();
    prewarmBorrowImages([source], { priority: true });
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(2));
  });

  it('does not restore a success marker from a request started before cache clearing', async () => {
    let releaseOldRequest: ((value: boolean) => void) | undefined;
    jest
      .mocked(preloadImage)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseOldRequest = resolve;
          }),
      )
      .mockResolvedValue(true);
    const source = {
      uri: 'https://example.com/cache-cleared-during-request.png',
      resizeWidth: 32,
    };

    prewarmBorrowImages([source], { priority: true });
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));
    invalidateBorrowImagePrewarmCache();
    releaseOldRequest?.(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    prewarmBorrowImages([source], { priority: true });
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(2));
  });

  it('waits for active native requests and drops queued work before cache clearing', async () => {
    let releaseActive: ((value: boolean) => void) | undefined;
    jest.mocked(preloadImage).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseActive = resolve;
        }),
    );

    prewarmBorrowImages(
      [{ uri: 'https://example.com/active-before-clear.png', resizeWidth: 32 }],
      { priority: true },
    );
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));
    prewarmBorrowImages(
      [{ uri: 'https://example.com/queued-before-clear.png', resizeWidth: 32 }],
      { priority: true },
    );

    let isIdle = false;
    const idlePromise = waitForBorrowImagePrewarmIdle().then(() => {
      isIdle = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(isIdle).toBe(false);

    releaseActive?.(true);
    await idlePromise;
    expect(preloadImage).toHaveBeenCalledTimes(1);
    invalidateBorrowImagePrewarmCache();
  });

  it('demotes a queued image when its selected-market owner is cancelled', async () => {
    let releaseForeground: ((value: boolean) => void) | undefined;
    jest
      .mocked(preloadImage)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            releaseForeground = resolve;
          }),
      )
      .mockResolvedValue(true);
    prewarmBorrowImages(
      [
        {
          uri: 'https://example.com/foreground-occupier.png',
          resizeWidth: 32,
        },
      ],
      { priority: true },
    );
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(1));

    let releaseIdle: (() => void) | undefined;
    jest.mocked(deferHeavyWorkUntilUIIdle).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseIdle = resolve;
        }),
    );
    const source = {
      uri: 'https://example.com/shared-after-cancel.png',
      resizeWidth: 32,
    };
    const cancelBackground = prewarmBorrowImages([source]);
    const cancelSelected = prewarmBorrowImages([source], { priority: true });
    cancelSelected();
    releaseForeground?.(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preloadImage).toHaveBeenCalledTimes(1);
    releaseIdle?.();
    await waitFor(() => expect(preloadImage).toHaveBeenCalledTimes(2));
    cancelBackground();
  });

  it('cancels an inactive page session before its queued native preload', async () => {
    let releaseIdle: (() => void) | undefined;
    jest.mocked(deferHeavyWorkUntilUIIdle).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseIdle = resolve;
        }),
    );
    const session = createBorrowImagePrewarmSession('account-a');
    session.enqueue('market-a', [
      { uri: 'https://example.com/session-cancel.png', resizeWidth: 32 },
    ]);
    session.cancel();
    releaseIdle?.();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(preloadImage).not.toHaveBeenCalled();
  });

  it('resolves target readiness after shared queued images settle', async () => {
    jest.mocked(preloadImage).mockResolvedValue(true);
    const sources = [
      { uri: 'https://example.com/target-market.png', resizeWidth: 32 },
      { uri: 'https://example.com/target-token.png', resizeWidth: 32 },
    ];

    const readiness = prewarmBorrowImagesAndWait(sources, { priority: true });

    await expect(readiness.promise).resolves.toBe(true);
    expect(preloadImage).toHaveBeenCalledTimes(2);
  });
});

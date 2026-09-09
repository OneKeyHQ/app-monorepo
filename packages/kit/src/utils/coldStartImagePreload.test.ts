/* eslint-disable import/first */
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';

const mockPreloadImages: jest.Mock<Promise<boolean>, unknown[]> = jest.fn();

// jest maps every '@onekeyhq/components*' path to __mocks__/componentsMock.ts, so
// this factory must also keep the `s` scale helper that tokenSize.ts reads.
jest.mock('@onekeyhq/components/src/primitives/Image/preload', () => ({
  s: (size: number) => size,
  preloadImages: (...args: unknown[]) => mockPreloadImages(...args),
}));

const mockGetWithTimestamp: jest.Mock<
  { data: unknown; updatedAt: number } | undefined,
  [string]
> = jest.fn();

jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/swrCacheUtils')
  >('@onekeyhq/shared/src/utils/swrCacheUtils');
  return {
    ...actual,
    swrCacheUtils: {
      ...actual.swrCacheUtils,
      getWithTimestamp: (key: string) => mockGetWithTimestamp(key),
    },
  };
});

import {
  HEADER_NETWORK_LOGO_SIZE,
  WALLET_BANNER_IMAGE_SIZE,
  getColdStartCriticalImageItemsFromSnapshot,
  getColdStartImageUrisFromSnapshot,
  prewarmColdStartImagesFromSnapshot,
  startColdStartImagePrewarm,
  waitForColdStartCriticalImages,
} from './coldStartImagePreload';

const bannerUri = 'https://uni.onekey-asset.com/banner/smci.png';
const tokenUri = 'https://uni.onekey-asset.com/icons/eth.png';
const ethNetworkLogoUri = 'https://uni.onekey-asset.com/static/chain/eth.png';
const btcNetworkLogoUri = 'https://uni.onekey-asset.com/static/chain/btc.png';
const solNetworkLogoUri = 'https://uni.onekey-asset.com/static/chain/sol.png';
const HD_WALLET_ID = 'hd-1';
const INDEXED_ACCOUNT_ID = 'hd-1--0';

const snapshot = {
  [`store-a::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.walletTopBannersAtom}`]: {
    banners: [
      { id: 'smci', src: bannerUri },
      { id: 'local-referral', src: '' },
      { id: 'inline', src: 'data:image/png;base64,AAAA' },
      { id: 'dup', src: bannerUri },
    ],
  },
  [`store-a::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.tokenListSlimColdCacheAtom}`]:
    {
      compactMeta: {
        eth: { logoURI: tokenUri },
      },
    },
};

describe('coldStartImagePreload wallet banner images (OK-61505)', () => {
  beforeEach(() => {
    mockPreloadImages.mockReset();
    mockPreloadImages.mockResolvedValue(true);
  });

  it('collects remote banner images ahead of token logos, sized to the banner card', () => {
    expect(getColdStartImageUrisFromSnapshot(snapshot)).toEqual([
      { uri: bannerUri, resizeWidth: WALLET_BANNER_IMAGE_SIZE },
      tokenUri,
    ]);
  });

  it('prewarms banner images with the banner size instead of the token default', async () => {
    await prewarmColdStartImagesFromSnapshot({ snapshot });

    expect(mockPreloadImages).toHaveBeenCalledTimes(1);
    const sources = mockPreloadImages.mock.calls[0][0] as Array<{
      uri: string;
      resizeWidth?: number;
    }>;
    expect(sources).toEqual([
      expect.objectContaining({
        uri: bannerUri,
        resizeWidth: WALLET_BANNER_IMAGE_SIZE,
      }),
      expect.objectContaining({ uri: tokenUri, resizeWidth: 32 }),
    ]);
  });
});

describe('coldStartImagePreload header network logos (OK-61505)', () => {
  const activeAccountsKey = `store:accountSelector@home::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom}`;

  beforeEach(() => {
    mockPreloadImages.mockReset();
    mockPreloadImages.mockResolvedValue(true);
    mockGetWithTimestamp.mockReset();
    mockGetWithTimestamp.mockReturnValue(undefined);
  });

  it('collects the single-network header logo at the header avatar size', () => {
    const items = getColdStartCriticalImageItemsFromSnapshot({
      ...snapshot,
      [activeAccountsKey]: {
        0: {
          network: { id: 'evm--1', logoURI: ethNetworkLogoUri },
          wallet: { id: HD_WALLET_ID },
        },
      },
    });

    expect(items).toEqual([
      { uri: bannerUri, resizeWidth: WALLET_BANNER_IMAGE_SIZE },
      { uri: ethNetworkLogoUri, resizeWidth: HEADER_NETWORK_LOGO_SIZE },
    ]);
    expect(mockGetWithTimestamp).not.toHaveBeenCalled();
  });

  it('collects the first two All Networks compat logos from the trigger swr snapshot', () => {
    const compatKey = swrKeys.allNetworksCompatible({
      walletId: HD_WALLET_ID,
      networkId: 'onekeyall--0',
      filterNetworksWithoutAccount: true,
      indexedAccountId: INDEXED_ACCOUNT_ID,
      withNetworksInfo: false,
      enabledNetworkIdsKey: '',
    });
    mockGetWithTimestamp.mockImplementation((key) =>
      key === compatKey
        ? {
            updatedAt: 1,
            data: {
              compatibleNetworks: [
                { id: 'evm--1', logoURI: ethNetworkLogoUri },
                { id: 'btc--0', logoURI: btcNetworkLogoUri },
                { id: 'sol--101', logoURI: solNetworkLogoUri },
              ],
            },
          }
        : undefined,
    );

    const items = getColdStartCriticalImageItemsFromSnapshot({
      [activeAccountsKey]: {
        0: {
          network: {
            id: 'onekeyall--0',
            isAllNetworks: true,
            logoURI: 'https://uni.onekey-asset.com/static/chain/all.png',
          },
          wallet: { id: HD_WALLET_ID },
          indexedAccount: { id: INDEXED_ACCOUNT_ID },
        },
      },
    });

    expect(items).toEqual([
      { uri: ethNetworkLogoUri, resizeWidth: HEADER_NETWORK_LOGO_SIZE },
      { uri: btcNetworkLogoUri, resizeWidth: HEADER_NETWORK_LOGO_SIZE },
    ]);
  });

  it('skips All Networks compat logos for imported and watching wallets', () => {
    const items = getColdStartCriticalImageItemsFromSnapshot({
      [activeAccountsKey]: {
        0: {
          network: { id: 'onekeyall--0', isAllNetworks: true },
          wallet: { id: 'imported' },
        },
      },
    });

    expect(items).toEqual([]);
    expect(mockGetWithTimestamp).not.toHaveBeenCalled();
  });

  it('lists header logos at the header size ahead of token logos', () => {
    const items = getColdStartImageUrisFromSnapshot({
      ...snapshot,
      [activeAccountsKey]: {
        0: {
          network: { id: 'evm--1', logoURI: ethNetworkLogoUri },
          wallet: { id: HD_WALLET_ID },
        },
      },
    });

    expect(items).toEqual([
      { uri: bannerUri, resizeWidth: WALLET_BANNER_IMAGE_SIZE },
      { uri: ethNetworkLogoUri, resizeWidth: HEADER_NETWORK_LOGO_SIZE },
      tokenUri,
    ]);
  });
});

describe('coldStartImagePreload first-paint prime (OK-61505)', () => {
  beforeEach(() => {
    mockPreloadImages.mockReset();
    mockPreloadImages.mockResolvedValue(true);
    mockGetWithTimestamp.mockReset();
    mockGetWithTimestamp.mockReturnValue(undefined);
  });

  it('awaits the critical subset and fires the rest without waiting', async () => {
    let resolveCritical: ((value: boolean) => void) | undefined;
    mockPreloadImages
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveCritical = resolve;
          }),
      )
      .mockImplementationOnce(() => new Promise<boolean>(() => {}));

    const critical = startColdStartImagePrewarm({ snapshot });

    expect(mockPreloadImages).toHaveBeenCalledTimes(2);
    expect(mockPreloadImages.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        uri: bannerUri,
        resizeWidth: WALLET_BANNER_IMAGE_SIZE,
      }),
    ]);
    expect(mockPreloadImages.mock.calls[1][0]).toEqual([
      expect.objectContaining({ uri: tokenUri, resizeWidth: 32 }),
    ]);

    let settled = false;
    void critical.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveCritical?.(true);
    await expect(critical).resolves.toBe(1);
    await expect(waitForColdStartCriticalImages()).resolves.toBe(1);
  });

  it('resolves immediately when the snapshot has no critical images', async () => {
    await expect(
      startColdStartImagePrewarm({
        snapshot: {
          [`store-a::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.tokenListSlimColdCacheAtom}`]:
            { compactMeta: { eth: { logoURI: tokenUri } } },
        },
      }),
    ).resolves.toBe(0);
    expect(mockPreloadImages).toHaveBeenCalledTimes(1);
  });

  it('does not reject when the native preload fails', async () => {
    mockPreloadImages.mockRejectedValue(new Error('nitro unavailable'));
    await expect(startColdStartImagePrewarm({ snapshot })).resolves.toBe(1);
  });
});

/* eslint-disable import/first */
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';

const mockPreloadImages: jest.Mock<Promise<boolean>, unknown[]> = jest.fn();

// jest maps every '@onekeyhq/components*' path to __mocks__/componentsMock.ts, so
// this factory must also keep the `s` scale helper that tokenSize.ts reads.
jest.mock('@onekeyhq/components/src/primitives/Image/preload', () => ({
  s: (size: number) => size,
  preloadImages: (...args: unknown[]) => mockPreloadImages(...args),
}));

import {
  WALLET_BANNER_IMAGE_SIZE,
  getColdStartImageUrisFromSnapshot,
  prewarmColdStartImagesFromSnapshot,
} from './coldStartImagePreload';

const bannerUri = 'https://uni.onekey-asset.com/banner/smci.png';
const tokenUri = 'https://uni.onekey-asset.com/icons/eth.png';

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

import { EDeviceType } from '@onekeyfe/hd-shared';

import * as nftUtils from './nftUtils';

describe('NFT device collection compatibility', () => {
  it('supports all OneKey touch-screen devices including Pro2', () => {
    const isCompatible = (
      nftUtils as typeof nftUtils & {
        isCollectNFTDeviceCompatible?: (deviceType: EDeviceType) => boolean;
      }
    ).isCollectNFTDeviceCompatible;

    expect(isCompatible?.(EDeviceType.Touch)).toBe(true);
    expect(isCompatible?.(EDeviceType.Pro)).toBe(true);
    expect(isCompatible?.(EDeviceType.Pro2)).toBe(true);
    expect(isCompatible?.(EDeviceType.Neo)).toBe(true);
    expect(isCompatible?.(EDeviceType.Classic1s)).toBe(false);
  });
});

describe('NFT collectible media compatibility', () => {
  test.each(['image/jpeg', 'image/png', 'image/bmp; charset=binary'])(
    'accepts a static image: %s',
    (mimeType) => {
      expect(nftUtils.isCollectibleNftImageMimeType(mimeType)).toBe(true);
    },
  );

  test.each([
    'image/gif',
    'image/apng',
    'image/webp',
    'video/mp4',
    'application/json',
    undefined,
  ])('rejects unsupported or dynamic media: %s', (mimeType) => {
    expect(nftUtils.isCollectibleNftImageMimeType(mimeType)).toBe(false);
  });
});

describe('generatePro2NftMetadata', () => {
  it('truncates title and subtitle by UTF-8 bytes without splitting characters', () => {
    expect(
      nftUtils.generatePro2NftMetadata({
        title: `${'a'.repeat(62)}中`,
        subtitle: `${'b'.repeat(94)}文`,
      }),
    ).toEqual({
      title: 'a'.repeat(62),
      subtitle: 'b'.repeat(94),
    });
  });
});

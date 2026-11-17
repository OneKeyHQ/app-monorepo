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
  test.each([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/bmp; charset=binary',
  ])('accepts a static image: %s', (mimeType) => {
    expect(nftUtils.isCollectibleNftImageMimeType(mimeType)).toBe(true);
  });

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

  it('limits dynamic media only on Protocol V2 devices', () => {
    expect(
      nftUtils.isCollectibleNftMediaSupportedOnDevice(
        EDeviceType.Touch,
        'image/gif',
      ),
    ).toBe(true);
    expect(
      nftUtils.isCollectibleNftMediaSupportedOnDevice(
        EDeviceType.Pro,
        'image/apng',
      ),
    ).toBe(true);
    expect(
      nftUtils.isCollectibleNftMediaSupportedOnDevice(
        EDeviceType.Pro2,
        'image/gif',
      ),
    ).toBe(false);
    expect(
      nftUtils.isCollectibleNftMediaSupportedOnDevice(
        EDeviceType.Neo,
        'image/apng',
      ),
    ).toBe(false);
    expect(
      nftUtils.isCollectibleNftMediaSupportedOnDevice(
        EDeviceType.Pro2,
        'image/png',
      ),
    ).toBe(true);
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

describe('NFT media probe order', () => {
  test.each([
    'https://cdn.example.com/asset.mp4',
    'https://cdn.example.com/asset.MP4?x=1#frag',
    'https://cdn.example.com/path/clip.webm',
    'https://cdn.example.com/clip.mov',
    'https://cdn.example.com/clip.m4v',
    'data:video/mp4;base64,AAAA',
  ])('probes video first for %s', (uri) => {
    expect(nftUtils.getNFTMediaProbeOrder(uri)).toEqual(['video', 'image']);
  });

  test.each([
    'https://nft-cdn.alchemy.com/eth-mainnet/c4da802c554f078e07dc43933f79dd64',
    'https://cdn.example.com/asset.png',
    'https://cdn.example.com/asset.svg?mp4=true',
    'https://cdn.example.com/mp4/asset',
    'data:image/png;base64,AAAA',
    'ipfs://bafy/asset.gif',
  ])('probes image first for %s', (uri) => {
    expect(nftUtils.getNFTMediaProbeOrder(uri)).toEqual(['image', 'video']);
  });

  test.each(['', '   ', undefined])('has nothing to probe for %p', (uri) => {
    expect(nftUtils.getNFTMediaProbeOrder(uri)).toEqual([]);
  });
});

import type { ReactNode } from 'react';

import { act, create } from 'react-test-renderer';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ENFTType } from '@onekeyhq/shared/types/nft';

import { CommonAssetImage } from './CommonAssetImage';

import type { ReactTestRenderer } from 'react-test-renderer';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: true },
}));

jest.mock('./UnSupportedImageContainer', () => ({
  UnSupportedImageContainer: () => 'legacy-webview',
}));

jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const component = (name: string) => {
    function MockComponent(props: { children?: ReactNode }) {
      return createElement(name, props, props.children);
    }
    MockComponent.displayName = name;
    return MockComponent;
  };
  return {
    Image: Object.assign(component('img'), {
      Fallback: component('aside'),
    }),
    Icon: component('icon'),
    Stack: component('stack'),
    SizableText: component('text'),
    Video: component('video'),
  };
});

jest.mock('@onekeyhq/shared/src/utils/nftUtils', () => ({
  getNFTMediaProbeOrder: () => ['image', 'video'],
}));

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>红+蓝</title><rect width="24" height="24" fill="red"/></svg>';
const normalizedSVG = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

describe('NFT detail image', () => {
  it.each([
    [
      'https://nft2-cdn.alchemy.com/eth-mainnet/svg-without-extension',
      'https://nft2-cdn.alchemy.com/eth-mainnet/svg-without-extension',
    ],
    [
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    ],
    [
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      normalizedSVG,
    ],
    [`data:image/svg+xml,${svg}`, normalizedSVG],
    [
      `data:image/svg+xml,${encodeURIComponent(svg).replace('%2B', '+')}`,
      normalizedSVG,
    ],
  ])('uses the native image path and fallback for %s', (image, expected) => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <CommonAssetImage
          nft={{
            amount: '1',
            collectionAddress: '0xcollection',
            collectionName: 'Collection',
            collectionSymbol: 'NFT',
            collectionType: ENFTType.ERC721,
            itemId: '1982',
            metadata: {
              image,
              description: '',
              externalUrl: '',
              itemUrl: '',
            },
          }}
        />,
      );
    });
    const nativeImage = renderer!.root.findByType('img');
    expect(nativeImage.props.src).toBe(expected);
    expect(nativeImage.props.resizeWidth).toBe(480);
    expect(nativeImage.props.fallback).toBeTruthy();

    const imageError = nativeImage.props.onError as () => void;
    act(() => {
      imageError();
    });
    const video = renderer!.root.findByType('video');
    expect(video.props.source).toEqual({ uri: image });
    const videoError = video.props.onError as () => void;
    act(() => {
      videoError();
    });
    expect(renderer!.root.findAllByType('img')).toHaveLength(0);
    expect(renderer!.root.findAllByType('video')).toHaveLength(0);
    expect(renderer!.root.findAllByType('aside')).toHaveLength(1);
    act(() => renderer!.unmount());
  });
  it.each([
    'data:image/svg+xml,%ZZ',
    'data:image/svg+xml,%E0%A4',
    'data:image/svg+xml,\ud800',
    `data:image/svg+xml,${'x'.repeat(8 * 1024 * 1024 + 1)}`,
    `data:image/svg+xml,${'红'.repeat(Math.ceil((8 * 1024 * 1024) / 3))}`,
    `data:image/svg+xml,${'%20'.repeat(8 * 1024 * 1024 + 1)}`,
  ])('shows fallback for malformed or oversized SVG URI (%#)', (image) => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <CommonAssetImage
          nft={
            {
              collectionType: ENFTType.ERC721,
              metadata: { image },
            } as Parameters<typeof CommonAssetImage>[0]['nft']
          }
        />,
      );
    });
    expect(renderer!.root.findAllByType('img')).toHaveLength(0);
    expect(renderer!.root.findAllByType('aside')).toHaveLength(1);
    act(() => renderer!.unmount());
  });

  it('preserves SVG URIs on platforms with an existing data URI path', () => {
    platformEnv.isNativeAndroid = false;
    const image = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <CommonAssetImage
          nft={
            {
              collectionType: ENFTType.ERC721,
              metadata: { image },
            } as Parameters<typeof CommonAssetImage>[0]['nft']
          }
        />,
      );
    });
    expect(renderer!.root.findByType('img').props.src).toBe(image);
    act(() => renderer!.unmount());
    platformEnv.isNativeAndroid = true;
  });
});

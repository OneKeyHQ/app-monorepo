import type { ReactNode } from 'react';

import { act, create } from 'react-test-renderer';

import { ENFTType } from '@onekeyhq/shared/types/nft';

import { CommonAssetImage } from './CommonAssetImage';

import type { ReactTestRenderer } from 'react-test-renderer';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
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

describe('NFT detail image', () => {
  it.each([
    'https://nft2-cdn.alchemy.com/eth-mainnet/svg-without-extension',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
  ])('uses the native image path and fallback for %s', (image) => {
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
    expect(nativeImage.props.src).toBe(image);
    expect(nativeImage.props.resizeWidth).toBe(480);
    expect(nativeImage.props.fallback).toBeTruthy();

    const imageError = nativeImage.props.onError as () => void;
    act(() => {
      imageError();
    });
    const video = renderer!.root.findByType('video');
    const videoError = video.props.onError as () => void;
    act(() => {
      videoError();
    });
    expect(renderer!.root.findAllByType('img')).toHaveLength(0);
    expect(renderer!.root.findAllByType('video')).toHaveLength(0);
    expect(renderer!.root.findAllByType('aside')).toHaveLength(1);
    act(() => renderer!.unmount());
  });
});

/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';

import { ImageV2 } from './ImageV2.native';

import type { OneKeyImageProps } from '@onekeyfe/react-native-image';

type INativeImageProps = Pick<
  OneKeyImageProps,
  'loadingStrategy' | 'optimizeTos' | 'placeholderColor' | 'source' | 'style'
>;

const mockNativeImage = jest.fn<null, [INativeImageProps]>(() => null);
const privateSource = {
  uri: 'https://uni.onekey-asset.com/private.png',
  headers: { Authorization: 'test' },
};

jest.mock('react-native', () => ({
  Image: { resolveAssetSource: jest.fn() },
  PixelRatio: { get: () => 3 },
  Platform: { OS: 'ios' },
  StyleSheet: {
    create: (styles: object) => styles,
    flatten: (styles: object[]): object =>
      styles.reduce<object>((result, style) => ({ ...result, ...style }), {}),
  },
  View: 'div',
}));

jest.mock('@onekeyfe/react-native-image', () => ({
  OneKeyImage: (props: INativeImageProps) => mockNativeImage(props),
  OneKeyImageCachePolicy: { MEMORY_DISK: 'memory-disk' },
  OneKeyImageContentFit: { COVER: 'cover' },
  OneKeyImageLoadingStrategy: {
    NONE: 'none',
    SKELETON: 'skeleton',
    STATIC: 'static',
  },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: (props: object) => [props, { width: 40, height: 40 }],
  useTheme: () => ({ bgStrong: { val: '#222222' } }),
}));

describe('native ImageV2 rendition ownership', () => {
  beforeEach(() => mockNativeImage.mockClear());

  it('keeps the original URL and layout while forwarding resize hints', () => {
    const uri = 'https://uni.onekey-asset.com/token.png';
    const { rerender } = render(<ImageV2 src={uri} resizeWidth={32} />);
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: { uri },
        style: { width: 40, height: 40 },
        resizeWidth: 32,
        optimizeTos: true,
      }),
    );
    rerender(<ImageV2 src={uri} resizeWidth={64} />);
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: { uri },
        style: { width: 40, height: 40 },
        resizeWidth: 64,
        optimizeTos: true,
      }),
    );
  });

  it('preserves custom request identity without enabling URL rewriting', () => {
    render(<ImageV2 source={privateSource} />);
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: privateSource, optimizeTos: false }),
    );
  });

  it('uses a theme backing by default and only enables skeleton explicitly', () => {
    const uri = 'https://uni.onekey-asset.com/token.png';
    const { rerender } = render(<ImageV2 src={uri} />);
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        loadingStrategy: 'static',
        placeholderColor: '#222222',
      }),
    );

    rerender(<ImageV2 src={uri} loadingStrategy="skeleton" />);
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ loadingStrategy: 'skeleton' }),
    );
  });
});

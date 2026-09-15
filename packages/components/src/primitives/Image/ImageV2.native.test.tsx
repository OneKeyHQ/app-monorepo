/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react';
import { Platform } from 'react-native';

import { ImageV2 } from './ImageV2.native';

import type { OneKeyImageProps } from '@onekeyfe/react-native-image';

type INativeImageProps = Pick<
  OneKeyImageProps,
  'loadingStrategy' | 'optimizeTos' | 'placeholderColor' | 'source' | 'style'
>;

const mockNativeImage = jest.fn<null, [INativeImageProps]>(() => null);
const fallback = <span>No image</span>;
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
  beforeEach(() => {
    mockNativeImage.mockClear();
    Platform.OS = 'ios';
  });

  it.each([undefined, '', '   '])(
    'renders the fallback without sending an empty source (%s) to iOS',
    (src) => {
      const { getByText, container } = render(
        <ImageV2 src={src} fallback={fallback} />,
      );

      expect(getByText('No image')).toBeTruthy();
      expect(container.firstElementChild?.getAttribute('style')).toBe(
        'width: 40px; height: 40px;',
      );
      expect(mockNativeImage).not.toHaveBeenCalled();
    },
  );

  it('replaces a loaded iOS image with the fallback and accepts a new source', () => {
    const { rerender, queryByText } = render(
      <ImageV2 src="https://example.com/aapl.png" />,
    );
    mockNativeImage.mockClear();

    rerender(<ImageV2 fallback={fallback} />);
    expect(queryByText('No image')).toBeTruthy();
    expect(mockNativeImage).not.toHaveBeenCalled();

    rerender(<ImageV2 src="https://example.com/aaplx.png" />);
    expect(queryByText('No image')).toBeNull();
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: { uri: 'https://example.com/aaplx.png' },
      }),
    );
  });

  it('keeps empty-source handling on the native Android image', () => {
    Platform.OS = 'android';
    render(<ImageV2 />);
    expect(mockNativeImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: undefined }),
    );
  });

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

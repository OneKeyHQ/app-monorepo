/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ImageV2 } from './ImageV2';
import { isPreloadedImageUri } from './preloadedImageUris';

import type { ImageURISource } from 'react-native';

type IWebImageProps = {
  source?: ImageURISource;
};

const mockWebImage = jest.fn<null, [IWebImageProps]>(() => null);

jest.mock('react-native', () => ({
  Image: Object.assign((props: IWebImageProps) => mockWebImage(props), {
    resolveAssetSource: jest.fn(),
  }),
  PixelRatio: { get: () => 2 },
  StyleSheet: {
    flatten: (styles: object[]): object =>
      styles.reduce<object>((result, style) => ({ ...result, ...style }), {}),
  },
}));

jest.mock('@onekeyhq/components/src/shared/tamagui', () => ({
  usePropsAndStyle: (props: object) => [props, { width: 24, height: 24 }],
  useTheme: () => ({ bgStrong: { val: '#222222' } }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true, isWebEmbed: false },
}));

jest.mock('./preloadedImageUris', () => ({
  isPreloadedImageUri: jest.fn(() => false),
}));

jest.mock('../Skeleton', () => ({ Skeleton: () => null }));

jest.mock('../Stack', () => {
  function MockStack({ children }: { children?: ReactNode }) {
    return children;
  }
  return { Stack: MockStack, YStack: 'div' };
});

const mockIsPreloadedImageUri = isPreloadedImageUri as jest.Mock;
const iconUri = 'https://example.com/token-icon.png';
const iconSource = { uri: iconUri };

describe('web ImageV2 lazy loading', () => {
  beforeEach(() => {
    mockWebImage.mockClear();
    mockIsPreloadedImageUri.mockReset();
    mockIsPreloadedImageUri.mockReturnValue(false);
  });

  // react-native-web starts LOADED only when the uri is both in its prefetch
  // cache and present at mount, so a prefetched icon must not wait for the
  // IntersectionObserver.
  it('mounts a prefetched uri with its source in the first render', () => {
    mockIsPreloadedImageUri.mockReturnValue(true);

    render(<ImageV2 source={iconSource} />);

    expect(mockIsPreloadedImageUri).toHaveBeenCalledWith(iconUri);
    expect(mockWebImage.mock.calls[0]?.[0].source).toEqual(iconSource);
  });

  it('still defers an unprefetched uri until it is about to be visible', () => {
    render(<ImageV2 source={iconSource} />);

    expect(mockWebImage.mock.calls[0]?.[0].source).toBeUndefined();
    // jsdom has no IntersectionObserver, so the effect loads it right away.
    expect(mockWebImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: iconSource }),
    );
  });
});

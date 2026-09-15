/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { ImageV2 } from './ImageV2';

import type { ImageErrorEvent, ImageURISource } from 'react-native';

type IWebImageProps = {
  source?: ImageURISource;
  onError: (event: ImageErrorEvent) => void;
};

const mockWebImage = jest.fn<null, [IWebImageProps]>(() => null);
const fallback = <span>No image</span>;
const failedUri = 'https://example.com/missing-icon.png';
// Distinct objects with the same URI, like an inline `{ uri }` on each render.
const failedSource = { uri: failedUri };
const equalFailedSource = { uri: failedUri };
const nextSource = { uri: 'https://example.com/next-icon.png' };
const failedSourceWithHeaders = {
  uri: failedUri,
  headers: { Accept: 'image/*', Authorization: 'initial' },
};
// Equivalent headers rebuilt with a different key order and name case.
const failedSourceWithReorderedHeaders = {
  uri: failedUri,
  headers: { authorization: 'initial', accept: 'image/*' },
};
const failedSourceWithNextHeaders = {
  uri: failedUri,
  headers: { Accept: 'image/*', Authorization: 'next' },
};

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
  usePropsAndStyle: (props: object) => [props, { width: 40, height: 40 }],
  useTheme: () => ({ bgStrong: { val: '#222222' } }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: false, isWebEmbed: false },
}));

jest.mock('../Skeleton', () => ({ Skeleton: () => null }));

jest.mock('../Stack', () => {
  function MockStack({ children }: { children?: ReactNode }) {
    return children;
  }
  return { Stack: MockStack, YStack: 'div' };
});

function failLastImageLoad() {
  const props = mockWebImage.mock.calls.at(-1)?.[0];
  expect(props).toBeDefined();
  act(() => {
    props?.onError({
      nativeEvent: { error: 'Failed to load' },
    } as ImageErrorEvent);
  });
}

describe('web ImageV2 error fallback', () => {
  beforeEach(() => {
    mockWebImage.mockClear();
  });

  it('keeps the fallback when a re-render passes an equal source object', () => {
    const { rerender, queryByText } = render(
      <ImageV2 source={failedSource} fallback={fallback} canRetry={false} />,
    );
    failLastImageLoad();
    expect(queryByText('No image')).not.toBeNull();

    mockWebImage.mockClear();
    rerender(
      <ImageV2
        source={equalFailedSource}
        fallback={fallback}
        canRetry={false}
      />,
    );

    expect(queryByText('No image')).not.toBeNull();
    expect(mockWebImage).not.toHaveBeenCalled();
  });

  it('loads again when the failed source uri changes', () => {
    const { rerender, queryByText } = render(
      <ImageV2 source={failedSource} fallback={fallback} canRetry={false} />,
    );
    failLastImageLoad();
    expect(queryByText('No image')).not.toBeNull();

    rerender(
      <ImageV2 source={nextSource} fallback={fallback} canRetry={false} />,
    );

    expect(queryByText('No image')).toBeNull();
    expect(mockWebImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: nextSource }),
    );
  });

  it.each<[string, ImageURISource]>([
    ['are reordered', failedSourceWithReorderedHeaders],
    ['change', failedSourceWithNextHeaders],
  ])(
    'keeps the fallback when only headers %s, which web image loading ignores',
    (_, nextHeadersSource) => {
      const { rerender, queryByText } = render(
        <ImageV2
          source={failedSourceWithHeaders}
          fallback={fallback}
          canRetry={false}
        />,
      );
      failLastImageLoad();
      expect(queryByText('No image')).not.toBeNull();

      mockWebImage.mockClear();
      rerender(
        <ImageV2
          source={nextHeadersSource}
          fallback={fallback}
          canRetry={false}
        />,
      );

      expect(queryByText('No image')).not.toBeNull();
      expect(mockWebImage).not.toHaveBeenCalled();
    },
  );
});

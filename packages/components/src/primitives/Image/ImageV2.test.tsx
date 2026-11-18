/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react';

import { ImageV2 } from './ImageV2';
import { ImageWithFallbackSources } from './ImageWithFallbackSources';

import type { ImageErrorEvent, ImageURISource } from 'react-native';

type IWebImageProps = {
  source?: ImageURISource;
  onError: (event: ImageErrorEvent) => void;
};

const mockWebImage = jest.fn<null, [IWebImageProps]>(() => null);
const mockWebImageMount = jest.fn();
const spiedFallbackRender = jest.fn();
const fallback = <span>No image</span>;

function SpiedFallback() {
  spiedFallbackRender();
  return <span>No image</span>;
}

const chainedPrimaryUri = 'https://example.com/chained-primary.png';
const chainedFallbackUri = 'https://example.com/chained-fallback.png';
const chainedSources = [chainedPrimaryUri, chainedFallbackUri];
const otherChainedPrimaryUri = 'https://example.com/other-primary.png';
const otherChainedSources = [
  otherChainedPrimaryUri,
  'https://example.com/other-fallback.png',
];
const spiedFallback = <SpiedFallback />;
const initialUri = 'https://example.com/initial-icon.png';
const initialSource = { uri: initialUri };
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

jest.mock('react-native', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    Image: Object.assign(
      (props: IWebImageProps) => {
        useEffect(() => {
          mockWebImageMount();
        }, []);
        return mockWebImage(props);
      },
      {
        resolveAssetSource: jest.fn(),
      },
    ),
    PixelRatio: { get: () => 2 },
    StyleSheet: {
      flatten: (styles: object[]): object =>
        styles.reduce<object>((result, style) => ({ ...result, ...style }), {}),
    },
  };
});

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

describe('web ImageV2 source swap', () => {
  beforeEach(() => {
    mockWebImage.mockClear();
    mockWebImageMount.mockClear();
  });

  // react-native-web paints nothing until its own load state leaves IDLE, so a
  // remount here costs a blank frame even for an already cached image.
  it('updates the underlying image in place when the uri changes', () => {
    const { rerender } = render(<ImageV2 source={initialSource} />);
    expect(mockWebImageMount).toHaveBeenCalledTimes(1);

    rerender(<ImageV2 source={nextSource} />);

    expect(mockWebImageMount).toHaveBeenCalledTimes(1);
    expect(mockWebImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: nextSource }),
    );
  });

  // List recycling still owns the remount, so a reused row cannot inherit the
  // previous row's loaded image.
  it('remounts the underlying image when only the recycling key changes', () => {
    const { rerender } = render(
      <ImageV2 source={initialSource} recyclingKey="row-1" />,
    );
    expect(mockWebImageMount).toHaveBeenCalledTimes(1);

    rerender(<ImageV2 source={initialSource} recyclingKey="row-2" />);

    expect(mockWebImageMount).toHaveBeenCalledTimes(2);
  });
});

describe('web ImageV2 fallback source chain', () => {
  beforeEach(() => {
    mockWebImage.mockClear();
    spiedFallbackRender.mockClear();
  });

  // A failing image hands the error to ImageWithFallbackSources synchronously,
  // so the next source and the error state land in the same commit. Counting
  // fallback renders is the only way to see the frame a browser would paint:
  // a render-phase reset skips the children of the discarded pass entirely.
  it('never renders the error fallback while advancing to the next source', () => {
    render(
      <ImageWithFallbackSources
        sources={chainedSources}
        fallback={spiedFallback}
        canRetry={false}
      />,
    );
    expect(spiedFallbackRender).not.toHaveBeenCalled();

    failLastImageLoad();

    expect(mockWebImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: { uri: chainedFallbackUri } }),
    );
    expect(spiedFallbackRender).not.toHaveBeenCalled();
  });

  // react-native-web aborts a superseded request from a passive effect and can
  // never abort a completed load's decode(), so the previous source's callbacks
  // outlive the swap on an instance that no longer remounts.
  it('ignores a failure reported by the source it already swapped away from', () => {
    const { rerender, queryByText } = render(
      <ImageV2
        source={initialSource}
        fallback={spiedFallback}
        canRetry={false}
      />,
    );
    const staleOnError = mockWebImage.mock.calls.at(-1)?.[0].onError;

    rerender(
      <ImageV2 source={nextSource} fallback={spiedFallback} canRetry={false} />,
    );
    act(() => {
      staleOnError?.({
        nativeEvent: { error: 'Failed to load' },
      } as ImageErrorEvent);
    });

    expect(queryByText('No image')).toBeNull();
    expect(mockWebImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: nextSource }),
    );
  });

  it('keeps the new primary source when the previous token reports a failure', () => {
    const { rerender } = render(
      <ImageWithFallbackSources
        sources={chainedSources}
        fallback={spiedFallback}
        canRetry={false}
      />,
    );
    const staleOnError = mockWebImage.mock.calls.at(-1)?.[0].onError;

    rerender(
      <ImageWithFallbackSources
        sources={otherChainedSources}
        fallback={spiedFallback}
        canRetry={false}
      />,
    );
    act(() => {
      staleOnError?.({
        nativeEvent: { error: 'Failed to load' },
      } as ImageErrorEvent);
    });

    expect(mockWebImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: { uri: otherChainedPrimaryUri } }),
    );
  });

  it('renders the error fallback once every source failed', () => {
    render(
      <ImageWithFallbackSources
        sources={chainedSources}
        fallback={spiedFallback}
        canRetry={false}
      />,
    );

    failLastImageLoad();
    failLastImageLoad();

    expect(spiedFallbackRender).toHaveBeenCalled();
  });
});

describe('web ImageV2 error fallback', () => {
  beforeEach(() => {
    mockWebImage.mockClear();
    mockWebImageMount.mockClear();
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

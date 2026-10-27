/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';

import { ImageWithFallbackSources } from './ImageWithFallbackSources';

type IMockImageV2Props = {
  src?: string;
  onError?: (event: { error: string }) => void;
};

const mockImageV2 = jest.fn<null, [IMockImageV2Props]>(() => null);
const mockImageV2Mount = jest.fn();
const spiedFallbackRender = jest.fn();

jest.mock('./ImageV2', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    ImageV2: (props: IMockImageV2Props) => {
      useEffect(() => {
        mockImageV2Mount();
      }, []);
      return mockImageV2(props);
    },
  };
});

function SpiedFallback() {
  spiedFallbackRender();
  return <span>No image</span>;
}

const fallback = <SpiedFallback />;
const primaryUri = 'https://example.com/primary.png';
const secondaryUri = 'https://example.com/secondary.png';
const nextPrimaryUri = 'https://example.com/next-primary.png';
const primaryOnlySources = [primaryUri];
const nextPrimaryOnlySources = [nextPrimaryUri];
const primaryThenSecondarySources = [primaryUri, secondaryUri];

function failLastLoad() {
  const props = mockImageV2.mock.calls.at(-1)?.[0];
  expect(props).toBeDefined();
  act(() => {
    props?.onError?.({ error: 'Failed to load' });
  });
}

describe('ImageWithFallbackSources', () => {
  beforeEach(() => {
    mockImageV2.mockClear();
    mockImageV2Mount.mockClear();
    spiedFallbackRender.mockClear();
  });

  // Remounting on every url change drops the loaded image state below it, which
  // shows up as a blank icon frame when the rendered token changes.
  it('swaps the source in place when sources change', () => {
    const { rerender } = render(
      <ImageWithFallbackSources
        sources={primaryOnlySources}
        fallback={fallback}
      />,
    );
    expect(mockImageV2Mount).toHaveBeenCalledTimes(1);
    expect(mockImageV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: primaryUri }),
    );

    rerender(
      <ImageWithFallbackSources
        sources={nextPrimaryOnlySources}
        fallback={fallback}
      />,
    );

    expect(mockImageV2Mount).toHaveBeenCalledTimes(1);
    expect(mockImageV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: nextPrimaryUri }),
    );
  });

  it('restarts at the primary source without flashing the fallback', () => {
    const { rerender, queryByText } = render(
      <ImageWithFallbackSources
        sources={primaryThenSecondarySources}
        fallback={fallback}
      />,
    );
    failLastLoad();
    expect(mockImageV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: secondaryUri }),
    );

    mockImageV2.mockClear();
    // Counting renders, not querying the DOM: `rerender` runs inside act, which
    // flushes an effect-based reset before any query can observe the frame it
    // would have painted.
    spiedFallbackRender.mockClear();
    rerender(
      <ImageWithFallbackSources
        sources={nextPrimaryOnlySources}
        fallback={fallback}
      />,
    );

    expect(spiedFallbackRender).not.toHaveBeenCalled();
    expect(queryByText('No image')).toBeNull();
    expect(mockImageV2).toHaveBeenLastCalledWith(
      expect.objectContaining({ src: nextPrimaryUri }),
    );
  });

  it('reports the error to the caller once the last source failed', () => {
    const onError = jest.fn();
    render(
      <ImageWithFallbackSources
        sources={primaryThenSecondarySources}
        fallback={fallback}
        onError={onError}
      />,
    );

    failLastLoad();
    expect(onError).not.toHaveBeenCalled();

    failLastLoad();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

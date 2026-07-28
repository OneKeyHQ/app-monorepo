import { useRef } from 'react';

import { render } from '@testing-library/react-native';

import { usePublishSwapStockQuoteReadiness } from './usePublishSwapStockQuoteReadiness';

function ReadinessPublisher({
  readinessEpoch = 0,
  readyForQuote,
  resetQuote,
  setReadyForQuote,
}: {
  readinessEpoch?: number;
  readyForQuote: boolean;
  resetQuote: () => void;
  setReadyForQuote: (ready: boolean) => void;
}) {
  const readyForQuoteRef = useRef(false);
  usePublishSwapStockQuoteReadiness({
    readinessEpoch,
    readyForQuote,
    readyForQuoteRef,
    resetQuote,
    setReadyForQuote,
  });
  return null;
}

describe('usePublishSwapStockQuoteReadiness', () => {
  it('keeps readiness true when a responsive container replaces its provider', () => {
    let publishedReadiness = false;
    const publicationOrder: boolean[] = [];
    const setReadyForQuote = (ready: boolean) => {
      publishedReadiness = ready;
      publicationOrder.push(ready);
    };
    const resetQuote = jest.fn();

    const { rerender } = render(
      <ReadinessPublisher
        key="mobile"
        readyForQuote
        resetQuote={resetQuote}
        setReadyForQuote={setReadyForQuote}
      />,
    );

    rerender(
      <ReadinessPublisher
        key="desktop"
        readyForQuote
        resetQuote={resetQuote}
        setReadyForQuote={setReadyForQuote}
      />,
    );

    expect(publicationOrder).toEqual([true, false, true]);
    expect(publishedReadiness).toBe(true);
    expect(resetQuote).not.toHaveBeenCalled();
  });

  it('clears readiness when the active provider unmounts', () => {
    let publishedReadiness = false;
    const setReadyForQuote = (ready: boolean) => {
      publishedReadiness = ready;
    };
    const resetQuote = jest.fn();

    const { unmount } = render(
      <ReadinessPublisher
        readyForQuote
        resetQuote={resetQuote}
        setReadyForQuote={setReadyForQuote}
      />,
    );
    expect(publishedReadiness).toBe(true);

    unmount();

    expect(publishedReadiness).toBe(false);
  });
});

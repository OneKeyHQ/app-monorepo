/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  STOCK_HEADER_IMAGE_REVEAL_TIMEOUT_MS,
  useStockHeaderImageReveal,
} from './useStockHeaderImageReveal';

const baseProps = {
  enabled: true,
  networkId: 'evm--56',
  networkImageUri: 'https://example.com/bsc.png',
  tokenIdentityKey: 'evm--56:0xaapl:token',
  tokenImageUris: ['https://example.com/aapl.png'],
};

describe('useStockHeaderImageReveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reveals the first content frame only after token and network images display', () => {
    const { result } = renderHook(() => useStockHeaderImageReveal(baseProps));

    expect(result.current.reveal).toBe(false);
    act(() => result.current.onTokenImageDisplay());
    expect(result.current.reveal).toBe(false);
    act(() => result.current.onNetworkImageDisplay());
    expect(result.current.reveal).toBe(true);
    act(() => {
      jest.advanceTimersByTime(STOCK_HEADER_IMAGE_REVEAL_TIMEOUT_MS);
    });
    expect(result.current.degraded).toBe(false);
  });

  it('only waits for the token image when no network badge is required', () => {
    const { result } = renderHook(() =>
      useStockHeaderImageReveal({
        ...baseProps,
        networkId: undefined,
        networkImageUri: undefined,
      }),
    );

    expect(result.current.reveal).toBe(false);
    act(() => result.current.onTokenImageDisplay());
    expect(result.current.reveal).toBe(true);
  });

  it('only waits for the network image when the token has no image URI', () => {
    const { result } = renderHook(() =>
      useStockHeaderImageReveal({
        ...baseProps,
        tokenImageUris: [],
      }),
    );

    expect(result.current.reveal).toBe(false);
    act(() => result.current.onNetworkImageDisplay());
    expect(result.current.reveal).toBe(true);
  });

  it('does not reuse ready state when an image URI changes', () => {
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useStockHeaderImageReveal(props),
      { initialProps: baseProps },
    );
    act(() => {
      result.current.onTokenImageDisplay();
      result.current.onNetworkImageDisplay();
    });
    expect(result.current.reveal).toBe(true);

    const staleNetworkCallback = result.current.onNetworkImageDisplay;
    rerender({
      ...baseProps,
      networkImageUri: 'https://example.com/ethereum.png',
      networkId: 'evm--1',
    });

    expect(result.current.reveal).toBe(false);
    act(() => staleNetworkCallback());
    expect(result.current.reveal).toBe(false);
  });

  it('fails open after the bounded timeout', () => {
    const { result } = renderHook(() => useStockHeaderImageReveal(baseProps));

    expect(result.current.reveal).toBe(false);
    act(() => {
      jest.advanceTimersByTime(STOCK_HEADER_IMAGE_REVEAL_TIMEOUT_MS);
    });
    expect(result.current.reveal).toBe(true);
    expect(result.current.degraded).toBe(true);

    act(() => {
      result.current.onTokenImageDisplay();
      result.current.onNetworkImageDisplay();
    });
    expect(result.current.degraded).toBe(true);
    expect(result.current.reveal).toBe(true);
  });

  it('ignores a degraded image tree late display callbacks after the identity changes', () => {
    const { result, rerender } = renderHook(
      (props: typeof baseProps) => useStockHeaderImageReveal(props),
      { initialProps: baseProps },
    );
    act(() => {
      jest.advanceTimersByTime(STOCK_HEADER_IMAGE_REVEAL_TIMEOUT_MS);
    });
    expect(result.current.degraded).toBe(true);

    const staleTokenCallback = result.current.onTokenImageDisplay;
    const staleNetworkCallback = result.current.onNetworkImageDisplay;
    rerender({
      ...baseProps,
      networkImageUri: 'https://example.com/ethereum.png',
      networkId: 'evm--1',
      tokenIdentityKey: 'evm--1:0xtsla:token',
      tokenImageUris: ['https://example.com/tsla.png'],
    });

    expect(result.current.degraded).toBe(false);
    expect(result.current.reveal).toBe(false);
    act(() => {
      staleTokenCallback();
      staleNetworkCallback();
    });
    expect(result.current.reveal).toBe(false);

    act(() => {
      result.current.onTokenImageDisplay();
      result.current.onNetworkImageDisplay();
    });
    expect(result.current.degraded).toBe(false);
    expect(result.current.reveal).toBe(true);
  });
});

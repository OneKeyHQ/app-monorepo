/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useNFTMediaFallback } from './useNFTMediaFallback';

describe('useNFTMediaFallback', () => {
  it('probes image, then video, then gives up', () => {
    const { result } = renderHook(() =>
      useNFTMediaFallback('https://cdn.example.com/asset'),
    );
    expect(result.current.kind).toBe('image');

    act(() => result.current.onError());
    expect(result.current.kind).toBe('video');

    act(() => result.current.onError());
    expect(result.current.kind).toBe('failed');
  });

  it('probes video first for an explicit video uri', () => {
    const { result } = renderHook(() =>
      useNFTMediaFallback('https://cdn.example.com/asset.mp4'),
    );
    expect(result.current.kind).toBe('video');

    act(() => result.current.onError());
    expect(result.current.kind).toBe('image');
  });

  it('has nothing to render without a uri', () => {
    const { result } = renderHook(() => useNFTMediaFallback(undefined));
    expect(result.current.kind).toBe('failed');
  });

  it('restarts the probe when the uri changes', () => {
    const { result, rerender } = renderHook(
      ({ uri }: { uri: string }) => useNFTMediaFallback(uri),
      { initialProps: { uri: 'https://cdn.example.com/a.png' } },
    );
    act(() => result.current.onError());
    act(() => result.current.onError());
    expect(result.current.kind).toBe('failed');

    rerender({ uri: 'https://cdn.example.com/b.png' });
    expect(result.current.kind).toBe('image');
  });

  it('ignores a stale onError from a previous uri', () => {
    const { result, rerender } = renderHook(
      ({ uri }: { uri: string }) => useNFTMediaFallback(uri),
      { initialProps: { uri: 'https://cdn.example.com/a.png' } },
    );
    const staleOnError = result.current.onError;

    rerender({ uri: 'https://cdn.example.com/b.png' });
    act(() => staleOnError());
    expect(result.current.kind).toBe('image');
  });
});

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

  it('restarts the probe when a previously failed uri comes back', () => {
    const { result, rerender } = renderHook(
      ({ uri }: { uri: string }) => useNFTMediaFallback(uri),
      { initialProps: { uri: 'https://cdn.example.com/a.png' } },
    );
    act(() => result.current.onError());
    act(() => result.current.onError());
    expect(result.current.kind).toBe('failed');

    rerender({ uri: 'https://cdn.example.com/b.png' });
    expect(result.current.kind).toBe('image');

    rerender({ uri: 'https://cdn.example.com/a.png' });
    expect(result.current.kind).toBe('image');

    act(() => result.current.onError());
    expect(result.current.kind).toBe('video');
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

    // The stale error must not leave the previous uri's progress behind
    // either, or a later error for the current uri would be counted against the wrong uri.
    act(() => result.current.onError());
    expect(result.current.kind).toBe('video');

    rerender({ uri: 'https://cdn.example.com/a.png' });
    expect(result.current.kind).toBe('image');
  });

  it('ignores a stale onError from an earlier generation of the same uri', () => {
    const { result, rerender } = renderHook(
      ({ uri }: { uri: string }) => useNFTMediaFallback(uri),
      { initialProps: { uri: 'https://cdn.example.com/a.png' } },
    );
    const staleOnError = result.current.onError;

    rerender({ uri: 'https://cdn.example.com/b.png' });
    rerender({ uri: 'https://cdn.example.com/a.png' });
    expect(result.current.kind).toBe('image');

    // The media element from the first A generation may still report its
    // error after A came back; it must not skip the fresh A candidate.
    act(() => staleOnError());
    expect(result.current.kind).toBe('image');

    act(() => result.current.onError());
    expect(result.current.kind).toBe('video');
  });
});

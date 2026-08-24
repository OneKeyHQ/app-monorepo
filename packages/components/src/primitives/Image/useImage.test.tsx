/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import type { ImageRef } from 'expo-image';

const mockLoadAsync = jest.fn();
const mockCacheAndRetainImageRef = jest.fn();
const mockGetCachedImagePath = jest.fn();
const mockGetCachedImageRefInfo = jest.fn();
const mockHasExactCachedImageRef = jest.fn();
const mockRefreshCachedImagePath = jest.fn();
const mockRefreshCachedImageRef = jest.fn();
const mockReleaseCachedImageRef = jest.fn();
const mockRetainCachedImageRef = jest.fn();
const mockPlatformEnv = {
  isNativeAndroid: false,
};

jest.mock('expo-image', () => ({
  Image: {
    loadAsync: (...args: unknown[]) =>
      mockLoadAsync(...args) as Promise<ImageRef>,
  },
  resolveSource: (source: string | { uri?: string } | undefined) =>
    typeof source === 'string' ? { uri: source } : source,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

jest.mock('./cache', () => ({
  cacheAndRetainImageRef: (...args: unknown[]) =>
    mockCacheAndRetainImageRef(...args) as ImageRef | undefined,
  deleteCachedImagePath: jest.fn(),
  getCachedImagePath: (...args: unknown[]) =>
    mockGetCachedImagePath(...args) as string | undefined,
  getCachedImageRefInfo: (...args: unknown[]) =>
    mockGetCachedImageRefInfo(...args) as
      | { imageRef: ImageRef; sourceUri: string }
      | undefined,
  hasExactCachedImageRef: (...args: unknown[]) =>
    mockHasExactCachedImageRef(...args) as boolean,
  refreshCachedImagePath: (...args: unknown[]) =>
    mockRefreshCachedImagePath(...args) as Promise<string | undefined>,
  refreshCachedImageRef: (...args: unknown[]) =>
    mockRefreshCachedImageRef(...args) as Promise<ImageRef | undefined>,
  releaseCachedImageRef: (...args: unknown[]) => {
    mockReleaseCachedImageRef(...args);
  },
  retainCachedImageRef: (...args: unknown[]) =>
    mockRetainCachedImageRef(...args) as ImageRef | undefined,
}));

const { useImage }: typeof import('./useImage') = require('./useImage');

function createImageRef() {
  const release = jest.fn();
  return {
    imageRef: {
      release,
    } as unknown as ImageRef,
    release,
  };
}

describe('useImage decoded ImageRef ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformEnv.isNativeAndroid = false;
    mockGetCachedImagePath.mockReturnValue(undefined);
    mockGetCachedImageRefInfo.mockReturnValue(undefined);
    mockHasExactCachedImageRef.mockReturnValue(false);
    mockRetainCachedImageRef.mockImplementation(
      (_cacheKey: string, _sourceUri: string, imageRef: ImageRef) => imageRef,
    );
  });

  it('moves a loaded ImageRef into the cache and releases only its cache retain', async () => {
    const uri = 'https://example.com/token.png';
    const { imageRef, release } = createImageRef();
    mockLoadAsync.mockResolvedValue(imageRef);
    mockCacheAndRetainImageRef.mockReturnValue(imageRef);

    const { result, unmount } = renderHook(() => useImage(uri));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.image).toBe(imageRef);
    expect(mockCacheAndRetainImageRef).toHaveBeenCalledWith(uri, imageRef, uri);

    unmount();

    expect(mockReleaseCachedImageRef).toHaveBeenCalledWith(uri, uri, imageRef);
    expect(release).not.toHaveBeenCalled();
  });

  it('returns a cached ImageRef without starting another image load', () => {
    const uri = 'https://example.com/warm-token.png';
    const { imageRef: cachedImageRef } = createImageRef();
    mockGetCachedImageRefInfo.mockReturnValue({
      imageRef: cachedImageRef,
      sourceUri: uri,
    });
    mockHasExactCachedImageRef.mockReturnValue(true);

    const { result, unmount } = renderHook(() => useImage(uri));

    expect(result.current.image).toBe(cachedImageRef);
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(mockRetainCachedImageRef).toHaveBeenCalledWith(
      uri,
      uri,
      cachedImageRef,
    );

    unmount();
    expect(mockReleaseCachedImageRef).toHaveBeenCalledWith(
      uri,
      uri,
      cachedImageRef,
    );
  });

  it('shows a logical cache hit while loading the requested variant', async () => {
    const cacheKey = 'https://example.com/shared-token.png';
    const listUri = `${cacheKey}?resize=w_160`;
    const homeUri = `${cacheKey}?resize=w_96`;
    const homeSource = { uri: homeUri };
    const { imageRef: listImageRef } = createImageRef();
    const { imageRef: homeImageRef } = createImageRef();
    let resolveLoad: ((imageRef: ImageRef) => void) | undefined;
    mockGetCachedImageRefInfo.mockReturnValue({
      imageRef: listImageRef,
      sourceUri: listUri,
    });
    mockLoadAsync.mockReturnValue(
      new Promise<ImageRef>((resolve) => {
        resolveLoad = resolve;
      }),
    );
    mockCacheAndRetainImageRef.mockReturnValue(homeImageRef);

    const { result, unmount } = renderHook(() =>
      useImage(homeSource, {}, [], cacheKey),
    );

    expect(result.current.image).toBe(listImageRef);
    expect(mockLoadAsync).toHaveBeenCalledWith(
      { uri: homeUri },
      expect.any(Object),
    );

    await act(async () => {
      resolveLoad?.(homeImageRef);
      await Promise.resolve();
    });

    expect(result.current.image).toBe(homeImageRef);
    expect(mockCacheAndRetainImageRef).toHaveBeenCalledWith(
      cacheKey,
      homeImageRef,
      homeUri,
    );

    unmount();
  });

  it('does not show a loaded ImageRef after the source identity changes', async () => {
    const firstUri = 'https://example.com/token-a.png';
    const secondUri = 'https://example.com/token-b.png';
    const { imageRef: firstImageRef } = createImageRef();
    let resolveSecondLoad: ((imageRef: ImageRef) => void) | undefined;
    mockLoadAsync.mockResolvedValueOnce(firstImageRef).mockReturnValueOnce(
      new Promise<ImageRef>((resolve) => {
        resolveSecondLoad = resolve;
      }),
    );
    mockCacheAndRetainImageRef.mockImplementation(
      (_cacheKey: string, imageRef: ImageRef) => imageRef,
    );

    const { result, rerender, unmount } = renderHook(
      ({ uri }: { uri: string }) => useImage(uri),
      { initialProps: { uri: firstUri } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.image).toBe(firstImageRef);

    rerender({ uri: secondUri });
    expect(result.current.image).toBeNull();

    const { imageRef: secondImageRef } = createImageRef();
    await act(async () => {
      resolveSecondLoad?.(secondImageRef);
      await Promise.resolve();
    });
    expect(result.current.image).toBe(secondImageRef);

    unmount();
  });

  it('does not use a logical decoded cache entry without a source URL', () => {
    const { result, unmount } = renderHook(() =>
      useImage(undefined, {}, [], 'token:eth:0x1'),
    );

    expect(result.current.image).toBeNull();
    expect(mockGetCachedImageRefInfo).not.toHaveBeenCalled();
    expect(mockLoadAsync).not.toHaveBeenCalled();

    unmount();
  });

  it('uses the URL source directly on Android without sharing an ImageRef', () => {
    const uri = 'https://example.com/android-token.png';
    mockPlatformEnv.isNativeAndroid = true;

    const { result, unmount } = renderHook(() => useImage(uri));

    expect(result.current.image).toEqual({ uri });
    act(() => {
      result.current.reFetchImage();
    });
    expect(mockGetCachedImageRefInfo).not.toHaveBeenCalled();
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(mockCacheAndRetainImageRef).not.toHaveBeenCalled();

    unmount();
  });
});

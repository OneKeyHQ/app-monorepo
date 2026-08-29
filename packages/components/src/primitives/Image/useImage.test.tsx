/**
 * @jest-environment jsdom
 */

/* cspell:ignore blurhash thumbhash */

import { act, renderHook } from '@testing-library/react';

import { useImage } from './useImage';

import type { ImageRef, ImageSource } from 'expo-image';

type IResolvedImageSource = ImageSource & {
  scale?: number;
};

type ILoadAsync = typeof import('expo-image').Image.loadAsync;

jest.mock('expo-image', () => ({
  Image: {
    loadAsync: jest.fn<ReturnType<ILoadAsync>, Parameters<ILoadAsync>>(),
  },
  resolveSource: jest.fn(
    (source: ImageSource | string | number | undefined) => {
      if (typeof source === 'string') {
        return { uri: source };
      }
      if (typeof source === 'number' || !source) {
        return null;
      }
      return source;
    },
  ),
}));

const expoImageModule: typeof import('expo-image') = require('expo-image');
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockLoadAsync = jest.mocked(expoImageModule.Image.loadAsync);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: jest.fn(),
}));

const miscUtilsModule: typeof import('@onekeyhq/shared/src/utils/miscUtils') = require('@onekeyhq/shared/src/utils/miscUtils');

const mockGenerateUUID = jest.mocked(miscUtilsModule.generateUUID);

jest.mock('./cache', () => ({
  deleteCachedImagePath: jest.fn(),
  getCachedImagePath: jest.fn(),
  getCachedImageRef: jest.fn(),
  refreshCachedImagePath: jest.fn().mockResolvedValue(undefined),
  releaseCachedImageRef: jest.fn(),
  retainCachedImageRef: jest.fn(),
}));

const cacheModule: typeof import('./cache') = require('./cache');

const mockDeleteCachedImagePath = jest.mocked(
  cacheModule.deleteCachedImagePath,
);
const mockGetCachedImagePath = jest.mocked(cacheModule.getCachedImagePath);
const mockGetCachedImageRef = jest.mocked(cacheModule.getCachedImageRef);
const mockRefreshCachedImagePath = jest.mocked(
  cacheModule.refreshCachedImagePath,
);
const mockReleaseCachedImageRef = jest.mocked(
  cacheModule.releaseCachedImageRef,
);
const mockRetainCachedImageRef = jest.mocked(cacheModule.retainCachedImageRef);

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createImageRef() {
  const release = jest.fn();
  return {
    imageRef: {
      height: 96,
      release,
      scale: 1,
      width: 96,
    } as unknown as ImageRef,
    release,
  };
}

async function resolveImage(deferred: IDeferred<ImageRef>, imageRef: ImageRef) {
  await act(async () => {
    deferred.resolve(imageRef);
    await deferred.promise;
    await Promise.resolve();
  });
}

describe('useImage', () => {
  beforeEach(() => {
    let generatedCacheKeyId = 0;
    jest.clearAllMocks();
    mockGenerateUUID.mockImplementation(
      () => `generated-cache-key-${(generatedCacheKeyId += 1)}`,
    );
    mockDeleteCachedImagePath.mockReset();
    mockGetCachedImagePath.mockReset();
    mockGetCachedImageRef.mockReset();
    mockRefreshCachedImagePath.mockReset();
    mockRefreshCachedImagePath.mockResolvedValue(undefined);
    mockReleaseCachedImageRef.mockReset();
    mockRetainCachedImageRef.mockReset();
  });

  it('loads equivalent sources once without exposing a remote URI', async () => {
    const firstLoad = createDeferred<ImageRef>();
    const secondLoad = createDeferred<ImageRef>();
    mockLoadAsync
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const firstImage = createImageRef();
    const secondImage = createImageRef();
    const { result, rerender, unmount } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      {
        initialProps: { source: { uri: 'https://example.com/a.png' } },
        reactStrictMode: true,
      },
    );

    rerender({ source: { uri: 'https://example.com/a.png' } });
    rerender({ source: { uri: 'https://example.com/a.png' } });
    rerender({ source: { uri: 'https://example.com/a.png' } });

    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();
    await resolveImage(firstLoad, firstImage.imageRef);
    expect(result.current.image).toBe(firstImage.imageRef);

    rerender({ source: { uri: 'https://example.com/b.png' } });
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);
    expect(result.current.image).toBeNull();
    expect(firstImage.release).not.toHaveBeenCalled();
    await resolveImage(secondLoad, secondImage.imageRef);

    expect(result.current.image).toBe(secondImage.imageRef);
    expect(firstImage.release).toHaveBeenCalledTimes(1);
    expect(secondImage.release).not.toHaveBeenCalled();

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(secondImage.release).toHaveBeenCalledTimes(1);
  });

  it('compares source fields without depending on object or header order', () => {
    mockLoadAsync.mockImplementation(
      () => new Promise<ImageRef>(() => undefined),
    );
    const baseSource: ImageSource = {
      headers: {
        Accept: 'image/webp',
        Authorization: 'Bearer token',
      },
      uri: 'https://example.com/a.png',
    };
    const { rerender } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      { initialProps: { source: baseSource } },
    );

    rerender({
      source: {
        headers: {
          Authorization: 'Bearer token',
          Accept: 'image/webp',
        },
        uri: baseSource.uri,
      },
    });
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);

    const distinctSources: ImageSource[] = [
      { ...baseSource, uri: 'https://example.com/b.png' },
      { ...baseSource, width: 32 },
      { ...baseSource, height: 32 },
      { ...baseSource, scale: 2 } as IResolvedImageSource,
      { ...baseSource, blurhash: 'blurhash' },
      { ...baseSource, thumbhash: 'thumbhash' },
      { ...baseSource, cacheKey: 'cache-key' },
      { ...baseSource, webMaxViewportWidth: 320 },
      { ...baseSource, isAnimated: true },
      {
        ...baseSource,
        headers: {
          ...baseSource.headers,
          Authorization: 'Bearer updated-token',
        },
      },
    ];

    distinctSources.forEach((source, index) => {
      rerender({ source });
      expect(mockLoadAsync).toHaveBeenCalledTimes(index + 2);
    });
  });

  it('bypasses URI-only caches for request-specific sources', () => {
    const cachedImage = createImageRef();
    const initialSource: ImageSource = {
      uri: 'https://example.com/a.png',
    };
    mockGetCachedImageRef.mockReturnValue(cachedImage.imageRef);
    mockLoadAsync.mockImplementation(
      () => new Promise<ImageRef>(() => undefined),
    );
    const { result, rerender } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      {
        initialProps: { source: initialSource },
      },
    );

    expect(result.current.image).toBe(cachedImage.imageRef);
    expect(mockLoadAsync).not.toHaveBeenCalled();

    rerender({
      source: {
        headers: { Authorization: 'Bearer token' },
        uri: 'https://example.com/a.png',
      },
    });
    expect(result.current.image).toBeNull();
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(mockLoadAsync).toHaveBeenLastCalledWith(
      {
        headers: { Authorization: 'Bearer token' },
        cacheKey: 'onekey-private-image-generated-cache-key-1',
        uri: 'https://example.com/a.png',
      },
      {},
    );

    rerender({
      source: {
        cacheKey: 'account-specific-avatar',
        uri: 'https://example.com/a.png',
      },
    });
    expect(result.current.image).toBeNull();
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);
    expect(mockLoadAsync).toHaveBeenLastCalledWith(
      {
        cacheKey: 'account-specific-avatar',
        uri: 'https://example.com/a.png',
      },
      {},
    );
  });

  it('isolates native caches for authenticated source generations', async () => {
    const firstLoad = createDeferred<ImageRef>();
    const secondLoad = createDeferred<ImageRef>();
    const customCacheKeyLoad = createDeferred<ImageRef>();
    mockLoadAsync
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise)
      .mockReturnValueOnce(customCacheKeyLoad.promise);
    const initialSource: ImageSource = {
      headers: { Authorization: 'Bearer first-token' },
      uri: 'https://example.com/avatar.png',
    };

    const { rerender } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      {
        initialProps: {
          source: initialSource,
        },
      },
    );

    const firstRequestSource = mockLoadAsync.mock.calls[0][0] as ImageSource;
    expect(firstRequestSource.cacheKey).toBe(
      'onekey-private-image-generated-cache-key-1',
    );
    expect(firstRequestSource.cacheKey).not.toContain('first-token');

    rerender({
      source: {
        headers: { Authorization: 'Bearer first-token' },
        uri: 'https://example.com/avatar.png',
      },
    });
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);

    rerender({
      source: {
        headers: { Authorization: 'Bearer second-token' },
        uri: 'https://example.com/avatar.png',
      },
    });
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);
    expect((mockLoadAsync.mock.calls[1][0] as ImageSource).cacheKey).toBe(
      'onekey-private-image-generated-cache-key-2',
    );

    const firstImage = createImageRef();
    await resolveImage(firstLoad, firstImage.imageRef);
    expect(mockRefreshCachedImagePath).not.toHaveBeenCalled();

    const secondImage = createImageRef();
    await resolveImage(secondLoad, secondImage.imageRef);
    expect(mockRefreshCachedImagePath).not.toHaveBeenCalled();

    rerender({
      source: {
        cacheKey: 'account-specific-avatar',
        uri: 'https://example.com/avatar.png',
      } as ImageSource,
    });
    const customCacheKeyImage = createImageRef();
    await resolveImage(customCacheKeyLoad, customCacheKeyImage.imageRef);
    expect(mockRefreshCachedImagePath).not.toHaveBeenCalled();
  });

  it('releases a stale result without committing it', async () => {
    const firstLoad = createDeferred<ImageRef>();
    const secondLoad = createDeferred<ImageRef>();
    mockLoadAsync
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const staleImage = createImageRef();
    const currentImage = createImageRef();

    const { result, rerender } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      {
        initialProps: { source: { uri: 'https://example.com/a.png' } },
      },
    );

    rerender({ source: { uri: 'https://example.com/b.png' } });
    await resolveImage(firstLoad, staleImage.imageRef);

    expect(staleImage.release).toHaveBeenCalledTimes(1);
    expect(result.current.image).not.toBe(staleImage.imageRef);

    await resolveImage(secondLoad, currentImage.imageRef);
    expect(result.current.image).toBe(currentImage.imageRef);
  });

  it('starts a new request when a dependency changes during loading', async () => {
    const firstLoad = createDeferred<ImageRef>();
    const secondLoad = createDeferred<ImageRef>();
    mockLoadAsync
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const staleImage = createImageRef();
    const currentImage = createImageRef();

    const { result, rerender } = renderHook(
      ({ dependency }: { dependency: number }) =>
        useImage({ uri: 'https://example.com/a.png' }, {}, [dependency]),
      {
        initialProps: { dependency: 0 },
      },
    );

    rerender({ dependency: 1 });
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);

    await resolveImage(firstLoad, staleImage.imageRef);
    expect(staleImage.release).toHaveBeenCalledTimes(1);
    expect(result.current.image).not.toBe(staleImage.imageRef);

    await resolveImage(secondLoad, currentImage.imageRef);
    expect(result.current.image).toBe(currentImage.imageRef);
  });

  it('bypasses a cached path when retrying', async () => {
    const retryLoad = createDeferred<ImageRef>();
    const retryImage = createImageRef();
    let cachedPath: string | undefined = 'file:///cache/a.png';
    mockGetCachedImagePath.mockImplementation(() => cachedPath);
    mockDeleteCachedImagePath.mockImplementation(() => {
      cachedPath = undefined;
    });
    mockLoadAsync.mockReturnValueOnce(retryLoad.promise);

    const { result } = renderHook(() =>
      useImage({ uri: 'https://example.com/a.png' }),
    );

    expect(result.current.image).toEqual({ uri: cachedPath });
    expect(mockLoadAsync).not.toHaveBeenCalled();

    act(() => {
      result.current.reFetchImage();
    });

    expect(mockDeleteCachedImagePath).toHaveBeenCalledWith(
      'https://example.com/a.png',
    );
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();

    await resolveImage(retryLoad, retryImage.imageRef);
    expect(result.current.image).toBe(retryImage.imageRef);
  });

  it('bypasses and releases a retained cached ref when retrying', async () => {
    const retryLoad = createDeferred<ImageRef>();
    const cachedImage = createImageRef();
    const retryImage = createImageRef();
    mockGetCachedImageRef.mockReturnValue(cachedImage.imageRef);
    mockLoadAsync.mockReturnValueOnce(retryLoad.promise);

    const { result } = renderHook(() =>
      useImage({ uri: 'https://example.com/a.png' }),
    );

    expect(result.current.image).toBe(cachedImage.imageRef);
    expect(mockRetainCachedImageRef).toHaveBeenCalledWith(
      'https://example.com/a.png',
    );
    expect(mockLoadAsync).not.toHaveBeenCalled();

    act(() => {
      result.current.reFetchImage();
    });

    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();
    expect(mockReleaseCachedImageRef).toHaveBeenCalledWith(
      'https://example.com/a.png',
    );
    expect(cachedImage.release).not.toHaveBeenCalled();

    await resolveImage(retryLoad, retryImage.imageRef);
    expect(result.current.image).toBe(retryImage.imageRef);
  });

  it('scopes retry cache bypass to the current source generation', async () => {
    const sourceA = { uri: 'https://example.com/a.png' };
    const sourceB = { uri: 'https://example.com/b.png' };
    const retryLoad = createDeferred<ImageRef>();
    const retryImage = createImageRef();
    const cachedPaths = new Map<string, string>([
      [sourceA.uri, 'file:///cache/a.png'],
      [sourceB.uri, 'file:///cache/b.png'],
    ]);
    mockGetCachedImagePath.mockImplementation((uri) =>
      uri ? cachedPaths.get(uri) : undefined,
    );
    mockDeleteCachedImagePath.mockImplementation((uri) => {
      if (uri) {
        cachedPaths.delete(uri);
      }
    });
    mockRefreshCachedImagePath.mockImplementation(async (uri) => {
      if (uri === sourceA.uri) {
        const refreshedPath = 'file:///cache/a-refreshed.png';
        cachedPaths.set(uri, refreshedPath);
        return refreshedPath;
      }
      return undefined;
    });
    mockLoadAsync.mockReturnValueOnce(retryLoad.promise);

    const { result, rerender } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      {
        initialProps: { source: sourceA },
      },
    );

    expect(result.current.image).toEqual({ uri: 'file:///cache/a.png' });
    act(() => {
      result.current.reFetchImage();
    });
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);

    await resolveImage(retryLoad, retryImage.imageRef);
    expect(result.current.image).toBe(retryImage.imageRef);

    rerender({ source: sourceB });
    expect(result.current.image).toEqual({ uri: 'file:///cache/b.png' });

    rerender({ source: sourceA });
    expect(result.current.image).toEqual({
      uri: 'file:///cache/a-refreshed.png',
    });
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
  });
});

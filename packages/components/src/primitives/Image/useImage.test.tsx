/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useImage } from './useImage';

import type { ImageRef, ImageSource } from 'expo-image';

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
    jest.clearAllMocks();
    mockDeleteCachedImagePath.mockReset();
    mockGetCachedImagePath.mockReset();
    mockGetCachedImageRef.mockReset();
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
});

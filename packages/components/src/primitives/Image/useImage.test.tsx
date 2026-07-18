/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getCachedImagePath,
  getCachedImageRef,
  refreshCachedImagePath,
  releaseCachedImageRef,
  retainCachedImageRef,
} from './cache';
import { useImage } from './useImage';

import type { ImageRef, ImageSource } from 'expo-image';

const mockLoadAsync = jest.fn<Promise<ImageRef>, unknown[]>();

jest.mock('expo-image', () => ({
  Image: {
    loadAsync: (...args: unknown[]) => mockLoadAsync(...args),
  },
  resolveSource: jest.fn((source: unknown) =>
    typeof source === 'string' ? { uri: source } : source,
  ),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
    isNativeIOS: false,
  },
}));

jest.mock('./cache', () => ({
  deleteCachedImagePath: jest.fn(),
  getCachedImagePath: jest.fn(),
  getCachedImageRef: jest.fn(),
  refreshCachedImagePath: jest.fn(),
  releaseCachedImageRef: jest.fn(),
  retainCachedImageRef: jest.fn(),
}));

const TEST_SOURCE_A = 'https://example.com/a.png';
const TEST_SOURCE_B = 'https://example.com/b.png';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const imageReleaseMocks = new WeakMap<object, jest.Mock>();

function createImageRef() {
  const releaseMock = jest.fn();
  const imageRef = {
    release: releaseMock,
  } as unknown as ImageRef;
  imageReleaseMocks.set(imageRef, releaseMock);
  return imageRef;
}

function getImageReleaseMock(imageRef: ImageRef) {
  return imageReleaseMocks.get(imageRef)!;
}

const getCachedImagePathMock = getCachedImagePath as jest.Mock;
const getCachedImageRefMock = getCachedImageRef as jest.Mock;
const refreshCachedImagePathMock = refreshCachedImagePath as jest.Mock;
const releaseCachedImageRefMock = releaseCachedImageRef as jest.Mock;
const retainCachedImageRefMock = retainCachedImageRef as jest.Mock;

describe('useImage request lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNativeAndroid = false;
    platformEnv.isNativeIOS = false;
    getCachedImagePathMock.mockReturnValue(undefined);
    getCachedImageRefMock.mockReturnValue(undefined);
    refreshCachedImagePathMock.mockResolvedValue(undefined);
  });

  it('renders a plain Android URI immediately without a loadAsync skeleton gate', () => {
    platformEnv.isNativeAndroid = true;

    const { result } = renderHook(() => useImage(TEST_SOURCE_A));

    expect(result.current.image).toEqual({ uri: TEST_SOURCE_A });
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(getCachedImagePathMock).not.toHaveBeenCalled();
    expect(getCachedImageRefMock).not.toHaveBeenCalled();
  });

  it('renders an uncached plain iOS URI without a React skeleton gate', () => {
    platformEnv.isNativeIOS = true;

    const { result } = renderHook(() => useImage(TEST_SOURCE_A));

    expect(result.current.image).toEqual({ uri: TEST_SOURCE_A });
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(getCachedImagePathMock).toHaveBeenCalledWith(TEST_SOURCE_A);
    expect(getCachedImageRefMock).toHaveBeenCalledWith(TEST_SOURCE_A);
  });

  it('releases an image that resolves after unmount', async () => {
    const request = createDeferred<ImageRef>();
    const remoteImage = createImageRef();
    const onSuccess = jest.fn();
    mockLoadAsync.mockReturnValueOnce(request.promise);

    const { unmount } = renderHook(() =>
      useImage(TEST_SOURCE_A, { onSuccess }),
    );
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      request.resolve(remoteImage);
      await request.promise;
    });

    expect(getImageReleaseMock(remoteImage)).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(refreshCachedImagePathMock).not.toHaveBeenCalled();
  });

  it('does not run a queued retry after unmount', async () => {
    const request = createDeferred<ImageRef>();
    let retry: (() => void) | undefined;
    const onError = jest.fn((_error: unknown, retryRequest: () => void) => {
      retry = retryRequest;
    });
    mockLoadAsync.mockReturnValueOnce(request.promise);

    const { unmount } = renderHook(() => useImage(TEST_SOURCE_A, { onError }));
    await act(async () => {
      request.reject(new Error('failed'));
      await request.promise.catch(() => undefined);
    });
    expect(retry).toBeDefined();

    unmount();
    act(() => retry?.());

    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
  });

  it('releases a late old-source result without overwriting the new source', async () => {
    const oldRequest = createDeferred<ImageRef>();
    const newRequest = createDeferred<ImageRef>();
    const oldImage = createImageRef();
    const newImage = createImageRef();
    const onSuccess = jest.fn();
    mockLoadAsync
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }) => useImage(source, { onSuccess }),
      { initialProps: { source: TEST_SOURCE_A } },
    );
    rerender({ source: TEST_SOURCE_B });
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldRequest.resolve(oldImage);
      await oldRequest.promise;
    });
    expect(getImageReleaseMock(oldImage)).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      newRequest.resolve(newImage);
      await newRequest.promise;
    });
    expect(result.current.image).toBe(newImage);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(newImage);

    unmount();
    expect(getImageReleaseMock(newImage)).toHaveBeenCalledTimes(1);
  });

  it('does not reload an equivalent inline source object', async () => {
    const request = createDeferred<ImageRef>();
    const remoteImage = createImageRef();
    mockLoadAsync.mockReturnValueOnce(request.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      { initialProps: { source: { uri: TEST_SOURCE_A } } },
    );

    rerender({ source: { uri: TEST_SOURCE_A } });
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(remoteImage);
      await request.promise;
    });
    expect(result.current.image).toBe(remoteImage);

    rerender({ source: { uri: TEST_SOURCE_A } });
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBe(remoteImage);

    unmount();
    expect(getImageReleaseMock(remoteImage)).toHaveBeenCalledTimes(1);
  });

  it('treats the same URI with a different cache key as a new source', async () => {
    const oldRequest = createDeferred<ImageRef>();
    const newRequest = createDeferred<ImageRef>();
    const oldImage = createImageRef();
    const newImage = createImageRef();
    const uriOnlyCachedImage = createImageRef();
    getCachedImageRefMock.mockReturnValue(uriOnlyCachedImage);
    mockLoadAsync
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }: { source: ImageSource }) => useImage(source),
      {
        initialProps: {
          source: { cacheKey: 'account-a', uri: TEST_SOURCE_A },
        },
      },
    );
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(getCachedImageRefMock).not.toHaveBeenCalled();

    await act(async () => {
      oldRequest.resolve(oldImage);
      await oldRequest.promise;
    });
    expect(result.current.image).toBe(oldImage);

    rerender({
      source: { cacheKey: 'account-b', uri: TEST_SOURCE_A },
    });
    expect(result.current.image).toBeNull();
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);
    expect(getImageReleaseMock(oldImage)).toHaveBeenCalledTimes(1);
    expect(refreshCachedImagePathMock).not.toHaveBeenCalled();

    await act(async () => {
      newRequest.resolve(newImage);
      await newRequest.promise;
    });
    expect(result.current.image).toBe(newImage);

    unmount();
    expect(getImageReleaseMock(newImage)).toHaveBeenCalledTimes(1);
  });

  it('never displays or revives an ImageRef owned by another source', async () => {
    const firstSourceARequest = createDeferred<ImageRef>();
    const sourceBRequest = createDeferred<ImageRef>();
    const secondSourceARequest = createDeferred<ImageRef>();
    const firstSourceAImage = createImageRef();
    const staleSourceBImage = createImageRef();
    const secondSourceAImage = createImageRef();
    mockLoadAsync
      .mockReturnValueOnce(firstSourceARequest.promise)
      .mockReturnValueOnce(sourceBRequest.promise)
      .mockReturnValueOnce(secondSourceARequest.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }) => useImage(source),
      { initialProps: { source: TEST_SOURCE_A } },
    );

    await act(async () => {
      firstSourceARequest.resolve(firstSourceAImage);
      await firstSourceARequest.promise;
    });
    expect(result.current.image).toBe(firstSourceAImage);

    rerender({ source: TEST_SOURCE_B });
    expect(result.current.image).toBeNull();
    expect(getImageReleaseMock(firstSourceAImage)).toHaveBeenCalledTimes(1);

    rerender({ source: TEST_SOURCE_A });
    expect(mockLoadAsync).toHaveBeenCalledTimes(3);
    expect(result.current.image).toBeNull();
    expect(getImageReleaseMock(firstSourceAImage)).toHaveBeenCalledTimes(1);

    await act(async () => {
      sourceBRequest.resolve(staleSourceBImage);
      await sourceBRequest.promise;
    });
    expect(getImageReleaseMock(staleSourceBImage)).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();
    expect(getImageReleaseMock(firstSourceAImage)).toHaveBeenCalledTimes(1);

    await act(async () => {
      secondSourceARequest.resolve(secondSourceAImage);
      await secondSourceARequest.promise;
    });
    expect(result.current.image).toBe(secondSourceAImage);
    expect(getImageReleaseMock(firstSourceAImage)).toHaveBeenCalledTimes(1);

    unmount();
    expect(getImageReleaseMock(secondSourceAImage)).toHaveBeenCalledTimes(1);
  });

  it('lets a cached source take ownership after the previous source was refetched', async () => {
    const initialSourceARequest = createDeferred<ImageRef>();
    const sourceARefetchRequest = createDeferred<ImageRef>();
    const sourceAImage = createImageRef();
    const staleSourceARefetchImage = createImageRef();
    const cachedSourceBImage = createImageRef();
    getCachedImageRefMock.mockImplementation((uri: string | undefined) =>
      uri === TEST_SOURCE_B ? cachedSourceBImage : undefined,
    );
    mockLoadAsync
      .mockReturnValueOnce(initialSourceARequest.promise)
      .mockReturnValueOnce(sourceARefetchRequest.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }) => useImage(source),
      { initialProps: { source: TEST_SOURCE_A } },
    );
    await act(async () => {
      initialSourceARequest.resolve(sourceAImage);
      await initialSourceARequest.promise;
    });

    act(() => result.current.reFetchImage());
    expect(result.current.image).toBe(sourceAImage);
    rerender({ source: TEST_SOURCE_B });

    expect(result.current.image).toBe(cachedSourceBImage);
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);
    expect(retainCachedImageRefMock).toHaveBeenCalledWith(TEST_SOURCE_B);

    await act(async () => {
      sourceARefetchRequest.resolve(staleSourceARefetchImage);
      await sourceARefetchRequest.promise;
    });
    expect(getImageReleaseMock(staleSourceARefetchImage)).toHaveBeenCalledTimes(
      1,
    );
    expect(result.current.image).toBe(cachedSourceBImage);
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);

    unmount();
    expect(releaseCachedImageRefMock).toHaveBeenCalledWith(TEST_SOURCE_B);
    expect(getImageReleaseMock(cachedSourceBImage)).not.toHaveBeenCalled();
  });

  it('releases the previous image once when the current source fails', async () => {
    const sourceARequest = createDeferred<ImageRef>();
    const sourceBRequest = createDeferred<ImageRef>();
    const sourceAImage = createImageRef();
    const onError = jest.fn();
    mockLoadAsync
      .mockReturnValueOnce(sourceARequest.promise)
      .mockReturnValueOnce(sourceBRequest.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }) => useImage(source, { onError }),
      { initialProps: { source: TEST_SOURCE_A } },
    );
    await act(async () => {
      sourceARequest.resolve(sourceAImage);
      await sourceARequest.promise;
    });

    rerender({ source: TEST_SOURCE_B });
    expect(result.current.image).toBeNull();
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);
    await act(async () => {
      sourceBRequest.reject(new Error('failed'));
      await sourceBRequest.promise.catch(() => undefined);
    });

    expect(result.current.image).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);

    unmount();
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);
  });

  it('releases the previous image once when the current source becomes empty', async () => {
    const sourceARequest = createDeferred<ImageRef>();
    const sourceAImage = createImageRef();
    mockLoadAsync.mockReturnValueOnce(sourceARequest.promise);

    const { result, rerender, unmount } = renderHook(
      ({ source }: { source: string | undefined }) => useImage(source),
      {
        initialProps: {
          source: TEST_SOURCE_A as string | undefined,
        },
      },
    );
    await act(async () => {
      sourceARequest.resolve(sourceAImage);
      await sourceARequest.promise;
    });

    rerender({ source: undefined });

    expect(result.current.image).toBeNull();
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);

    unmount();
    expect(getImageReleaseMock(sourceAImage)).toHaveBeenCalledTimes(1);
  });

  it('does not let an old-source retry start after the source changes', async () => {
    const oldRequest = createDeferred<ImageRef>();
    const newRequest = createDeferred<ImageRef>();
    const newImage = createImageRef();
    let retry: (() => void) | undefined;
    const onError = jest.fn((_error: unknown, retryRequest: () => void) => {
      retry = retryRequest;
    });
    mockLoadAsync
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result, rerender } = renderHook(
      ({ source }) => useImage(source, { onError }),
      { initialProps: { source: TEST_SOURCE_A } },
    );
    await act(async () => {
      oldRequest.reject(new Error('failed'));
      await oldRequest.promise.catch(() => undefined);
    });
    expect(retry).toBeDefined();

    rerender({ source: TEST_SOURCE_B });
    act(() => retry?.());
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);

    await act(async () => {
      newRequest.resolve(newImage);
      await newRequest.promise;
    });
    expect(result.current.image).toBe(newImage);
  });

  it('invalidates the previous same-source request when refetching', async () => {
    const oldRequest = createDeferred<ImageRef>();
    const newRequest = createDeferred<ImageRef>();
    const oldImage = createImageRef();
    const newImage = createImageRef();
    mockLoadAsync
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const { result } = renderHook(() => useImage(TEST_SOURCE_A));
    act(() => result.current.reFetchImage());
    expect(mockLoadAsync).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldRequest.resolve(oldImage);
      await oldRequest.promise;
    });
    expect(getImageReleaseMock(oldImage)).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();

    await act(async () => {
      newRequest.resolve(newImage);
      await newRequest.promise;
    });
    expect(result.current.image).toBe(newImage);
  });

  it('publishes and releases a current request success', async () => {
    const request = createDeferred<ImageRef>();
    const remoteImage = createImageRef();
    const onSuccess = jest.fn();
    mockLoadAsync.mockReturnValueOnce(request.promise);

    const { result, unmount } = renderHook(() =>
      useImage(TEST_SOURCE_A, { onSuccess }),
    );
    await act(async () => {
      request.resolve(remoteImage);
      await request.promise;
    });

    expect(result.current.image).toBe(remoteImage);
    expect(onSuccess).toHaveBeenCalledWith(remoteImage);
    expect(refreshCachedImagePathMock).toHaveBeenCalledWith(TEST_SOURCE_A);
    expect(getImageReleaseMock(remoteImage)).not.toHaveBeenCalled();

    unmount();
    expect(getImageReleaseMock(remoteImage)).toHaveBeenCalledTimes(1);
  });

  it('retains and releases a cached image ref without loading it again', () => {
    const cachedImage = createImageRef();
    getCachedImageRefMock.mockReturnValue(cachedImage);

    const { result, unmount } = renderHook(() => useImage(TEST_SOURCE_A));

    expect(result.current.image).toBe(cachedImage);
    expect(mockLoadAsync).not.toHaveBeenCalled();
    expect(retainCachedImageRefMock).toHaveBeenCalledWith(TEST_SOURCE_A);

    unmount();
    expect(releaseCachedImageRefMock).toHaveBeenCalledWith(TEST_SOURCE_A);
    expect(getImageReleaseMock(cachedImage)).not.toHaveBeenCalled();
  });
});

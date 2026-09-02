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

// Android: expo-image is backed by Glide, which cannot share decoded refs
// across views and rejects bare cache paths (see cache.ts). These tests pin
// down the Android-only fast path of useImage.
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: true,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: jest.fn(() => 'generated-cache-key'),
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
const mockRefreshCachedImagePath = jest.mocked(
  cacheModule.refreshCachedImagePath,
);
const mockRetainCachedImageRef = jest.mocked(cacheModule.retainCachedImageRef);

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createImageRef() {
  return {
    height: 96,
    release: jest.fn(),
    scale: 1,
    width: 96,
  } as unknown as ImageRef;
}

async function resolveImage(deferred: IDeferred<ImageRef>, imageRef: ImageRef) {
  await act(async () => {
    deferred.resolve(imageRef);
    await deferred.promise;
    await Promise.resolve();
  });
}

const REMOTE_URI = 'https://example.com/a.png';
// What Glide's disk cache lookup returns on Android: a bare absolute path
// without a `file://` scheme, which Glide itself refuses to load as a source.
const GLIDE_CACHE_PATH =
  '/data/user/0/so.onekey.wallet/cache/image_manager_disk_cache/abc.0';

describe('useImage on Android', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteCachedImagePath.mockReset();
    mockGetCachedImagePath.mockReset();
    mockGetCachedImageRef.mockReset();
    mockRefreshCachedImagePath.mockReset();
    mockRefreshCachedImagePath.mockResolvedValue(undefined);
    mockRetainCachedImageRef.mockReset();
  });

  it('renders a known-cached URL straight away using the original URL', () => {
    mockGetCachedImagePath.mockImplementation(() => GLIDE_CACHE_PATH);

    const { result } = renderHook(() => useImage({ uri: REMOTE_URI }));

    expect(result.current.image).toEqual({ uri: REMOTE_URI });
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });

  it('decodes through loadAsync when the URL has not been cached yet', async () => {
    const load = createDeferred<ImageRef>();
    const imageRef = createImageRef();
    mockGetCachedImagePath.mockImplementation(() => undefined);
    mockLoadAsync.mockReturnValueOnce(load.promise);

    const { result } = renderHook(() => useImage({ uri: REMOTE_URI }));

    expect(result.current.image).toBeNull();
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);

    await resolveImage(load, imageRef);

    expect(result.current.image).toBe(imageRef);
    // Records the URL so the next mount takes the synchronous path.
    expect(mockRefreshCachedImagePath).toHaveBeenCalledWith(REMOTE_URI);
  });

  it('bypasses the cached URL and decodes again when retrying', async () => {
    const retryLoad = createDeferred<ImageRef>();
    const retryImage = createImageRef();
    let cachedPath: string | undefined = GLIDE_CACHE_PATH;
    mockGetCachedImagePath.mockImplementation(() => cachedPath);
    mockDeleteCachedImagePath.mockImplementation(() => {
      cachedPath = undefined;
    });
    mockLoadAsync.mockReturnValueOnce(retryLoad.promise);

    const { result } = renderHook(() => useImage({ uri: REMOTE_URI }));

    expect(result.current.image).toEqual({ uri: REMOTE_URI });
    expect(mockLoadAsync).not.toHaveBeenCalled();

    act(() => {
      result.current.reFetchImage();
    });

    expect(mockDeleteCachedImagePath).toHaveBeenCalledWith(REMOTE_URI);
    expect(mockLoadAsync).toHaveBeenCalledTimes(1);
    expect(result.current.image).toBeNull();

    await resolveImage(retryLoad, retryImage);
    expect(result.current.image).toBe(retryImage);
  });

  it('never reads or retains decoded refs from the shared cache', () => {
    const sharedRef = createImageRef();
    mockGetCachedImageRef.mockImplementation(() => sharedRef);
    mockGetCachedImagePath.mockImplementation(() => GLIDE_CACHE_PATH);

    const { result } = renderHook(() => useImage({ uri: REMOTE_URI }));

    expect(result.current.image).toEqual({ uri: REMOTE_URI });
    expect(mockRetainCachedImageRef).not.toHaveBeenCalled();
  });

  it('keeps serving local file sources directly', () => {
    const { result } = renderHook(() =>
      useImage({ uri: 'file:///data/local/icon.png' }),
    );

    expect(result.current.image).toEqual({
      uri: 'file:///data/local/icon.png',
    });
    expect(mockLoadAsync).not.toHaveBeenCalled();
  });
});

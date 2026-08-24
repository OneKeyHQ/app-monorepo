import type { ImageRef } from 'expo-image';

const mockLoadAsync = jest.fn<Promise<ImageRef>, unknown[]>();

jest.mock('expo-image', () => ({
  Image: {
    getCachePathAsync: jest.fn(),
    loadAsync: (...args: unknown[]) => mockLoadAsync(...args),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNativeAndroid: false,
  },
}));

const {
  cacheAndRetainImageRef,
  deleteCachedImagePath,
  getCachedImageRef,
  getCachedImageRefInfo,
  hasExactCachedImageRef,
  refreshCachedImageRef,
  releaseCachedImageRef,
}: typeof import('./cache') = require('./cache');

function createImageRef() {
  const release = jest.fn();
  return {
    imageRef: {
      release,
    } as unknown as ImageRef,
    release,
  };
}

describe('decoded image cache ownership', () => {
  beforeEach(() => {
    mockLoadAsync.mockClear();
  });

  it('keeps a loaded ImageRef alive after its rendering owner releases it', () => {
    const uri = 'https://example.com/token-a.png';
    const { imageRef, release } = createImageRef();

    expect(cacheAndRetainImageRef(uri, imageRef)).toBe(imageRef);
    expect(getCachedImageRef(uri)).toBe(imageRef);

    releaseCachedImageRef(uri);
    expect(release).not.toHaveBeenCalled();

    deleteCachedImagePath(uri);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing ImageRef and releases the duplicate decode', () => {
    const uri = 'https://example.com/token-b.png';
    const { imageRef: firstImageRef, release: releaseFirstImageRef } =
      createImageRef();
    const { imageRef: duplicateImageRef, release: releaseDuplicateImageRef } =
      createImageRef();

    expect(cacheAndRetainImageRef(uri, firstImageRef)).toBe(firstImageRef);
    releaseCachedImageRef(uri);

    expect(cacheAndRetainImageRef(uri, duplicateImageRef)).toBe(firstImageRef);
    expect(releaseDuplicateImageRef).toHaveBeenCalledTimes(1);

    releaseCachedImageRef(uri);
    deleteCachedImagePath(uri);
    expect(releaseFirstImageRef).toHaveBeenCalledTimes(1);
  });

  it('does not replace an invalidated ImageRef while it is still rendered', () => {
    const uri = 'https://example.com/token-c.png';
    const { imageRef: activeImageRef, release: releaseActiveImageRef } =
      createImageRef();
    const {
      imageRef: replacementImageRef,
      release: releaseReplacementImageRef,
    } = createImageRef();

    expect(cacheAndRetainImageRef(uri, activeImageRef)).toBe(activeImageRef);
    deleteCachedImagePath(uri);

    expect(cacheAndRetainImageRef(uri, replacementImageRef)).toBeUndefined();
    expect(releaseReplacementImageRef).not.toHaveBeenCalled();

    releaseCachedImageRef(uri);
    expect(releaseActiveImageRef).toHaveBeenCalledTimes(1);
  });

  it('shows a decoded logical variant before the requested variant is ready', () => {
    const cacheKey = 'https://example.com/token-d.png';
    const listUri = `${cacheKey}?resize=w_160`;
    const homeUri = `${cacheKey}?resize=w_96`;
    const { imageRef: listImageRef } = createImageRef();
    const { imageRef: homeImageRef } = createImageRef();

    expect(cacheAndRetainImageRef(cacheKey, listImageRef, listUri)).toBe(
      listImageRef,
    );
    expect(getCachedImageRefInfo(cacheKey, homeUri)).toEqual({
      imageRef: listImageRef,
      sourceUri: listUri,
    });
    expect(hasExactCachedImageRef(cacheKey, homeUri)).toBe(false);

    expect(cacheAndRetainImageRef(cacheKey, homeImageRef, homeUri)).toBe(
      homeImageRef,
    );
    expect(getCachedImageRefInfo(cacheKey, homeUri)).toEqual({
      imageRef: homeImageRef,
      sourceUri: homeUri,
    });
    expect(hasExactCachedImageRef(cacheKey, homeUri)).toBe(true);

    releaseCachedImageRef(cacheKey, listUri, listImageRef);
    releaseCachedImageRef(cacheKey, homeUri, homeImageRef);
    deleteCachedImagePath(cacheKey);
  });

  it('evicts the least-recently-used decoded ImageRef beyond capacity', () => {
    const refs = Array.from({ length: 129 }, () => createImageRef());
    const uris = refs.map(
      (_ref, index) => `https://example.com/lru-token-${index}.png`,
    );

    refs.forEach(({ imageRef }, index) => {
      expect(cacheAndRetainImageRef(uris[index], imageRef)).toBe(imageRef);
      releaseCachedImageRef(uris[index]);
    });

    expect(refs[0].release).toHaveBeenCalledTimes(1);
    expect(getCachedImageRef(uris[0])).toBeUndefined();
    expect(getCachedImageRef(uris[128])).toBe(refs[128].imageRef);

    uris.slice(1).forEach((uri) => deleteCachedImagePath(uri));
  });

  it('returns an exact warm iOS ImageRef without decoding it again', async () => {
    const uri = 'https://example.com/token-e.png';
    const { imageRef } = createImageRef();

    expect(cacheAndRetainImageRef(uri, imageRef, uri)).toBe(imageRef);

    await expect(refreshCachedImageRef(uri)).resolves.toBe(imageRef);
    expect(mockLoadAsync).not.toHaveBeenCalled();

    releaseCachedImageRef(uri, uri, imageRef);
    deleteCachedImagePath(uri);
  });

  it('never releases a replacement entry for an older ImageRef owner', () => {
    const uri = 'https://example.com/token-f.png';
    const { imageRef: oldImageRef } = createImageRef();
    const { imageRef: currentImageRef, release: releaseCurrentImageRef } =
      createImageRef();

    expect(cacheAndRetainImageRef(uri, oldImageRef)).toBe(oldImageRef);
    releaseCachedImageRef(uri, uri, oldImageRef);
    deleteCachedImagePath(uri);
    expect(cacheAndRetainImageRef(uri, currentImageRef)).toBe(currentImageRef);

    releaseCachedImageRef(uri, uri, oldImageRef);
    deleteCachedImagePath(uri);
    expect(releaseCurrentImageRef).not.toHaveBeenCalled();

    releaseCachedImageRef(uri, uri, currentImageRef);
    expect(releaseCurrentImageRef).toHaveBeenCalledTimes(1);
  });
});

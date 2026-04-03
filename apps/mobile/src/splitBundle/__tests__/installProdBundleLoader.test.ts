/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
type LoadBundleAsyncGlobal = typeof globalThis & {
  __loadBundleAsync?: (bundlePath: string) => Promise<void>;
};

beforeEach(() => {
  jest.resetModules();
  jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
    defaultLogger: { app: { bootstrap: { initDeferredStep: jest.fn() } } },
  }));
  (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'main';
  (globalThis as any).__SEGMENT_MANIFEST__ = {
    segments: {
      'seg:test.a': {
        id: 1,
        key: 'seg:test.a',
        runtime: 'shared',
        relativePath: 'segments/a.seg.hbc',
        sha256: 'aaa',
        dependsOn: [],
      },
      'seg:test.b': {
        id: 2,
        key: 'seg:test.b',
        runtime: 'shared',
        relativePath: 'segments/b.seg.hbc',
        sha256: 'bbb',
        dependsOn: ['seg:test.a'],
      },
      'seg:test.bg': {
        id: 3,
        key: 'seg:test.bg',
        runtime: 'background',
        relativePath: 'segments/bg.seg.hbc',
        sha256: 'ccc',
        dependsOn: [],
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as any).__ONEKEY_RUNTIME_KIND__;
  delete (globalThis as any).__SEGMENT_MANIFEST__;
  delete (globalThis as any).__loadBundleAsync;
});

function getLoader() {
  return require('../installProdBundleLoader');
}

function createMockNativeLoader() {
  return {
    getRuntimeBundleContext: jest.fn().mockResolvedValue({
      runtimeKind: 'main',
      sourceKind: 'builtin',
      bundleRoot: '/app',
      nativeVersion: '1.0',
    }),
    loadSegment: jest.fn().mockResolvedValue(undefined),
  };
}

describe('installProdBundleLoader', () => {
  it('loads a segment and marks it as ready', async () => {
    const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
      getLoader();
    installProdBundleLoader(createMockNativeLoader());
    await loadSegment('seg:test.a');
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
  });

  it('deduplicates concurrent requests', async () => {
    const mock = createMockNativeLoader();
    const { installProdBundleLoader, loadSegment } = getLoader();
    installProdBundleLoader(mock);
    await Promise.all([loadSegment('seg:test.a'), loadSegment('seg:test.a')]);
    expect(mock.loadSegment).toHaveBeenCalledTimes(1);
  });

  it('rejects when segment is not in manifest', async () => {
    const { installProdBundleLoader, loadSegment } = getLoader();
    installProdBundleLoader(createMockNativeLoader());
    await expect(loadSegment('seg:nonexistent')).rejects.toThrow(
      'not found in manifest',
    );
  });

  it('rejects when runtime access control denies', async () => {
    const { installProdBundleLoader, loadSegment } = getLoader();
    installProdBundleLoader(createMockNativeLoader());
    await expect(loadSegment('seg:test.bg')).rejects.toThrow('not allowed');
  });

  it('loads the runtime-specific variant for the current runtime', async () => {
    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'background';
    (globalThis as any).__SEGMENT_MANIFEST__ = {
      segments: {
        'seg:test.dual': {
          key: 'seg:test.dual',
          variants: {
            main: {
              id: 4,
              key: 'seg:test.dual',
              runtime: 'main',
              relativePath: 'segments/dual.seg.hbc',
              sha256: 'main',
              dependsOn: [],
            },
            background: {
              id: 4,
              key: 'seg:test.dual',
              runtime: 'background',
              relativePath: 'segments-background/dual.seg.hbc',
              sha256: 'background',
              dependsOn: [],
            },
          },
        },
      },
    };

    const mock = createMockNativeLoader();
    const { installProdBundleLoader, loadSegment } = getLoader();
    installProdBundleLoader(mock);

    await loadSegment('seg:test.dual');

    expect(mock.loadSegment).toHaveBeenCalledWith(
      expect.objectContaining({
        segmentId: 4,
        segmentKey: 'seg:test.dual',
        relativePath: 'segments-background/dual.seg.hbc',
        sha256: 'background',
      }),
    );
  });

  it('loads dependencies before the segment', async () => {
    const mock = createMockNativeLoader();
    const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
      getLoader();
    installProdBundleLoader(mock);
    await loadSegment('seg:test.b');
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
    expect(isSegmentLoaded('seg:test.b')).toBe(true);
    expect(mock.loadSegment.mock.calls[0][0].segmentKey).toBe('seg:test.a');
    expect(mock.loadSegment.mock.calls[1][0].segmentKey).toBe('seg:test.b');
  });

  it('caches failures and rejects subsequent calls', async () => {
    const mock = createMockNativeLoader();
    mock.loadSegment.mockRejectedValueOnce(new Error('I/O error'));
    const { installProdBundleLoader, loadSegment } = getLoader();
    installProdBundleLoader(mock);
    await expect(loadSegment('seg:test.a')).rejects.toThrow('I/O error');
    await expect(loadSegment('seg:test.a')).rejects.toThrow('I/O error');
    expect(mock.loadSegment).toHaveBeenCalledTimes(1);
  });

  it('retrySegment clears cache and retries', async () => {
    const mock = createMockNativeLoader();
    mock.loadSegment.mockRejectedValueOnce(new Error('I/O error'));
    const {
      installProdBundleLoader,
      loadSegment,
      retrySegment,
      isSegmentLoaded,
    } = getLoader();
    installProdBundleLoader(mock);
    await expect(loadSegment('seg:test.a')).rejects.toThrow();
    mock.loadSegment.mockResolvedValueOnce(undefined);
    await retrySegment('seg:test.a');
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
  });

  it('installs global __loadBundleAsync and routes it to segment loading', async () => {
    const mock = createMockNativeLoader();
    const { installProdBundleLoader, isSegmentLoaded } = getLoader();

    installProdBundleLoader(mock);

    await expect(
      (globalThis as LoadBundleAsyncGlobal).__loadBundleAsync?.('seg:test.a'),
    ).resolves.toBe(undefined);
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
    expect(mock.loadSegment).toHaveBeenCalledTimes(1);
  });

  it('rejects circular dependsOn graphs', async () => {
    (globalThis as any).__SEGMENT_MANIFEST__ = {
      segments: {
        'seg:test.a': {
          id: 1,
          key: 'seg:test.a',
          runtime: 'shared',
          relativePath: 'segments/a.seg.hbc',
          sha256: 'aaa',
          dependsOn: ['seg:test.b'],
        },
        'seg:test.b': {
          id: 2,
          key: 'seg:test.b',
          runtime: 'shared',
          relativePath: 'segments/b.seg.hbc',
          sha256: 'bbb',
          dependsOn: ['seg:test.a'],
        },
      },
    };
    const { installProdBundleLoader, loadSegment } = getLoader();

    installProdBundleLoader(createMockNativeLoader());

    await expect(loadSegment('seg:test.a')).rejects.toThrow(
      'Circular dependency detected',
    );
  });
});

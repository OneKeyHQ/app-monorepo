/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
type ILoadBundleAsyncGlobal = typeof globalThis & {
  __METRO_GLOBAL_PREFIX__?: string;
  __loadBundleAsync?: (
    bundlePath:
      | string
      | Partial<Record<'main' | 'background' | 'shared', string | null>>,
  ) => Promise<void>;
};

const mockNativeLoggerWrite = jest.fn();

beforeEach(() => {
  jest.resetModules();
  mockNativeLoggerWrite.mockReset();
  jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
    defaultLogger: { app: { bootstrap: { initDeferredStep: jest.fn() } } },
  }));
  jest.mock(
    '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
    () => ({
      LogLevel: { Debug: 0, Info: 1, Warning: 2, Error: 3 },
      NativeLogger: { write: mockNativeLoggerWrite },
    }),
  );
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
  delete (globalThis as any).__METRO_GLOBAL_PREFIX__;
  delete (globalThis as any).test__loadBundleAsync;
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

  it('rejects when a seg: key is missing from the manifest (hard error)', async () => {
    const mock = createMockNativeLoader();
    const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
      getLoader();
    installProdBundleLoader(mock);
    await expect(loadSegment('seg:nonexistent')).rejects.toThrow(
      /segment missing from manifest/,
    );
    expect(isSegmentLoaded('seg:nonexistent')).toBe(false);
    expect(mock.loadSegment).not.toHaveBeenCalled();
  });

  it('resolves silently for Metro URL-style async-require keys (eager fallback)', async () => {
    const mock = createMockNativeLoader();
    const {
      installProdBundleLoader,
      loadSegment,
      isSegmentLoaded,
      getEagerFallbackKeys,
    } = getLoader();
    installProdBundleLoader(mock);
    const eagerKey =
      '/packages/core/src/chains/btc/sdkBtc/index.bundle?modulesOnly=true&runModule=false';
    await expect(loadSegment(eagerKey)).resolves.toBe(undefined);
    expect(isSegmentLoaded(eagerKey)).toBe(true);
    expect(mock.loadSegment).not.toHaveBeenCalled();
    expect(getEagerFallbackKeys()).toContain(eagerKey);
  });

  it('only warns once per eager-fallback key even on repeated loads', async () => {
    const { installProdBundleLoader, loadSegment } = getLoader();
    installProdBundleLoader(createMockNativeLoader());
    const eagerKey = '/packages/foo/index.bundle?modulesOnly=true';
    await loadSegment(eagerKey);
    await loadSegment(eagerKey);
    await loadSegment(eagerKey);
    const warnCalls = mockNativeLoggerWrite.mock.calls.filter(([, msg]) =>
      /eager fallback/.test(String(msg)),
    );
    expect(warnCalls).toHaveLength(1);
  });

  it('still resolves the eager fallback even if the diagnostic log throws', async () => {
    const {
      OneKeyLocalError,
    } = require('@onekeyhq/shared/src/errors/errors/localError');
    mockNativeLoggerWrite.mockImplementation(() => {
      throw new OneKeyLocalError('logger is dead');
    });
    const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
      getLoader();
    installProdBundleLoader(createMockNativeLoader());
    const eagerKey = '/packages/whatever/index.bundle?modulesOnly=true';
    await expect(loadSegment(eagerKey)).resolves.toBe(undefined);
    expect(isSegmentLoaded(eagerKey)).toBe(true);
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

  describe('per-runtime dependsOn overrides', () => {
    function setupPerRuntimeManifest() {
      (globalThis as any).__SEGMENT_MANIFEST__ = {
        segments: {
          'seg:main.only.dep': {
            id: 10,
            key: 'seg:main.only.dep',
            runtime: 'main',
            relativePath: 'segments/main-only.seg.hbc',
            sha256: 'main-only',
            dependsOn: [],
          },
          'seg:bg.only.dep': {
            id: 11,
            key: 'seg:bg.only.dep',
            runtime: 'background',
            relativePath: 'segments-background/bg-only.seg.hbc',
            sha256: 'bg-only',
            dependsOn: [],
          },
          'seg:shared.divergent': {
            id: 12,
            key: 'seg:shared.divergent',
            runtime: 'shared',
            relativePath: 'segments/divergent.seg.hbc',
            sha256: 'divergent',
            dependsOn: ['seg:main.only.dep', 'seg:bg.only.dep'],
            mainDependsOn: ['seg:main.only.dep'],
            backgroundDependsOn: ['seg:bg.only.dep'],
          },
        },
      };
    }

    it('main runtime preloads only mainDependsOn (skips bg-only deps)', async () => {
      (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'main';
      setupPerRuntimeManifest();

      const mock = createMockNativeLoader();
      const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
        getLoader();
      installProdBundleLoader(mock);

      await loadSegment('seg:shared.divergent');

      const loadedKeys = mock.loadSegment.mock.calls.map(
        (args: any[]) => args[0].segmentKey,
      );
      expect(loadedKeys).toEqual(['seg:main.only.dep', 'seg:shared.divergent']);
      expect(isSegmentLoaded('seg:bg.only.dep')).toBe(false);
    });

    it('background runtime preloads only backgroundDependsOn (skips main-only deps)', async () => {
      (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'background';
      setupPerRuntimeManifest();

      const mock = createMockNativeLoader();
      const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
        getLoader();
      installProdBundleLoader(mock);

      await loadSegment('seg:shared.divergent');

      const loadedKeys = mock.loadSegment.mock.calls.map(
        (args: any[]) => args[0].segmentKey,
      );
      expect(loadedKeys).toEqual(['seg:bg.only.dep', 'seg:shared.divergent']);
      expect(isSegmentLoaded('seg:main.only.dep')).toBe(false);
    });

    it('falls back to dependsOn when per-runtime overrides are absent', async () => {
      (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'main';
      // Default manifest from beforeEach: seg:test.b has dependsOn=['seg:test.a']
      // but no mainDependsOn / backgroundDependsOn fields.
      const mock = createMockNativeLoader();
      const { installProdBundleLoader, loadSegment, isSegmentLoaded } =
        getLoader();
      installProdBundleLoader(mock);

      await loadSegment('seg:test.b');

      expect(isSegmentLoaded('seg:test.a')).toBe(true);
      expect(isSegmentLoaded('seg:test.b')).toBe(true);
    });

    it('reproduces the pre-fix crash when a shared entry only has the union dependsOn', async () => {
      // Without mainDependsOn override, the main runtime would walk into
      // seg:bg.only.dep and the runtime access check would reject.
      (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'main';
      (globalThis as any).__SEGMENT_MANIFEST__ = {
        segments: {
          'seg:bg.only.dep': {
            id: 11,
            key: 'seg:bg.only.dep',
            runtime: 'background',
            relativePath: 'segments-background/bg-only.seg.hbc',
            sha256: 'bg-only',
            dependsOn: [],
          },
          'seg:shared.divergent': {
            id: 12,
            key: 'seg:shared.divergent',
            runtime: 'shared',
            relativePath: 'segments/divergent.seg.hbc',
            sha256: 'divergent',
            dependsOn: ['seg:bg.only.dep'],
          },
        },
      };

      const { installProdBundleLoader, loadSegment } = getLoader();
      installProdBundleLoader(createMockNativeLoader());

      await expect(loadSegment('seg:shared.divergent')).rejects.toThrow(
        /not allowed in 'main' runtime/,
      );
    });
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
      (globalThis as ILoadBundleAsyncGlobal).__loadBundleAsync?.('seg:test.a'),
    ).resolves.toBe(undefined);
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
    expect(mock.loadSegment).toHaveBeenCalledTimes(1);
  });

  it('resolves runtime-specific async path records without loading eager background modules', async () => {
    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'background';

    const mock = createMockNativeLoader();
    const { installProdBundleLoader, isSegmentLoaded } = getLoader();

    installProdBundleLoader(mock);

    await expect(
      (globalThis as ILoadBundleAsyncGlobal).__loadBundleAsync?.({
        main: 'seg:test.a',
        background: null,
      }),
    ).resolves.toBe(undefined);

    expect(isSegmentLoaded('seg:test.a')).toBe(false);
    expect(mock.loadSegment).not.toHaveBeenCalled();
  });

  it('installs the Metro-prefixed __loadBundleAsync key when a prefix exists', async () => {
    (globalThis as any).__METRO_GLOBAL_PREFIX__ = 'test';

    const mock = createMockNativeLoader();
    const { installProdBundleLoader, isSegmentLoaded } = getLoader();

    installProdBundleLoader(mock);

    await expect(
      (
        globalThis as ILoadBundleAsyncGlobal & {
          test__loadBundleAsync?: (bundlePath: string) => Promise<void>;
        }
      ).test__loadBundleAsync?.('seg:test.a'),
    ).resolves.toBe(undefined);
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
    expect(mock.loadSegment).toHaveBeenCalledTimes(1);
  });

  it('keeps the split-bundle loader authoritative when Expo assigns its default loader', async () => {
    (globalThis as any).__METRO_GLOBAL_PREFIX__ = 'test';

    const mock = createMockNativeLoader();
    const { installProdBundleLoader, isSegmentLoaded } = getLoader();

    installProdBundleLoader(mock);

    const expoUrlLoader = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValue(new Error('should not be called'));

    (globalThis as any).test__loadBundleAsync = expoUrlLoader;

    await expect(
      (
        globalThis as ILoadBundleAsyncGlobal & {
          test__loadBundleAsync?: (bundlePath: string) => Promise<void>;
        }
      ).test__loadBundleAsync?.('seg:test.a'),
    ).resolves.toBe(undefined);
    expect(isSegmentLoaded('seg:test.a')).toBe(true);
    expect(expoUrlLoader).not.toHaveBeenCalled();
    expect(mock.loadSegment).toHaveBeenCalledTimes(1);
  });

  describe('Metro-URL eager fallback is loud', () => {
    it('logs at ERROR level with [BUG] prefix for paths matching the Metro async-require URL shape', async () => {
      const {
        LogLevel,
      } = require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      const { installProdBundleLoader, loadSegment } = getLoader();
      installProdBundleLoader(createMockNativeLoader());

      await loadSegment(
        '/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false',
      );

      const errorLogs = mockNativeLoggerWrite.mock.calls.filter(
        ([level]) => level === LogLevel.Error,
      );
      expect(
        errorLogs.some(
          ([, msg]) =>
            typeof msg === 'string' &&
            msg.includes('[SplitBundle][BUG] missing-rewrite eager fallback'),
        ),
      ).toBe(true);
    });

    it('still logs at WARNING for benign eager-fallback (non-Metro-URL) keys', async () => {
      const {
        LogLevel,
      } = require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      const { installProdBundleLoader, loadSegment } = getLoader();
      installProdBundleLoader(createMockNativeLoader());

      await loadSegment(`some-non-metro-key-${Math.random()}`);

      const warnLogs = mockNativeLoggerWrite.mock.calls.filter(
        ([level]) => level === LogLevel.Warning,
      );
      expect(
        warnLogs.some(
          ([, msg]) =>
            typeof msg === 'string' &&
            msg.includes('[SplitBundle] eager fallback'),
        ),
      ).toBe(true);
    });
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

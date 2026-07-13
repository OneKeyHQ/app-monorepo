/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

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
      'seg:one': {
        id: 1,
        key: 'seg:one',
        runtime: 'shared',
        relativePath: 'segments/one.seg.hbc',
        sha256: 'aaa',
        dependsOn: [],
      },
      'seg:two': {
        id: 2,
        key: 'seg:two',
        runtime: 'shared',
        relativePath: 'segments/two.seg.hbc',
        sha256: 'bbb',
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
});

function getModules() {
  return {
    loader: require('../installProdBundleLoader'),
    health: require('../healthCheck'),
  };
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

describe('splitBundle healthCheck', () => {
  it('reports a healthy snapshot with loaded + eager-fallback counts', async () => {
    const { loader, health } = getModules();
    loader.installProdBundleLoader(createMockNativeLoader());
    await loader.loadSegment('seg:one');
    await loader.loadSegment('/packages/foo/index.bundle?modulesOnly=true');

    const report = health.buildSplitBundleHealthReport();
    expect(report.ok).toBe(true);
    expect(report.runtime).toBe('main');
    expect(report.manifestSize).toBe(2);
    expect(report.loadedCount).toBe(1);
    expect(report.eagerFallbackCount).toBe(1);
    expect(report.eagerFallbackSample).toEqual([
      '/packages/foo/index.bundle?modulesOnly=true',
    ]);
    expect(report.issues).toEqual([]);
  });

  it('flags an empty manifest as a structural issue', () => {
    (globalThis as any).__SEGMENT_MANIFEST__ = { segments: {} };
    const { health } = getModules();
    const report = health.buildSplitBundleHealthReport();
    expect(report.ok).toBe(false);
    expect(report.issues).toContain('segment manifest is empty');
  });

  it('flags an unexpected runtime kind', () => {
    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'something-else';
    const { health } = getModules();
    const report = health.buildSplitBundleHealthReport();
    expect(report.ok).toBe(false);
    expect(
      report.issues.some((issue: string) =>
        issue.includes('unexpected runtime kind'),
      ),
    ).toBe(true);
  });

  it('caps the eager-fallback sample at 5 keys', async () => {
    const { loader, health } = getModules();
    loader.installProdBundleLoader(createMockNativeLoader());
    for (let i = 0; i < 10; i += 1) {
      await loader.loadSegment(`/pkg/${i}.bundle?modulesOnly=true`);
    }
    const report = health.buildSplitBundleHealthReport();
    expect(report.eagerFallbackCount).toBe(10);
    expect(report.eagerFallbackSample).toHaveLength(5);
  });

  it('reportSplitBundleHealth writes a diagnostic log line', async () => {
    const { loader, health } = getModules();
    loader.installProdBundleLoader(createMockNativeLoader());
    await loader.loadSegment('seg:one');

    health.reportSplitBundleHealth();

    const lines = mockNativeLoggerWrite.mock.calls.map(([, msg]) =>
      String(msg),
    );
    const healthLines = lines.filter((line) =>
      line.startsWith('[SplitBundleHealth]'),
    );
    expect(healthLines).toHaveLength(1);
    expect(healthLines[0]).toMatch(/runtime=main/);
    expect(healthLines[0]).toMatch(/manifestSize=2/);
    expect(healthLines[0]).toMatch(/loadedCount=1/);
  });

  it('reportSplitBundleHealth never throws even if the logger is broken', () => {
    const {
      OneKeyLocalError,
    } = require('@onekeyhq/shared/src/errors/errors/localError');
    mockNativeLoggerWrite.mockImplementation(() => {
      throw new OneKeyLocalError('logger dead');
    });
    const { health } = getModules();
    expect(() => health.reportSplitBundleHealth()).not.toThrow();
  });

  it('scheduleSplitBundleHealthCheck only fires once per process', () => {
    jest.useFakeTimers();
    const { health } = getModules();
    health.__resetSplitBundleHealthCheckForTests();
    health.scheduleSplitBundleHealthCheck();
    health.scheduleSplitBundleHealthCheck();
    health.scheduleSplitBundleHealthCheck();
    jest.runAllTimers();
    const healthLines = mockNativeLoggerWrite.mock.calls.filter(([, msg]) =>
      String(msg).startsWith('[SplitBundleHealth]'),
    );
    expect(healthLines).toHaveLength(1);
    jest.useRealTimers();
  });
});

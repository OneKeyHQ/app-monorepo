/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
type IManifestGlobal = typeof globalThis & {
  __SEGMENT_MANIFEST__?: { segments: Record<string, any> };
};

beforeEach(() => {
  jest.resetModules();
  delete (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__;
  delete (globalThis as any).__ONEKEY_RUNTIME_KIND__;
});

describe('segmentManifest', () => {
  it('returns empty manifest when __SEGMENT_MANIFEST__ is undefined', () => {
    const { getSegmentManifest } = require('../segmentManifest');
    expect(getSegmentManifest()).toEqual({ segments: {} });
  });

  it('returns manifest from global', () => {
    const manifest = {
      segments: {
        'seg:test': {
          id: 1,
          key: 'seg:test',
          runtime: 'shared',
          relativePath: 'segments/test.seg.hbc',
          sha256: 'abc',
          dependsOn: [],
        },
      },
    };
    (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__ = manifest;
    const { getSegmentManifest } = require('../segmentManifest');
    expect(getSegmentManifest()).toBe(manifest);
  });

  it('caches manifest on first read', () => {
    const { getSegmentManifest } = require('../segmentManifest');
    const m1 = getSegmentManifest();
    const m2 = getSegmentManifest();
    expect(m1).toBe(m2); // same reference
  });

  it('getSegmentEntry returns entry by key', () => {
    const entry = {
      id: 1,
      key: 'seg:test',
      runtime: 'shared' as const,
      relativePath: 'x',
      sha256: 'y',
      dependsOn: [],
    };
    (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__ = {
      segments: { 'seg:test': entry },
    };
    const { getSegmentEntry } = require('../segmentManifest');
    expect(getSegmentEntry('seg:test')).toBe(entry);
    expect(getSegmentEntry('seg:nonexistent')).toBeUndefined();
  });

  it('getSegmentEntry resolves runtime-specific variants', () => {
    const mainEntry = {
      id: 1,
      key: 'seg:test',
      runtime: 'main' as const,
      relativePath: 'segments/test.seg.hbc',
      sha256: 'main',
      dependsOn: [],
    };
    const backgroundEntry = {
      id: 1,
      key: 'seg:test',
      runtime: 'background' as const,
      relativePath: 'segments-background/test.seg.hbc',
      sha256: 'background',
      dependsOn: [],
    };
    (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__ = {
      segments: {
        'seg:test': {
          key: 'seg:test',
          variants: {
            main: mainEntry,
            background: backgroundEntry,
          },
        },
      },
    };

    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'main';
    const { getSegmentEntry } = require('../segmentManifest');
    expect(getSegmentEntry('seg:test')).toBe(mainEntry);

    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'background';
    expect(getSegmentEntry('seg:test')).toBe(backgroundEntry);
  });

  it('prefers runtime-specific variant before shared fallback', () => {
    const sharedEntry = {
      id: 2,
      key: 'seg:test',
      runtime: 'shared' as const,
      relativePath: 'segments/test.seg.hbc',
      sha256: 'shared',
      dependsOn: [],
    };
    const backgroundEntry = {
      id: 2,
      key: 'seg:test',
      runtime: 'background' as const,
      relativePath: 'segments-background/test.seg.hbc',
      sha256: 'background',
      dependsOn: [],
    };
    (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__ = {
      segments: {
        'seg:test': {
          key: 'seg:test',
          variants: {
            shared: sharedEntry,
            background: backgroundEntry,
          },
        },
      },
    };

    const { getSegmentEntry } = require('../segmentManifest');

    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'background';
    expect(getSegmentEntry('seg:test')).toBe(backgroundEntry);

    (globalThis as any).__ONEKEY_RUNTIME_KIND__ = 'main';
    expect(getSegmentEntry('seg:test')).toBe(sharedEntry);
  });

  it('getSegmentCount returns correct count', () => {
    (globalThis as IManifestGlobal).__SEGMENT_MANIFEST__ = {
      segments: { a: {} as any, b: {} as any },
    };
    const { getSegmentCount } = require('../segmentManifest');
    expect(getSegmentCount()).toBe(2);
  });
});

describe('isSegmentAllowedInRuntime', () => {
  it('shared allows both runtimes', () => {
    const { isSegmentAllowedInRuntime } = require('../segmentManifest');
    expect(isSegmentAllowedInRuntime('shared', 'main')).toBe(true);
    expect(isSegmentAllowedInRuntime('shared', 'background')).toBe(true);
  });

  it('main only allows main runtime', () => {
    const { isSegmentAllowedInRuntime } = require('../segmentManifest');
    expect(isSegmentAllowedInRuntime('main', 'main')).toBe(true);
    expect(isSegmentAllowedInRuntime('main', 'background')).toBe(false);
  });

  it('background only allows background runtime', () => {
    const { isSegmentAllowedInRuntime } = require('../segmentManifest');
    expect(isSegmentAllowedInRuntime('background', 'background')).toBe(true);
    expect(isSegmentAllowedInRuntime('background', 'main')).toBe(false);
  });
});

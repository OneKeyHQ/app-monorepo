import {
  type CheckDeps,
  type MinimumReleaseAgeConfig,
  type NpmPackageMeta,
  type PackageRef,
  checkPackageAge,
  matchesAllowlist,
  parseConfig,
} from '../checkPackageAge';

// --- parseConfig ---

describe('parseConfig', () => {
  test('returns defaults when no minimumReleaseAge field exists', () => {
    const config = parseConfig({});
    expect(config).toEqual({
      days: 7,
      allowlist: [],
      blockOnFailure: true,
      registryUrl: 'https://registry.npmjs.org',
    });
  });

  test('returns defaults when minimumReleaseAge is not an object', () => {
    const config = parseConfig({ minimumReleaseAge: 'invalid' });
    expect(config).toEqual({
      days: 7,
      allowlist: [],
      blockOnFailure: true,
      registryUrl: 'https://registry.npmjs.org',
    });
  });

  test('merges partial config with defaults', () => {
    const config = parseConfig({
      minimumReleaseAge: { days: 14 },
    });
    expect(config.days).toBe(14);
    expect(config.allowlist).toEqual([]);
    expect(config.blockOnFailure).toBe(true);
    expect(config.registryUrl).toBe('https://registry.npmjs.org');
  });

  test('respects all provided fields', () => {
    const config = parseConfig({
      minimumReleaseAge: {
        days: 30,
        allowlist: ['@onekeyhq/*', 'lodash'],
        blockOnFailure: false,
        registryUrl: 'https://custom.registry.example.com',
      },
    });
    expect(config).toEqual({
      days: 30,
      allowlist: ['@onekeyhq/*', 'lodash'],
      blockOnFailure: false,
      registryUrl: 'https://custom.registry.example.com',
    });
  });

  test('ignores invalid field types and falls back to defaults', () => {
    const config = parseConfig({
      minimumReleaseAge: {
        days: 'not-a-number',
        allowlist: 'not-an-array',
        blockOnFailure: 'not-a-boolean',
        registryUrl: 123,
      },
    });
    expect(config).toEqual({
      days: 7,
      allowlist: [],
      blockOnFailure: true,
      registryUrl: 'https://registry.npmjs.org',
    });
  });
});

// --- matchesAllowlist ---

describe('matchesAllowlist', () => {
  test('returns false for empty allowlist', () => {
    expect(matchesAllowlist('lodash', [])).toBe(false);
  });

  test('matches exact package names', () => {
    expect(matchesAllowlist('lodash', ['lodash'])).toBe(true);
    expect(matchesAllowlist('underscore', ['lodash'])).toBe(false);
  });

  test('matches scoped package glob patterns', () => {
    const allowlist = ['@onekeyhq/*'];
    expect(matchesAllowlist('@onekeyhq/components', allowlist)).toBe(true);
    expect(matchesAllowlist('@onekeyhq/shared', allowlist)).toBe(true);
    expect(matchesAllowlist('@babel/core', allowlist)).toBe(false);
  });

  test('matches multiple patterns', () => {
    const allowlist = ['@onekeyhq/*', '@onekeyfe/*', 'lodash'];
    expect(matchesAllowlist('@onekeyhq/kit', allowlist)).toBe(true);
    expect(matchesAllowlist('@onekeyfe/hd-core', allowlist)).toBe(true);
    expect(matchesAllowlist('lodash', allowlist)).toBe(true);
    expect(matchesAllowlist('react', allowlist)).toBe(false);
  });

  test('does not match partial names without glob', () => {
    expect(matchesAllowlist('lodash-es', ['lodash'])).toBe(false);
  });
});

// --- checkPackageAge ---

describe('checkPackageAge', () => {
  const baseConfig: MinimumReleaseAgeConfig = {
    days: 7,
    allowlist: [],
    blockOnFailure: true,
    registryUrl: 'https://registry.npmjs.org',
  };

  function makeDeps(overrides?: Partial<CheckDeps>): CheckDeps {
    return {
      now: new Date('2025-06-15T00:00:00Z'),
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({
          time: {
            '1.0.0': '2025-06-01T00:00:00Z',
          },
        }),
      ...overrides,
    };
  }

  test('returns ok when package is old enough', async () => {
    const ref: PackageRef = { name: 'lodash', version: '1.0.0' };
    const deps = makeDeps({
      now: new Date('2025-06-15T00:00:00Z'),
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({
          time: { '1.0.0': '2025-06-01T00:00:00Z' },
        }),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('ok');
    expect(result.ageDays).toBe(14);
  });

  test('returns too_young when package is newer than threshold', async () => {
    const ref: PackageRef = { name: 'new-pkg', version: '0.1.0' };
    const deps = makeDeps({
      now: new Date('2025-06-15T00:00:00Z'),
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({
          time: { '0.1.0': '2025-06-12T00:00:00Z' },
        }),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('too_young');
    expect(result.ageDays).toBe(3);
  });

  test('returns skipped for allowlisted packages', async () => {
    const ref: PackageRef = {
      name: '@onekeyhq/components',
      version: '1.0.0',
    };
    const config = { ...baseConfig, allowlist: ['@onekeyhq/*'] };
    const fetchMeta = jest.fn<Promise<NpmPackageMeta>, [string, string]>();
    const deps = makeDeps({ fetchMeta });

    const result = await checkPackageAge(ref, config, deps);
    expect(result.status).toBe('skipped');
    expect(fetchMeta).not.toHaveBeenCalled();
  });

  test('returns error when no time metadata exists', async () => {
    const ref: PackageRef = { name: 'no-time-pkg', version: '1.0.0' };
    const deps = makeDeps({
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({}),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('error');
    expect(result.error).toContain('No publish-time metadata');
  });

  test('returns error when version not found in time metadata', async () => {
    const ref: PackageRef = { name: 'some-pkg', version: '2.0.0' };
    const deps = makeDeps({
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({
          time: { '1.0.0': '2025-01-01T00:00:00Z' },
        }),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('error');
    expect(result.error).toContain('No publish time found for some-pkg@2.0.0');
  });

  test('returns error when fetch throws', async () => {
    const ref: PackageRef = { name: 'fail-pkg', version: '1.0.0' };
    const deps = makeDeps({
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockRejectedValue(new Error('Network timeout')),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('error');
    expect(result.error).toBe('Network timeout');
  });

  test('handles exact threshold boundary (exactly N days old)', async () => {
    const ref: PackageRef = { name: 'boundary-pkg', version: '1.0.0' };
    const deps = makeDeps({
      now: new Date('2025-06-08T00:00:00Z'),
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({
          time: { '1.0.0': '2025-06-01T00:00:00Z' },
        }),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('ok');
    expect(result.ageDays).toBe(7);
  });

  test('returns too_young at threshold minus one day', async () => {
    const ref: PackageRef = { name: 'young-pkg', version: '1.0.0' };
    const deps = makeDeps({
      now: new Date('2025-06-07T00:00:00Z'),
      fetchMeta: jest
        .fn<Promise<NpmPackageMeta>, [string, string]>()
        .mockResolvedValue({
          time: { '1.0.0': '2025-06-01T00:00:00Z' },
        }),
    });

    const result = await checkPackageAge(ref, baseConfig, deps);
    expect(result.status).toBe('too_young');
    expect(result.ageDays).toBe(6);
  });

  test('calls fetchMeta with correct registry URL', async () => {
    const ref: PackageRef = { name: 'test-pkg', version: '1.0.0' };
    const customConfig = {
      ...baseConfig,
      registryUrl: 'https://custom.registry.example.com',
    };
    const fetchMeta = jest
      .fn<Promise<NpmPackageMeta>, [string, string]>()
      .mockResolvedValue({
        time: { '1.0.0': '2025-01-01T00:00:00Z' },
      });
    const deps = makeDeps({ fetchMeta });

    await checkPackageAge(ref, customConfig, deps);
    expect(fetchMeta).toHaveBeenCalledWith(
      'test-pkg',
      'https://custom.registry.example.com',
    );
  });
});

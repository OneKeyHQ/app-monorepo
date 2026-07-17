import { OneKeyLocalError } from '../errors';
import {
  CDN_SIGNER_ADDRESS,
  DEFAULT_IP_TABLE_CONFIG,
} from '../request/constants/ipTableDefaults';

import {
  computeIpTableConfigHash,
  isIpTableConfigRegression,
  isValidIpTableRemoteConfigShape,
  mergeIpTableConfigs,
  verifyIpTableConfigSignature,
  verifyIpTableConfigSignatureDetailed,
} from './ipTableUtils';

import type { IIpTableRemoteConfig } from '../request/types/ipTable';

describe('verifyIpTableConfigSignature', () => {
  test('returns false when signature is missing', async () => {
    const configWithoutSignature = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:30:54.066Z',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.2.3.4', provider: 'test', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    } as unknown as IIpTableRemoteConfig;

    await expect(
      verifyIpTableConfigSignature(configWithoutSignature),
    ).resolves.toBe(false);
  });

  test('returns false when signature is invalid', async () => {
    const configWithInvalidSignature: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:30:54.066Z',
      signature: '0xinvalidsignature',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.2.3.4', provider: 'test', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    await expect(
      verifyIpTableConfigSignature(configWithInvalidSignature),
    ).resolves.toBe(false);
  });

  test('returns false when signer address does not match', async () => {
    // This signature is from a different signer address
    // User will replace this with real signature that intentionally comes from wrong signer
    const configWithWrongSigner: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:30:54.066Z',
      signature:
        '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.2.3.4', provider: 'test', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    await expect(
      verifyIpTableConfigSignature(configWithWrongSigner),
    ).resolves.toBe(false);
  });

  test('returns true for valid signature from correct signer', async () => {
    const validConfig: IIpTableRemoteConfig = {
      'domains': {
        'onekeycn.com': {
          'endpoints': [
            {
              'ip': '104.18.20.233',
              'provider': 'cloudflare',
              'region': 'GLOBAL',
              'weight': 100,
            },
          ],
        },
      },
      'generated_at': '2025-11-07T07:27:37.338Z',
      'signature':
        '0x66708c60c6a1aae2d34d75c6f42662208279f2dc13e1370a0b52fdfe783fc6d56369708a8a5a98f0e3eda900d537de0cbb7e808bbaf1bef267f350843a761b5d1c',
      'ttl_sec': 86_400,
      'version': 1,
    };
    await expect(verifyIpTableConfigSignature(validConfig)).resolves.toBe(true);
  });

  test('returns true for build-in config', async () => {
    await expect(
      verifyIpTableConfigSignature(DEFAULT_IP_TABLE_CONFIG),
    ).resolves.toBe(true);
  });

  test('handles malformed signature gracefully', async () => {
    const configWithMalformedSignature: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:30:54.066Z',
      signature: 'not-a-valid-hex-string',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.2.3.4', provider: 'test', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    await expect(
      verifyIpTableConfigSignature(configWithMalformedSignature),
    ).resolves.toBe(false);
  });

  test('handles empty signature string', async () => {
    const configWithEmptySignature: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:30:54.066Z',
      signature: '',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.2.3.4', provider: 'test', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    await expect(
      verifyIpTableConfigSignature(configWithEmptySignature),
    ).resolves.toBe(false);
  });
});

describe('verifyIpTableConfigSignatureDetailed', () => {
  test('builtin config verifies and recovers the CDN signer', async () => {
    const result = await verifyIpTableConfigSignatureDetailed(
      DEFAULT_IP_TABLE_CONFIG,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.recoveredAddress.toLowerCase()).toBe(
        CDN_SIGNER_ADDRESS.toLowerCase(),
      );
    }
  });

  test('extra unknown top-level fields do not break verification (allowlist canonicalization)', async () => {
    // The 2026-07 CDN pipeline may attach metadata fields the signer never
    // covered. Verification must canonicalize only the signed fields.
    const configWithExtras = {
      ...DEFAULT_IP_TABLE_CONFIG,
      updated_by: 'cdn-pipeline',
      etag: 'abc123',
    } as unknown as IIpTableRemoteConfig;

    const result = await verifyIpTableConfigSignatureDetailed(configWithExtras);
    expect(result.ok).toBe(true);
  });

  test('missing signature -> reason missing_signature', async () => {
    const config = {
      ...DEFAULT_IP_TABLE_CONFIG,
      signature: '',
    } as IIpTableRemoteConfig;
    const result = await verifyIpTableConfigSignatureDetailed(config);
    expect(result).toMatchObject({ ok: false, reason: 'missing_signature' });
  });

  test('tampered domains -> reason signer_mismatch', async () => {
    const tampered: IIpTableRemoteConfig = {
      ...DEFAULT_IP_TABLE_CONFIG,
      domains: {
        ...DEFAULT_IP_TABLE_CONFIG.domains,
        'evil.com': {
          endpoints: [
            { ip: '6.6.6.6', provider: 'evil', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };
    const result = await verifyIpTableConfigSignatureDetailed(tampered);
    expect(result).toMatchObject({ ok: false, reason: 'signer_mismatch' });
  });

  test('garbage signature -> reason malformed_signature', async () => {
    const config: IIpTableRemoteConfig = {
      ...DEFAULT_IP_TABLE_CONFIG,
      signature: 'not-a-valid-hex-string',
    };
    const result = await verifyIpTableConfigSignatureDetailed(config);
    expect(result).toMatchObject({ ok: false, reason: 'malformed_signature' });
  });

  test('verifier import failure -> reason verifier_load_failed (split-bundle incident)', async () => {
    // Reproduces the 2026-07-16 incident: the background runtime rejected
    // loading the @ethersproject segment; verification must surface a
    // packaging problem instead of pretending the signature is invalid.
    await jest.isolateModulesAsync(async () => {
      jest.doMock('@ethersproject/wallet', () => {
        throw new OneKeyLocalError(
          "Segment runtime 'main' not allowed in 'background' runtime",
        );
      });
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const isolated =
        require('./ipTableUtils') as typeof import('./ipTableUtils');
      const result = await isolated.verifyIpTableConfigSignatureDetailed(
        DEFAULT_IP_TABLE_CONFIG,
      );
      expect(result).toMatchObject({
        ok: false,
        reason: 'verifier_load_failed',
      });
      jest.dontMock('@ethersproject/wallet');
    });
  });
});

describe('isValidIpTableRemoteConfigShape', () => {
  test('accepts the builtin config', () => {
    expect(isValidIpTableRemoteConfigShape(DEFAULT_IP_TABLE_CONFIG)).toBe(true);
  });

  test('rejects primitives and null', () => {
    expect(isValidIpTableRemoteConfigShape(null)).toBe(false);
    expect(isValidIpTableRemoteConfigShape(undefined)).toBe(false);
    expect(isValidIpTableRemoteConfigShape('<html>oops</html>')).toBe(false);
    expect(isValidIpTableRemoteConfigShape(42)).toBe(false);
  });

  test('rejects wrong field types', () => {
    expect(
      isValidIpTableRemoteConfigShape({
        ...DEFAULT_IP_TABLE_CONFIG,
        version: '1',
      }),
    ).toBe(false);
    expect(
      isValidIpTableRemoteConfigShape({
        ...DEFAULT_IP_TABLE_CONFIG,
        ttl_sec: '86400',
      }),
    ).toBe(false);
    expect(
      isValidIpTableRemoteConfigShape({
        ...DEFAULT_IP_TABLE_CONFIG,
        domains: null,
      }),
    ).toBe(false);
  });

  test('rejects malformed endpoints', () => {
    expect(
      isValidIpTableRemoteConfigShape({
        ...DEFAULT_IP_TABLE_CONFIG,
        domains: { 'example.com': { endpoints: 'not-an-array' } },
      }),
    ).toBe(false);
    expect(
      isValidIpTableRemoteConfigShape({
        ...DEFAULT_IP_TABLE_CONFIG,
        domains: { 'example.com': { endpoints: [{ ip: 123 }] } },
      }),
    ).toBe(false);
  });
});

describe('isIpTableConfigRegression', () => {
  function makeConfig(version: number, generatedAt: string) {
    return {
      ...DEFAULT_IP_TABLE_CONFIG,
      version,
      generated_at: generatedAt,
    };
  }

  test('without lastVerified, the active config generated_at anchors same-version comparison', () => {
    // Pre-upgrade installs have no runtime.lastVerified; a same-version but
    // older signed config must still be rejected against the active config.
    const result = isIpTableConfigRegression({
      remoteConfig: makeConfig(1, '2025-10-01T00:00:00.000Z'),
      localConfig: makeConfig(1, '2025-11-06T08:30:54.066Z'),
      lastVerified: undefined,
    });
    expect(result).toEqual({
      regression: true,
      reason: 'generated_at_regression',
    });
  });

  test('same version with newer generated_at is accepted', () => {
    const result = isIpTableConfigRegression({
      remoteConfig: makeConfig(1, '2026-01-01T00:00:00.000Z'),
      localConfig: makeConfig(1, '2025-11-06T08:30:54.066Z'),
    });
    expect(result).toEqual({ regression: false });
  });

  test('lower version is always a regression', () => {
    const result = isIpTableConfigRegression({
      remoteConfig: makeConfig(1, '2026-01-01T00:00:00.000Z'),
      localConfig: makeConfig(2, '2025-11-06T08:30:54.066Z'),
    });
    expect(result).toEqual({ regression: true, reason: 'version_regression' });
  });

  test('unparseable remote generated_at is rejected', () => {
    const result = isIpTableConfigRegression({
      remoteConfig: makeConfig(2, 'not-a-date'),
      localConfig: makeConfig(1, '2025-11-06T08:30:54.066Z'),
    });
    expect(result).toEqual({
      regression: true,
      reason: 'unparseable_generated_at',
    });
  });

  test('lastVerified anchor takes precedence over the active config', () => {
    const result = isIpTableConfigRegression({
      remoteConfig: makeConfig(1, '2025-12-01T00:00:00.000Z'),
      localConfig: makeConfig(1, '2025-11-06T08:30:54.066Z'),
      lastVerified: { version: 1, generatedAt: '2026-01-01T00:00:00.000Z' },
    });
    expect(result).toEqual({
      regression: true,
      reason: 'generated_at_regression',
    });
  });

  test('higher version wins regardless of generated_at', () => {
    const result = isIpTableConfigRegression({
      remoteConfig: makeConfig(3, '2025-01-01T00:00:00.000Z'),
      localConfig: makeConfig(2, '2025-11-06T08:30:54.066Z'),
      lastVerified: { version: 2, generatedAt: '2025-11-06T08:30:54.066Z' },
    });
    expect(result).toEqual({ regression: false });
  });
});

describe('computeIpTableConfigHash', () => {
  test('is stable and ignores unsigned extra fields', () => {
    const base = computeIpTableConfigHash(DEFAULT_IP_TABLE_CONFIG);
    const withExtras = computeIpTableConfigHash({
      ...DEFAULT_IP_TABLE_CONFIG,
      updated_by: 'cdn-pipeline',
    } as unknown as IIpTableRemoteConfig);
    expect(base).toMatch(/^[0-9a-f]{8}$/);
    expect(withExtras).toBe(base);
  });

  test('changes when signed content changes', () => {
    const base = computeIpTableConfigHash(DEFAULT_IP_TABLE_CONFIG);
    const changed = computeIpTableConfigHash({
      ...DEFAULT_IP_TABLE_CONFIG,
      version: 2,
    });
    expect(changed).not.toBe(base);
  });
});

describe('mergeIpTableConfigs', () => {
  test('merges new domains from remote config', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'local.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'local', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'remote.com': {
          endpoints: [
            { ip: '2.2.2.2', provider: 'remote', region: 'CN', weight: 50 },
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(merged.domains['local.com']).toBeDefined();
    expect(merged.domains['remote.com']).toBeDefined();
    expect(merged.domains['local.com'].endpoints).toHaveLength(1);
    expect(merged.domains['remote.com'].endpoints).toHaveLength(1);
  });

  test('merges new endpoints for existing domains', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'local', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '2.2.2.2', provider: 'remote', region: 'CN', weight: 50 },
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(merged.domains['example.com'].endpoints).toHaveLength(2);
    expect(merged.domains['example.com'].endpoints[0].ip).toBe('1.1.1.1');
    expect(merged.domains['example.com'].endpoints[1].ip).toBe('2.2.2.2');
  });

  test('deduplicates endpoints with same IP', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'local', region: 'GLOBAL', weight: 100 },
            { ip: '2.2.2.2', provider: 'local2', region: 'GLOBAL', weight: 80 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'example.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'remote', region: 'CN', weight: 50 }, // Duplicate IP
            { ip: '3.3.3.3', provider: 'remote2', region: 'CN', weight: 60 }, // New IP
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    // Should have 3 endpoints: 1.1.1.1 (from local), 2.2.2.2 (from local), 3.3.3.3 (from remote)
    expect(merged.domains['example.com'].endpoints).toHaveLength(3);

    const ips = merged.domains['example.com'].endpoints.map((ep) => ep.ip);
    expect(ips).toEqual(['1.1.1.1', '2.2.2.2', '3.3.3.3']);
  });

  test('uses remote config metadata (version, ttl, generated_at, signature)', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'local.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'local', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'remote.com': {
          endpoints: [
            { ip: '2.2.2.2', provider: 'remote', region: 'CN', weight: 50 },
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(merged.version).toBe(2);
    expect(merged.ttl_sec).toBe(43_200);
    expect(merged.generated_at).toBe('2025-11-06T12:00:00.000Z');
    expect(merged.signature).toBe('0xremote');
  });

  test('preserves all local endpoints when merging', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'example.com': {
          endpoints: [
            {
              ip: '1.1.1.1',
              provider: 'provider1',
              region: 'GLOBAL',
              weight: 100,
            },
            {
              ip: '2.2.2.2',
              provider: 'provider2',
              region: 'GLOBAL',
              weight: 90,
            },
            { ip: '3.3.3.3', provider: 'provider3', region: 'CN', weight: 80 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'example.com': {
          endpoints: [
            {
              ip: '4.4.4.4',
              provider: 'provider4',
              region: 'GLOBAL',
              weight: 70,
            },
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(merged.domains['example.com'].endpoints).toHaveLength(4);

    // Verify all local endpoints are preserved
    const ips = merged.domains['example.com'].endpoints.map((ep) => ep.ip);
    expect(ips).toContain('1.1.1.1');
    expect(ips).toContain('2.2.2.2');
    expect(ips).toContain('3.3.3.3');
    expect(ips).toContain('4.4.4.4');
  });

  test('handles empty local domains', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {},
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'remote.com': {
          endpoints: [
            {
              ip: '1.1.1.1',
              provider: 'remote',
              region: 'GLOBAL',
              weight: 100,
            },
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(merged.domains['remote.com']).toBeDefined();
    expect(merged.domains['remote.com'].endpoints).toHaveLength(1);
  });

  test('handles empty remote domains', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'local.com': {
          endpoints: [
            { ip: '1.1.1.1', provider: 'local', region: 'GLOBAL', weight: 100 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {},
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(merged.domains['local.com']).toBeDefined();
    expect(merged.domains['local.com'].endpoints).toHaveLength(1);
  });

  test('handles complex merge scenario with multiple domains', () => {
    const localConfig: IIpTableRemoteConfig = {
      version: 1,
      ttl_sec: 86_400,
      generated_at: '2025-11-06T08:00:00.000Z',
      signature: '0xlocal',
      domains: {
        'onekeycn.com': {
          endpoints: [
            {
              ip: '104.18.20.233',
              provider: 'cloudflare',
              region: 'GLOBAL',
              weight: 100,
            },
            {
              ip: '216.19.4.106',
              provider: 'volcengine',
              region: 'CN',
              weight: 100,
            },
          ],
        },
        'localonly.com': {
          endpoints: [
            { ip: '5.5.5.5', provider: 'local', region: 'GLOBAL', weight: 50 },
          ],
        },
      },
    };

    const remoteConfig: IIpTableRemoteConfig = {
      version: 2,
      ttl_sec: 43_200,
      generated_at: '2025-11-06T12:00:00.000Z',
      signature: '0xremote',
      domains: {
        'onekeycn.com': {
          endpoints: [
            {
              ip: '104.18.20.233',
              provider: 'cloudflare',
              region: 'GLOBAL',
              weight: 100,
            }, // Duplicate
            { ip: '6.6.6.6', provider: 'newcdn', region: 'CN', weight: 90 }, // New
          ],
        },
        'remoteonly.com': {
          endpoints: [
            { ip: '7.7.7.7', provider: 'remote', region: 'GLOBAL', weight: 80 },
          ],
        },
      },
    };

    const merged = mergeIpTableConfigs(localConfig, remoteConfig);

    expect(Object.keys(merged.domains)).toHaveLength(3);

    expect(merged.domains['onekeycn.com'].endpoints).toHaveLength(3);
    const onekeyIps = merged.domains['onekeycn.com'].endpoints.map(
      (ep) => ep.ip,
    );
    expect(onekeyIps).toEqual(['104.18.20.233', '216.19.4.106', '6.6.6.6']);

    expect(merged.domains['localonly.com'].endpoints).toHaveLength(1);
    expect(merged.domains['localonly.com'].endpoints[0].ip).toBe('5.5.5.5');

    expect(merged.domains['remoteonly.com'].endpoints).toHaveLength(1);
    expect(merged.domains['remoteonly.com'].endpoints[0].ip).toBe('7.7.7.7');

    // Metadata should be from remote
    expect(merged.version).toBe(2);
    expect(merged.ttl_sec).toBe(43_200);
    expect(merged.signature).toBe('0xremote');
  });
});

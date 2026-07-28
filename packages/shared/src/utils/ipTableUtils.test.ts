import { OneKeyLocalError } from '../errors';
import {
  CDN_SIGNER_ADDRESS,
  DEFAULT_IP_TABLE_CONFIG,
} from '../request/constants/ipTableDefaults';

import {
  computeIpTableConfigHash,
  isIpTableConfigRegression,
  isValidIpTableRemoteConfigShape,
  pruneIpTableRuntimeSelections,
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

describe('pruneIpTableRuntimeSelections', () => {
  const config: IIpTableRemoteConfig = {
    version: 2,
    ttl_sec: 86_400,
    generated_at: '2026-07-17T00:00:00.000Z',
    signature: '0xnew',
    domains: {
      'onekeycn.com': {
        endpoints: [
          { ip: '1.1.1.1', provider: 'a', region: 'GLOBAL', weight: 100 },
          { ip: '2.2.2.2', provider: 'b', region: 'CN', weight: 100 },
        ],
      },
    },
  };

  test('keeps selections and last-best ips the config still endorses', () => {
    const result = pruneIpTableRuntimeSelections({
      config,
      selections: { 'onekeycn.com': '1.1.1.1' },
      lastBestIp: { 'onekeycn.com': '2.2.2.2' },
    });
    expect(result.selections).toEqual({ 'onekeycn.com': '1.1.1.1' });
    expect(result.lastBestIp).toEqual({ 'onekeycn.com': '2.2.2.2' });
    expect(result.prunedCount).toBe(0);
  });

  test('drops selections pointing at revoked endpoints', () => {
    // 9.9.9.9 was removed from the signed config (revoked / rotated out):
    // neither the selection nor the last-best ip may keep routing to it.
    const result = pruneIpTableRuntimeSelections({
      config,
      selections: { 'onekeycn.com': '9.9.9.9' },
      lastBestIp: { 'onekeycn.com': '9.9.9.9' },
    });
    expect(result.selections).toEqual({});
    expect(result.lastBestIp).toEqual({});
    expect(result.prunedCount).toBe(2);
  });

  test('always keeps the explicit domain choice (empty string)', () => {
    const result = pruneIpTableRuntimeSelections({
      config,
      selections: { 'onekeycn.com': '' },
    });
    expect(result.selections).toEqual({ 'onekeycn.com': '' });
    expect(result.prunedCount).toBe(0);
  });

  test('drops state for domains the config no longer covers', () => {
    const result = pruneIpTableRuntimeSelections({
      config,
      selections: { 'gone.com': '1.1.1.1' },
      lastBestIp: { 'gone.com': '1.1.1.1' },
    });
    expect(result.selections).toEqual({});
    expect(result.lastBestIp).toEqual({});
    expect(result.prunedCount).toBe(2);
  });

  test('handles missing runtime maps', () => {
    const result = pruneIpTableRuntimeSelections({ config });
    expect(result.selections).toEqual({});
    expect(result.lastBestIp).toEqual({});
    expect(result.prunedCount).toBe(0);
  });
});

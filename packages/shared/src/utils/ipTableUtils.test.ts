import { DEFAULT_IP_TABLE_CONFIG } from '../request/constants/ipTableDefaults';

import {
  mergeIpTableConfigs,
  verifyIpTableConfigSignature,
} from './ipTableUtils';

import type { IIpTableRemoteConfig } from '../request/types/ipTable';

describe('verifyIpTableConfigSignature', () => {
  test('returns false when signature is missing', () => {
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

    expect(verifyIpTableConfigSignature(configWithoutSignature)).toBe(false);
  });

  test('returns false when signature is invalid', () => {
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

    expect(verifyIpTableConfigSignature(configWithInvalidSignature)).toBe(
      false,
    );
  });

  test('returns false when signer address does not match', () => {
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

    expect(verifyIpTableConfigSignature(configWithWrongSigner)).toBe(false);
  });

  test('returns true for valid signature from correct signer', () => {
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
    expect(verifyIpTableConfigSignature(validConfig)).toBe(true);
  });

  test('returns true for build-in config', () => {
    expect(verifyIpTableConfigSignature(DEFAULT_IP_TABLE_CONFIG)).toBe(true);
  });

  test('handles malformed signature gracefully', () => {
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

    expect(verifyIpTableConfigSignature(configWithMalformedSignature)).toBe(
      false,
    );
  });

  test('handles empty signature string', () => {
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

    expect(verifyIpTableConfigSignature(configWithEmptySignature)).toBe(false);
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

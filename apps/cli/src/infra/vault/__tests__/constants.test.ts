import {
  ABSOLUTE_MAX_TTL_MS,
  KEY_API_TIMEOUT_MS,
  LOCK_TIMEOUT_MS,
  REFRESH_THRESHOLD_MS,
  REVOKE_TIMEOUT_MS,
  SLIDING_TTL_MS,
  VAULT_HKDF_INFO,
  VAULT_MAGIC,
  VAULT_SCHEMA_VERSION,
  VAULT_VERSION,
} from '../constants';

describe('vault constants', () => {
  it('uses the bounded sliding TTL values from the story', () => {
    expect(SLIDING_TTL_MS).toBe(60 * 60 * 1000);
    expect(ABSOLUTE_MAX_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(REFRESH_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });

  it('uses the required lock and revoke timeouts', () => {
    expect(LOCK_TIMEOUT_MS).toBe(5000);
    expect(KEY_API_TIMEOUT_MS).toBe(30_000);
    expect(REVOKE_TIMEOUT_MS).toBe(3000);
  });

  it('uses the required vault magic and versions', () => {
    expect(VAULT_MAGIC).toEqual(Buffer.from('OKVAULT1', 'ascii'));
    expect(VAULT_MAGIC).toHaveLength(8);
    expect(VAULT_VERSION).toBe(0x01);
    expect(VAULT_SCHEMA_VERSION).toBe(0x01);
    expect(VAULT_HKDF_INFO).toBe('bot-wallet/vault/v1');
  });
});

import { createSecureCacheKey } from '../../../core/secure-cache';
import { createVaultAddressCacheKey } from '../cache';

// Regression guard for a previously-considered hijack vector against the
// `displayAddress` fix (sender-supplied address removal).
//
// `vault.cache` is a single map shared by two writers:
//   - login-pipeline writes the receiver-derived display address under
//     `createVaultAddressCacheKey(walletId, keyId)` -> `${W}:address:${K}`.
//   - SignerSoftwareBase.resolveHdCredentialFromVault writes the decrypted
//     hdCredential under `createSecureCacheKey(walletId, keyId)` -> `${W}:${K}`.
//
// If those two helpers ever collide, the first sign() after login would
// overwrite the address slot with an encoded revealable seed; subsequent
// `onekey get-address` calls would mask-print the seed blob and a user could
// be tricked into funding a non-address. The keyId schema in
// `cli-bot-wallet-payload.ts` constrains keyId to `[A-Za-z0-9_-]{43}` (no
// colons), and the two key formats differ in length by exactly the literal
// `address:` (8 chars), so collision is structurally impossible. This test
// pins that property so a future refactor can't silently break it.
describe('vault cache key isolation', () => {
  const walletIdShapes = [
    'wallet-1',
    'hd-bot--keyless--0',
    // walletId is only length-bounded (<=128), the schema does not forbid
    // colons. Make sure colon-bearing walletIds still cannot manufacture a
    // collision.
    'foo:bar',
    'foo:address',
    'foo:address:filler',
    ':',
    '::::::',
  ];

  // Sample keyIds that satisfy the receiver-side schema regex
  // ^[A-Za-z0-9_-]{43}$ in `cli-bot-wallet-payload.ts`.
  const keyIdSamples = [
    'A'.repeat(43),
    `${'B'.repeat(21)}_${'-'.repeat(21)}`,
    'aZ09_-aZ09_-aZ09_-aZ09_-aZ09_-aZ09_-aZ09_-_',
  ];

  it('always produces different keys for the same (walletId, keyId)', () => {
    for (const walletId of walletIdShapes) {
      for (const keyId of keyIdSamples) {
        const credentialKey = createSecureCacheKey(walletId, keyId);
        const addressKey = createVaultAddressCacheKey(walletId, keyId);
        expect(credentialKey).not.toBe(addressKey);
      }
    }
  });

  it('keeps the address key exactly 8 characters longer than the credential key', () => {
    for (const walletId of walletIdShapes) {
      for (const keyId of keyIdSamples) {
        const credentialKey = createSecureCacheKey(walletId, keyId);
        const addressKey = createVaultAddressCacheKey(walletId, keyId);
        expect(addressKey.length - credentialKey.length).toBe(
          'address:'.length,
        );
      }
    }
  });

  it('embeds the literal "address:" segment only in the address-cache key', () => {
    for (const walletId of walletIdShapes) {
      for (const keyId of keyIdSamples) {
        const addressKey = createVaultAddressCacheKey(walletId, keyId);
        expect(addressKey).toBe(`${walletId}:address:${keyId}`);
        expect(createSecureCacheKey(walletId, keyId)).toBe(
          `${walletId}:${keyId}`,
        );
      }
    }
  });

  it('cannot be coerced into collision by a colon-laden walletId paired with the same keyId', () => {
    // Even a maliciously crafted walletId (e.g. ending in ":address") cannot
    // make the two helpers agree, because the address helper appends the
    // literal "address:" *after* walletId before the keyId.
    const adversarial = 'wallet:address';
    const keyId = 'C'.repeat(43);
    const credentialKey = createSecureCacheKey(adversarial, keyId);
    const addressKey = createVaultAddressCacheKey(adversarial, keyId);
    expect(credentialKey).toBe(
      'wallet:address:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    );
    expect(addressKey).toBe(
      'wallet:address:address:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    );
    expect(credentialKey).not.toBe(addressKey);
  });
});

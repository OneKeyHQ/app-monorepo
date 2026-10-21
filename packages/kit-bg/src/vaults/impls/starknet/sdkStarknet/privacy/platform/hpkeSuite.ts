// onekey: the HPKE suite used by the OHTTP transport. Upstream hardcoded it at
// internal/ohttp-client.ts:159 with the WebCrypto-backed `hpke` primitives.
// This is the browser / desktop / extension implementation; `hpkeSuite.native.ts`
// supplies pure-JS equivalents for Hermes, which has no `crypto.subtle`.
import {
  AEAD_AES_128_GCM,
  CipherSuite,
  KDF_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
} from 'hpke';

/** DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, via WebCrypto. */
export function createPlatformHpkeSuite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_X25519_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_128_GCM,
  );
}

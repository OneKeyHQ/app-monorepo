// onekey: Hermes has no `crypto.subtle`, so the WebCrypto primitives `hpke`
// exports cannot run on React Native. `@panva/hpke-noble` implements the same
// `hpke` KEM/KDF/AEAD interfaces over @noble/*, in pure JS. Same suite as
// `hpkeSuite.ts`: DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM.
import {
  AEAD_AES_128_GCM,
  KDF_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
} from '@panva/hpke-noble';
import { CipherSuite } from 'hpke';

/** DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, via @noble/*. */
export function createPlatformHpkeSuite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_X25519_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_128_GCM,
  );
}

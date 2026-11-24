// onekey: the HPKE suite used by the OHTTP transport. Uses `@panva/hpke-noble`
// (pure-JS @noble/* primitives) so Chrome 111-132 extension builds without
// WebCrypto X25519 work identically to Chrome 133+ and React Native.
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

// onekey: the HPKE suite used by the OHTTP transport on web/desktop/extension.
// Uses WebCrypto primitives from `hpke` (native uses `@panva/hpke-noble` in
// `hpkeSuite.native.ts`). Keeping WebCrypto here avoids Rspack's minifier bug
// on `@panva/hpke-noble`'s `static #isValid` private class method.
import {
  AEAD_AES_128_GCM,
  CipherSuite,
  KDF_HKDF_SHA256,
  KEM_DHKEM_X25519_HKDF_SHA256,
} from 'hpke';

import type { HttpClientContext } from 'ohttp-ts';

/** DHKEM(X25519, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, via WebCrypto. */
export function createPlatformHpkeSuite(): CipherSuite {
  return new CipherSuite(
    KEM_DHKEM_X25519_HKDF_SHA256,
    KDF_HKDF_SHA256,
    AEAD_AES_128_GCM,
  );
}

export function decapsulateOhttpResponse(
  context: HttpClientContext,
  response: Response,
): Promise<Response> {
  return context.decapsulateResponse(response);
}

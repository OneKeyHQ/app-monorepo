import { decapsulateOhttpResponse } from './hpkeSuite.native';

import type { HttpClientContext } from 'ohttp-ts';

jest.mock('hpke', () => ({ CipherSuite: jest.fn() }), { virtual: true });
jest.mock(
  '@panva/hpke-noble',
  () => ({
    AEAD_AES_128_GCM: () => undefined,
    KDF_HKDF_SHA256: () => undefined,
    KEM_DHKEM_X25519_HKDF_SHA256: () => undefined,
  }),
  { virtual: true },
);

describe('hpkeSuite.native OHTTP response decapsulation without crypto.subtle', () => {
  it('provides a scoped HMAC-SHA256 and AES-GCM subtle shim matching WebCrypto concurrently', async () => {
    const nodeSubtle = globalThis.crypto.subtle;
    const rawKey = new Uint8Array(16).map((_, i) => i + 1);
    const iv = new Uint8Array(12).map((_, i) => i + 10);
    const aad = new TextEncoder().encode('ohttp-aad');
    const plaintext1 = new TextEncoder().encode('{"id":1,"balance":"42"}');
    const plaintext2 = new TextEncoder().encode('{"id":2,"balance":"99"}');

    const webAesKey = await nodeSubtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );
    const ct1 = new Uint8Array(
      await nodeSubtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad },
        webAesKey,
        plaintext1,
      ),
    );
    const ct2 = new Uint8Array(
      await nodeSubtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad },
        webAesKey,
        plaintext2,
      ),
    );
    const webHmacKey = await nodeSubtle.importKey(
      'raw',
      rawKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expectedHmac = new Uint8Array(
      await nodeSubtle.sign('HMAC', webHmacKey, plaintext1),
    );

    const makeContext = (): HttpClientContext => ({
      decapsulateResponse: async (response: Response) => {
        const body = new Uint8Array(await response.arrayBuffer());
        const hmacKey = await globalThis.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const mac = new Uint8Array(
          await globalThis.crypto.subtle.sign('HMAC', hmacKey, plaintext1),
        );
        expect(mac).toEqual(expectedHmac);

        const aesKey = await globalThis.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
        const decrypted = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv, additionalData: aad },
          aesKey,
          body,
        );
        return new Response(decrypted, { status: 200 });
      },
    });

    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      } as Crypto,
      configurable: true,
      writable: true,
    });

    try {
      expect(globalThis.crypto.subtle).toBeUndefined();
      const [res1, res2] = await Promise.all([
        decapsulateOhttpResponse(makeContext(), new Response(ct1)),
        decapsulateOhttpResponse(makeContext(), new Response(ct2)),
      ]);
      expect(await res1.json()).toEqual({ id: 1, balance: '42' });
      expect(await res2.json()).toEqual({ id: 2, balance: '99' });
      // Ensure the temporary subtle shim is removed after decryption completes.
      expect(globalThis.crypto.subtle).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});

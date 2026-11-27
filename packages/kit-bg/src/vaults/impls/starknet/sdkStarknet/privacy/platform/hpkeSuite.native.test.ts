import { StarknetPrivacySdkPlatformError } from './errors';
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

    const ohttpHeaders = { 'content-type': 'message/ohttp-res' };

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
        decapsulateOhttpResponse(
          makeContext(),
          new Response(ct1, { headers: ohttpHeaders }),
        ),
        decapsulateOhttpResponse(
          makeContext(),
          new Response(ct2, { headers: ohttpHeaders }),
        ),
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

  it('activates the shim when crypto.subtle only provides digest (RN startup polyfill) and serializes overlapping calls', async () => {
    const nodeSubtle = globalThis.crypto.subtle;
    const rawKey = new Uint8Array(16).map((_, i) => i + 3);
    const iv = new Uint8Array(12).map((_, i) => i + 20);
    const plaintext = new TextEncoder().encode('{"ok":true}');
    const webAesKey = await nodeSubtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );
    const ct = new Uint8Array(
      await nodeSubtle.encrypt({ name: 'AES-GCM', iv }, webAesKey, plaintext),
    );

    const digestStub = jest.fn(async () => new ArrayBuffer(32));
    const partialSubtle = { digest: digestStub };
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        subtle: partialSubtle,
      } as unknown as Crypto,
      configurable: true,
      writable: true,
    });

    let releaseFirstDecrypt: (() => void) | undefined;
    let markFirstInsideDecrypt: (() => void) | undefined;
    const firstInsideDecrypt = new Promise<void>((resolve) => {
      markFirstInsideDecrypt = resolve;
    });
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirstDecrypt = resolve;
    });

    const ctx1: HttpClientContext = {
      decapsulateResponse: async (response: Response) => {
        markFirstInsideDecrypt?.();
        // Existing digest polyfill remains accessible while the shim is active.
        await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array([1]));
        await firstCanFinish;
        const body = new Uint8Array(await response.arrayBuffer());
        const key = await globalThis.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
        const pt = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          body,
        );
        return new Response(pt, { status: 200 });
      },
    };

    const ctx2: HttpClientContext = {
      decapsulateResponse: async (response: Response) => {
        const body = new Uint8Array(await response.arrayBuffer());
        const key = await globalThis.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        );
        const pt = await globalThis.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          body,
        );
        return new Response(pt, { status: 200 });
      },
    };

    try {
      const p1 = decapsulateOhttpResponse(
        ctx1,
        new Response(ct, { headers: { 'content-type': 'message/ohttp-res' } }),
      );
      await firstInsideDecrypt;

      // Start call 2 while call 1 has the temporary shim installed and delay its body read
      // until after call 1 finishes and restores crypto.subtle.
      let resolveBody2: ((buf: ArrayBuffer) => void) | undefined;
      const delayedResponse2 = {
        headers: new Headers({ 'content-type': 'message/ohttp-res' }),
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((resolve) => {
            resolveBody2 = resolve;
          }),
      } as Response;
      const p2 = decapsulateOhttpResponse(ctx2, delayedResponse2);

      releaseFirstDecrypt?.();
      const res1 = await p1;
      expect(await res1.json()).toEqual({ ok: true });

      resolveBody2?.(
        ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength),
      );
      const res2 = await p2;
      expect(await res2.json()).toEqual({ ok: true });

      expect(digestStub).toHaveBeenCalledTimes(1);
      expect(globalThis.crypto.subtle).toBe(partialSubtle);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });

  it('delegates non-OHTTP responses without buffering the body', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      } as Crypto,
      configurable: true,
      writable: true,
    });

    const arrayBufferSpy = jest.fn(async () => new ArrayBuffer(1024));
    const htmlResponse = {
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: arrayBufferSpy,
    } as unknown as Response;
    const decapsulateSpy = jest.fn(() =>
      Promise.reject(new StarknetPrivacySdkPlatformError('INVALID_MESSAGE')),
    );
    const ctx: HttpClientContext = {
      decapsulateResponse: decapsulateSpy,
    };

    try {
      await expect(decapsulateOhttpResponse(ctx, htmlResponse)).rejects.toThrow(
        'INVALID_MESSAGE',
      );
      expect(arrayBufferSpy).not.toHaveBeenCalled();
      expect(decapsulateSpy).toHaveBeenCalledWith(htmlResponse);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        value: originalCrypto,
        configurable: true,
        writable: true,
      });
    }
  });
});

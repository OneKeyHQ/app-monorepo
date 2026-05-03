import { expectTypeOf } from 'expect-type';

import { createSecureCacheKey, secureCache } from '../../../core/secure-cache';
import { SignerSoftwareBase } from '../SignerSoftwareBase';

import type { SecureCache } from '../../../core/secure-cache';

describe('signer type guards', () => {
  it('keeps getHdCredential parameterless', () => {
    type IGetHdCredential = SignerSoftwareBase['getHdCredential'];

    expectTypeOf<IGetHdCredential>().parameters.toEqualTypeOf<[]>();
    expectTypeOf<IGetHdCredential>().returns.toEqualTypeOf<Promise<string>>();

    function assertTypes() {
      const signer = new SignerSoftwareBase();
      // @ts-expect-error getHdCredential must not accept keyId or walletId.
      void signer.getHdCredential('keyId');
    }

    void assertTypes;
  });

  it('keeps secureCache keys scoped to walletId:keyId strings', () => {
    const key = createSecureCacheKey('wallet-1', 'key-1');
    type ISecureCacheGet = SecureCache['get'];
    type ISecureCacheSet = SecureCache['set'];

    expectTypeOf<ISecureCacheGet>().parameters.toEqualTypeOf<[typeof key]>();
    expectTypeOf<ISecureCacheSet>().parameters.toEqualTypeOf<
      [typeof key, Buffer, number?]
    >();

    function assertTypes() {
      secureCache.get(key);
      secureCache.set(key, Buffer.from('value'));

      // @ts-expect-error keyId alone is not a secure cache key.
      secureCache.get('key-1');
      // @ts-expect-error walletId alone is not a secure cache key.
      secureCache.set('wallet-1', Buffer.from('value'));
    }

    void assertTypes;
  });
});

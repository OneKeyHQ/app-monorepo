/**
 * Thin re-export bridge for the crypto primitives used in `auth.ts`. The only
 * reason this module exists is that `node:crypto` exports are non-configurable
 * — `jest.spyOn(cryptoMod, 'timingSafeEqual')` throws "Cannot redefine
 * property". Tests spy on `cryptoBridge.timingSafeEqual` instead, which
 * preserves the production code path bit-for-bit while making the spec
 * assertion ("timingSafeEqual is invoked") observable.
 */
import {
  createHash as nodeCreateHash,
  randomBytes as nodeRandomBytes,
  timingSafeEqual as nodeTimingSafeEqual,
} from 'node:crypto';

export const cryptoBridge = {
  timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) =>
    nodeTimingSafeEqual(a, b),
  createHash: (algorithm: string) => nodeCreateHash(algorithm),
  randomBytes: (size: number) => nodeRandomBytes(size),
};

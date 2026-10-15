import {
  XMR_RUNTIME_METHODS,
  XMR_RUNTIME_U64_ARGS,
  coerceXmrU64Args,
} from './methods';

import type { IXmrRuntimeApi } from '.';
import type { IXmrRuntimeMethod } from './methods';

/**
 * The method list is the contract four carriers forward through.
 *
 * A name missing from it is not a type error anywhere: the Worker client
 * simply never builds that method, and the call becomes `undefined is not a
 * function` — on one platform, at runtime, in whichever feature happened to
 * use it. These checks turn that into a compile failure instead.
 */

type IMissingFromList = Exclude<keyof IXmrRuntimeApi, IXmrRuntimeMethod>;
type IExtraInList = Exclude<IXmrRuntimeMethod, keyof IXmrRuntimeApi>;

// Both resolve to `never` when the list and the interface agree. If one does
// not, the assignment below fails to compile and names the offender.
const noMethodIsMissing: IMissingFromList extends never ? true : false = true;
const noMethodIsStale: IExtraInList extends never ? true : false = true;

describe('xmr runtime method list', () => {
  it('covers the whole API surface and nothing that left it', () => {
    expect(noMethodIsMissing).toBe(true);
    expect(noMethodIsStale).toBe(true);
  });

  it('has no duplicates, which would forward one method twice', () => {
    expect(new Set(XMR_RUNTIME_METHODS).size).toBe(XMR_RUNTIME_METHODS.length);
  });

  /**
   * The wasm package is a build artifact, not something `yarn install`
   * produces. When it is stale, every missing method fails the same way at
   * runtime; naming them here says which rebuild is owed.
   */
  it('matches what the built wasm package actually exports', () => {
    let exported: string[];
    try {
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      exported = Object.keys(require('onekey-monero-runtime') as object);
    } catch {
      // The package is only present once the runtime has been built. Skipping
      // is honest here: a missing artifact is not a contract violation.
      return;
    }
    const missing = XMR_RUNTIME_METHODS.filter(
      (method) => !exported.includes(method),
    );
    expect(missing).toEqual([]);
  });
});

/**
 * A bigint cannot cross the extension or mobile bridge (both JSON), so the
 * app speaks decimal strings and the adapter converts right before the wasm.
 * The first `addAccount` on the extension died with "Could not serialize
 * message" before this existed.
 */
describe('xmr runtime u64 coercion', () => {
  it('only names methods that exist', () => {
    const unknown = Object.keys(XMR_RUNTIME_U64_ARGS).filter(
      (method) => !(XMR_RUNTIME_METHODS as readonly string[]).includes(method),
    );
    expect(unknown).toEqual([]);
  });

  it('turns the declared positions into bigint and leaves the rest alone', () => {
    expect(
      coerceXmrU64Args('addAccount', ['uuid', 'spend', 'view', '3768162']),
    ).toEqual(['uuid', 'spend', 'view', 3_768_162n]);
    expect(coerceXmrU64Args('registerSubaddress', ['7', 0, 1])).toEqual([
      7n,
      0,
      1,
    ]);
    expect(coerceXmrU64Args('syncStep', ['7', '100'])).toEqual([7n, 100n]);
  });

  it('keeps an absent optional u64 absent', () => {
    expect(coerceXmrU64Args('balance', ['7'])).toEqual([7n]);
    expect(coerceXmrU64Args('balance', ['7', undefined])).toEqual([
      7n,
      undefined,
    ]);
  });

  it('passes methods with no u64 through untouched', () => {
    expect(coerceXmrU64Args('validateAddress', ['mainnet', '4...'])).toEqual([
      'mainnet',
      '4...',
    ]);
  });

  it('carries a full u64 without losing precision', () => {
    expect(
      coerceXmrU64Args('addAccount', ['u', 's', 'v', '18446744073709551615']),
    ).toEqual(['u', 's', 'v', 18_446_744_073_709_551_615n]);
  });

  it('refuses anything that is not a decimal string', () => {
    for (const bad of [2 ** 60, 7, '0x10', '-1', '1.5', '', 7n]) {
      expect(() =>
        coerceXmrU64Args('addAccount', ['u', 's', 'v', bad]),
      ).toThrow(TypeError);
    }
  });
});

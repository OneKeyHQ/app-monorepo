import fs from 'fs';
import path from 'path';

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

// Export names of the installed `onekey-monero-runtime` glue, or `undefined`
// when the package is not installed.
function readInstalledRuntimeExports(): string[] | undefined {
  let packageJsonPath: string;
  try {
    packageJsonPath = require.resolve('onekey-monero-runtime/package.json');
  } catch {
    return undefined;
  }
  const { main } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
    main?: string;
  };
  const glue = fs.readFileSync(
    path.join(
      path.dirname(packageJsonPath),
      main ?? 'onekey_monero_runtime.js',
    ),
    'utf8',
  );
  return [...glue.matchAll(/^export function (\w+)\(/gmu)].map(
    (match) => match[1],
  );
}

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

  // The spend key stays inside the runtime: signing and key-image import take
  // the BIP-32 key, and nothing hands a spend key across.
  it('forwards no method that returns or takes a spend key', () => {
    for (const method of [
      'spendScalar',
      'signTransaction',
      'importKeyImages',
    ]) {
      expect(XMR_RUNTIME_METHODS as readonly string[]).not.toContain(method);
    }
    expect(XMR_RUNTIME_METHODS).toEqual(
      expect.arrayContaining([
        'signTransactionWithBip32Key',
        'importKeyImagesWithBip32Key',
      ]),
    );
    expect(XMR_RUNTIME_U64_ARGS.importKeyImagesWithBip32Key).toEqual([0]);
  });

  /**
   * The wasm package is a build artifact, not something `yarn install`
   * produces. When it is stale, every missing method fails the same way at
   * runtime; naming them here says which rebuild is owed.
   *
   * Jest does not transform this ESM package, so it is read as text rather
   * than required; a require that threw used to skip the check silently.
   */
  it('matches what the installed wasm package actually exports', () => {
    const exported = readInstalledRuntimeExports();
    // Only an absent package skips: a missing artifact is not a contract
    // violation, but a present one must be checkable.
    if (!exported) return;
    expect(exported.length).toBeGreaterThan(0);
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

  it('converts the chain tip of the send calls at its current position', () => {
    expect(
      coerceXmrU64Args('prepareTransaction', [
        '7',
        '[]',
        false,
        '100',
        'normal',
      ]),
    ).toEqual([7n, '[]', false, 100n, 'normal']);
    expect(
      coerceXmrU64Args('broadcastTransaction', ['7', '00ff', '100', '5', '1']),
    ).toEqual([7n, '00ff', 100n, '5', '1']);
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

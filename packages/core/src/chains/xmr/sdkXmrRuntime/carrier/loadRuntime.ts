/**
 * Loads the Monero wasm runtime and installs it as this process's API.
 * Scanning is synchronous and CPU-bound in wasm, so every carrier must run
 * this loader inside a Worker or the main thread freezes silently.
 */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { setXmrRuntimeApiLoader } from '..';
import { setXmrRuntimeLoader } from '../address';
import { XMR_RUNTIME_METHODS, coerceXmrU64Args } from '../methods';

import type { IXmrRuntimeApi } from '..';

let cached: Promise<IXmrRuntimeApi> | undefined;

let rawModule: Record<string, unknown> | undefined;

// Set if persistent storage failed to install in this process.
let storageError: unknown;

/**
 * Wraps the synchronous wasm exports in async calls so an in-process runtime
 * and a carrier-hosted one present the same shape to every caller.
 */
function toAsyncRuntime(mod: Record<string, unknown>): IXmrRuntimeApi {
  const api: Record<string, unknown> = {};
  for (const method of XMR_RUNTIME_METHODS) {
    const fn = mod[method];
    if (typeof fn !== 'function') {
      throw new OneKeyLocalError(
        `xmr: the wasm runtime is missing "${method}"; rebuild it (scripts/build-wasm.sh) -- the package and this app are out of step`,
      );
    }
    api[method] = async (...args: unknown[]) =>
      (fn as (...a: unknown[]) => unknown)(...coerceXmrU64Args(method, args));
  }
  return api as unknown as IXmrRuntimeApi;
}

/**
 * The wasm package is a build artifact (`scripts/build-wasm.sh`), not an
 * install-time dependency - "module not found" here means it wasn't built.
 */
async function importRuntimeModule(): Promise<IXmrRuntimeApi> {
  let mod: Record<string, unknown>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    // Eager: mobile inlines the Worker entry into a Blob, so the module must
    // be bundled rather than lazy-loaded.
    mod = (await import(
      /* webpackMode: "eager" */ 'onekey-monero-runtime'
    )) as unknown as Record<string, unknown>;
  } catch (error) {
    throw new OneKeyLocalError(
      [
        'xmr: the wasm runtime package is not available.',
        'It is a build artifact, not an install-time dependency:',
        'run chain-runtimes/monero/scripts/build-wasm.sh and make sure',
        'packages/core/package.json portals to its pkg/ directory.',
        `原始错误: ${error instanceof Error ? error.message : String(error)}`,
      ].join(' '),
    );
  }

  const init = mod.default as undefined | (() => Promise<unknown>);
  if (typeof init === 'function') {
    // wasm-bindgen's default export fetches and instantiates the module.
    await init();
  }

  // Keep the raw module: the host-network seam takes a function argument,
  // which cannot cross a Worker boundary via the typed async wrapper.
  rawModule = mod;
  const api = toAsyncRuntime(mod);
  // Install persistent storage once up front (avoids a race between
  // callers). Not fatal if it fails: OPFS sync-access handles are
  // Worker-only, so main-thread calls (e.g. address derivation) don't need it.
  try {
    await api.init();
    storageError = undefined;
  } catch (error) {
    storageError = error;
  }
  // Retry storage init here: a stale Worker releasing its handles is
  // transient and clears by the next call, unlike a cached process-wide failure.
  const { openWallet } = api;
  api.openWallet = async (...args) => {
    if (storageError !== undefined) {
      try {
        await api.init();
        storageError = undefined;
      } catch (error) {
        storageError = error;
        throw new OneKeyLocalError(
          `xmr: persistent storage is unavailable in this process, so no wallet can be opened. ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return openWallet(...args);
  };
  return api;
}

/**
 * Cache the promise, not the resolved value, so concurrent callers share one
 * instantiation - opening the OPFS pool twice looks like storage corruption.
 */
export async function loadXmrRuntime(): Promise<IXmrRuntimeApi> {
  if (!cached) {
    cached = importRuntimeModule().catch((error) => {
      // Do not cache a failure: a transient load error should not disable
      // the chain for the rest of the session.
      cached = undefined;
      throw error;
    });
  }
  return cached;
}

/**
 * Installs the host's network channel directly on the module (not part of
 * `IXmrRuntimeApi`) because a function argument cannot cross `postMessage`.
 */
export async function installXmrHostRequester(
  requester: (
    url: string,
    contentType: string,
    body: Uint8Array,
  ) => Promise<Uint8Array>,
): Promise<void> {
  await loadXmrRuntime();
  const install = rawModule?.setRequestHandler as
    | ((fn: unknown) => void)
    | undefined;
  // Older artifacts lack this hook; the runtime falls back to its own fetch.
  install?.(requester);
}

/** Called once per carrier at startup; both entry points share one module. */
export function installXmrRuntime() {
  setXmrRuntimeApiLoader(loadXmrRuntime);
  setXmrRuntimeLoader(async () => {
    const api = await loadXmrRuntime();
    return {
      deriveAccount: api.deriveAccount,
      deriveSubaddress: api.deriveSubaddress,
      validateAddress: api.validateAddress,
      spendScalar: api.spendScalar,
      signTransaction: api.signTransaction,
      verifyTransaction: api.verifyTransaction,
    };
  });
}

/** Loads the Monero wasm runtime as this process's API. Scanning is CPU-bound, so run it inside a Worker. */

import { runPrivacyChainWorkerOperation } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { setXmrRuntimeApiLoader } from '..';
import { setXmrRuntimeLoader } from '../address';
import { XMR_RUNTIME_METHODS, coerceXmrU64Args } from '../methods';

import type { IXmrRuntimeApi } from '..';

let cached: Promise<IXmrRuntimeApi> | undefined;

type IXmrRuntimeModule = typeof import('onekey-monero-runtime');

let rawModule: IXmrRuntimeModule | undefined;

// Set if persistent storage failed to install in this process.
let storageError: unknown;

function toAsyncRuntime(mod: Record<string, unknown>): IXmrRuntimeApi {
  const api: Record<string, unknown> = {};
  for (const method of XMR_RUNTIME_METHODS) {
    const fn = mod[method];
    if (typeof fn !== 'function') {
      throw new OneKeyLocalError(
        `xmr: onekey-monero-runtime is missing "${method}"; the installed package is older than this app expects`,
      );
    }
    api[method] = (...args: unknown[]) =>
      runPrivacyChainWorkerOperation(() =>
        (fn as (...a: unknown[]) => unknown)(...coerceXmrU64Args(method, args)),
      );
  }
  return api as unknown as IXmrRuntimeApi;
}

async function importRuntimeModule(): Promise<IXmrRuntimeApi> {
  let mod: Record<string, unknown>;
  try {
    // Eager: mobile inlines the Worker entry into a Blob.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    mod = (await import(
      /* webpackMode: "eager" */ 'onekey-monero-runtime'
    )) as unknown as Record<string, unknown>;
  } catch (error) {
    throw new OneKeyLocalError(
      `xmr: the onekey-monero-runtime package is not available: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const init = mod.default as undefined | (() => Promise<unknown>);
  if (typeof init === 'function') {
    await init();
  }

  // Keep the raw module: the host-network seam takes a function argument,
  // which cannot cross a Worker boundary via the typed async wrapper.
  rawModule = mod as unknown as IXmrRuntimeModule;
  const api = toAsyncRuntime(mod);
  // Install storage once up front to avoid a race; not fatal, since OPFS handles are Worker-only.
  try {
    await api.init();
    storageError = undefined;
  } catch (error) {
    if (error instanceof WebAssembly.RuntimeError) throw error;
    storageError = error;
  }
  // A stale Worker still releasing its handles is transient, so retry here.
  const { openWallet } = api;
  api.openWallet = async (...args) => {
    if (storageError !== undefined) {
      try {
        await api.init();
        storageError = undefined;
      } catch (error) {
        if (error instanceof WebAssembly.RuntimeError) throw error;
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

/** Caches the promise: opening the OPFS pool twice looks like storage corruption. */
export async function loadXmrRuntime(): Promise<IXmrRuntimeApi> {
  if (!cached) {
    cached = importRuntimeModule().catch((error) => {
      // A transient load error must not disable the chain for the session.
      cached = undefined;
      throw error;
    });
  }
  return cached;
}

/** Installed directly on the module: a function argument cannot cross `postMessage`. */
export async function installXmrHostRequester(
  requester: (
    url: string,
    contentType: string,
    body: Uint8Array,
  ) => Promise<Uint8Array>,
): Promise<void> {
  await loadXmrRuntime();
  rawModule?.setRequestHandler(requester);
}

export function xmrStorageRequiresWorkerRestart(): boolean {
  return rawModule?.storageRequiresWorkerRestart() ?? false;
}

export function installXmrRuntime() {
  setXmrRuntimeApiLoader(loadXmrRuntime);
  setXmrRuntimeLoader(async () => {
    const api = await loadXmrRuntime();
    return {
      deriveAccount: api.deriveAccount,
      deriveSubaddress: api.deriveSubaddress,
      validateAddress: api.validateAddress,
      signTransactionWithBip32Key: api.signTransactionWithBip32Key,
      verifyTransaction: api.verifyTransaction,
    };
  });
}

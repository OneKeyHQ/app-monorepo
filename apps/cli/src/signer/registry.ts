/**
 * Chain signer registry — mirrors kit-bg's vault factory pattern
 * (packages/kit-bg/src/vaults/factory.ts → vaultsLoader + Vault.keyringMap).
 *
 * Two layers, both extensible without touching factory.ts:
 *
 *   Outer (SIGNER_LOADERS): impl string → lazy loader of the chain module.
 *   Adding a new chain is one new `impls/<chain>/index.ts` exporting
 *   `<chain>SignerRegistration` plus one line here.
 *
 *   Inner (signerBuilders): AuthWalletKind → builder function. Mirrors
 *   kit-bg's `keyringMap: Record<IDBWalletType, KeyringClass>` on each
 *   Vault. Adding a wallet kind (e.g. watching / imported) is a new key
 *   on `ISignerBuilders` — no changes to the outer interface or factory.
 *
 * The outer loaders are `() => import(...)` thunks so esbuild only
 * bundles a chain's code when the CLI actually asks for it. That keeps
 * cold-start fast and lets unsupported chains stay out of the CJS graph.
 */

import { AppError, ERROR_CODES } from '../errors';

import type { ISigner } from './types';
import type { DeviceInfo, PassphraseMode } from '../core/auth/auth-types';

/**
 * Per-wallet-kind signer builders. The signature varies by kind because
 * different wallet types carry different context (HD needs nothing; a
 * hardware wallet needs the device handle + passphrase mode; a future
 * `watching` kind would take an address; `imported` would take a pk).
 *
 * Every chain populates the builders it actually supports; missing kinds
 * surface as a structured `AUTH_SESSION_INVALID` error at dispatch time.
 */
export interface ISignerBuilders {
  hd?: () => Promise<ISigner>;
  hardware?: (
    device: DeviceInfo,
    passphraseMode: PassphraseMode,
  ) => Promise<ISigner>;
}

export interface IChainSignerRegistration {
  impl: string;
  signerBuilders: ISignerBuilders;
}

type IChainSignerLoader = () => Promise<IChainSignerRegistration>;

const SIGNER_LOADERS: Record<string, IChainSignerLoader> = {
  evm: () => import('./impls/evm').then((m) => m.evmSignerRegistration),
};

export async function resolveSignerRegistration(
  impl: string,
): Promise<IChainSignerRegistration> {
  const loader = SIGNER_LOADERS[impl];
  if (!loader) {
    const supported = Object.keys(SIGNER_LOADERS).join(', ');
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported chain impl: ${impl}`,
      `Supported: ${supported}`,
    );
  }
  return loader();
}

/**
 * Select a builder for the given wallet kind. Throws a structured error
 * when the chain doesn't register a builder for that kind — callers then
 * get a clear "this chain does not support <kind> wallets" signal
 * instead of a cryptic `undefined is not a function` at the call site.
 */
export function requireSignerBuilder<K extends keyof ISignerBuilders>(
  registration: IChainSignerRegistration,
  kind: K,
): NonNullable<ISignerBuilders[K]> {
  const builder = registration.signerBuilders[kind];
  if (!builder) {
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      `Chain ${registration.impl} does not support ${String(kind)} wallets.`,
      `Log out and log in with a supported wallet type.`,
    );
  }
  return builder as NonNullable<ISignerBuilders[K]>;
}

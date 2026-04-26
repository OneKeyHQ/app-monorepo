/**
 * Signer registry — per-impl lazy loader of wallet-kind → builder maps.
 * Mirrors kit-bg's `vaultsLoader` + `Vault.keyringMap`.
 *
 * Builder keys (`hd`, `hw`, …) use the same string literals as
 * `@onekeyhq/shared/src/consts/dbConsts` (`WALLET_TYPE_HD`,
 * `WALLET_TYPE_HW`), so `builders[WALLET_TYPE_HW]` resolves identically
 * whether the caller spells the key out or uses the const.
 *
 * `impl` lives only in `builderLoaders`' map key — it's the single
 * source of truth. Per-chain builder files do NOT carry an `impl`
 * field to keep them from drifting.
 */

import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError, ERROR_CODES } from '../errors';

import type { ISigner } from './types';
import type { DeviceInfo, PassphraseMode } from '../core/auth/auth-types';

export interface ISignerBuilders {
  hd?: () => Promise<ISigner>;
  hw?: (device: DeviceInfo, passphraseMode: PassphraseMode) => Promise<ISigner>;
}

type ISignerBuildersLoader = () => Promise<ISignerBuilders>;

const builderLoaders: Record<string, ISignerBuildersLoader> = {
  [IMPL_EVM]: () => import('./impls/evm').then((m) => m.evmSignerBuilders),
};

export async function loadSignerBuilders(
  impl: string,
): Promise<ISignerBuilders> {
  const loader = builderLoaders[impl];
  if (!loader) {
    const supported = Object.keys(builderLoaders).join(', ');
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported chain impl: ${impl}`,
      `Supported: ${supported}`,
    );
  }
  return loader();
}

/** Select a builder or throw a clear "chain X does not support <kind>" error. */
export function requireSignerBuilder<K extends keyof ISignerBuilders>(
  impl: string,
  builders: ISignerBuilders,
  kind: K,
): NonNullable<ISignerBuilders[K]> {
  const builder = builders[kind];
  if (!builder) {
    throw new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      `Chain ${impl} does not support ${String(kind)} wallets.`,
      `Log out and log in with a supported wallet type.`,
    );
  }
  return builder;
}

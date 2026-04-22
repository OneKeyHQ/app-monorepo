/**
 * Signer registry — per-impl lazy loader + per-wallet-kind builder map.
 * Mirrors kit-bg's `vaultsLoader` + `Vault.keyringMap`.
 *
 * Builder keys (`hd`, `hw`, …) use the same string literals as
 * `@onekeyhq/shared/src/consts/dbConsts` (`WALLET_TYPE_HD`,
 * `WALLET_TYPE_HW`), so `signerBuilders[WALLET_TYPE_HW]` resolves
 * identically whether the caller spells the key out or uses the const.
 */

import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError, ERROR_CODES } from '../errors';

import type { ISigner } from './types';
import type { DeviceInfo, PassphraseMode } from '../core/auth/auth-types';

export interface ISignerBuilders {
  hd?: () => Promise<ISigner>;
  hw?: (device: DeviceInfo, passphraseMode: PassphraseMode) => Promise<ISigner>;
}

export interface ISignerRegistration {
  impl: string;
  signerBuilders: ISignerBuilders;
}

type ISignerLoader = () => Promise<ISignerRegistration>;

const signerLoaders: Record<string, ISignerLoader> = {
  [IMPL_EVM]: () => import('./impls/evm').then((m) => m.evmSignerRegistration),
};

export async function resolveSignerRegistration(
  impl: string,
): Promise<ISignerRegistration> {
  const loader = signerLoaders[impl];
  if (!loader) {
    const supported = Object.keys(signerLoaders).join(', ');
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
  registration: ISignerRegistration,
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

import {
  COINTYPE_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { listSolChains } from '../../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../../errors';

/**
 * Shared SOL signer helpers — used by both SignerHd and SignerHardware so
 * the two signing paths stay consistent on path derivation and network
 * validation.
 *
 * SOL has only one supported derivation template in OneKey's app:
 *   m/44'/501'/<index>'/0'
 * (Phantom / Sollet / OneKey default — see kit-bg sol/settings.ts.)
 *
 * Ledger Live's alternate template `m/44'/501'/<index>'` is NOT exposed by
 * the CLI by design.
 */

export const SOL_PATH_TEMPLATE = `m/44'/${COINTYPE_SOL}'/${INDEX_PLACEHOLDER}'/0'`;

/** Resolve the BIP-44 SOL path for a given account index. */
export function resolveSolPath(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `Invalid SOL account index: ${index}`,
      'Account index must be a non-negative integer.',
    );
  }
  return SOL_PATH_TEMPLATE.replace(INDEX_PLACEHOLDER, String(index));
}

/** Reject networkIds the CLI doesn't have a chain config for. */
export function validateSolNetworkId(networkId: string): void {
  const solChains = listSolChains();
  const chainConfig = solChains.find((c) => c.networkId === networkId);
  if (!chainConfig) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported SOL networkId: ${networkId}`,
      `Supported: ${solChains.map((c) => c.networkId).join(', ')}`,
    );
  }
}

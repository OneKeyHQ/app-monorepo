import {
  COINTYPE_SOL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { listSolChains } from '../../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../../errors';

// Phantom / Sollet / OneKey default template. Ledger Live's `m/44'/501'/<index>'`
// is intentionally not exposed by the CLI.
export const SOL_PATH_TEMPLATE = `m/44'/${COINTYPE_SOL}'/${INDEX_PLACEHOLDER}'/0'`;

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

import { listEvmChains } from '../../../core/chain-resolver';
import { AppError, ERROR_CODES } from '../../../errors';

/**
 * Shared EVM signer helpers — used by both SignerHd and SignerHardware so
 * the two signing paths stay consistent on path derivation and network
 * validation.
 */

export const EVM_PATH_TEMPLATE = "m/44'/60'/0'/0/$$INDEX$$";

/** Resolve the BIP-44 EVM path for a given account index. */
export function resolveEvmPath(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      `Invalid EVM account index: ${index}`,
      'Account index must be a non-negative integer.',
    );
  }
  return EVM_PATH_TEMPLATE.replace('$$INDEX$$', String(index));
}

/** Reject networkIds the CLI doesn't have a chain config for. */
export function validateEvmNetworkId(networkId: string): void {
  const evmChains = listEvmChains();
  const chainConfig = evmChains.find((c) => c.networkId === networkId);
  if (!chainConfig) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported EVM networkId: ${networkId}`,
      `Supported: ${evmChains.map((c) => c.networkId).join(', ')}`,
    );
  }
}

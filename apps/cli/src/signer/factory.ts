import { AppError, ERROR_CODES } from '../errors';

import type { ISigner } from './types';

export async function getSignerByImpl(impl: string): Promise<ISigner> {
  switch (impl) {
    case 'evm': {
      const { EvmSigner } = await import('./impls/evm/EvmSigner');
      return new EvmSigner();
    }
    default:
      throw new AppError(
        ERROR_CODES.PARAM_INVALID_CHAIN.code,
        `Unsupported chain impl: ${impl}`,
        'Currently only EVM chains are supported',
      );
  }
}

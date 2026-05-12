import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError, ERROR_CODES } from '../errors';

import type { IChainConfig } from './chain-resolver';

export interface IAddressValidationResult {
  isValid: boolean;
  normalizedAddress: string;
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function validateAddressForChain(
  chainConfig: IChainConfig,
  address: string,
): IAddressValidationResult {
  if (chainConfig.impl === IMPL_EVM) {
    const isValid = EVM_ADDRESS_RE.test(address);
    return {
      isValid,
      normalizedAddress: isValid ? address : '',
    };
  }

  if (chainConfig.impl === IMPL_BTC || chainConfig.impl === IMPL_TBTC) {
    try {
      const validation = validateBtcAddress({
        address,
        network: getBtcForkNetwork(chainConfig.impl),
      });
      return {
        isValid: validation.isValid,
        normalizedAddress: validation.normalizedAddress || address,
      };
    } catch {
      return {
        isValid: false,
        normalizedAddress: '',
      };
    }
  }

  return {
    isValid: false,
    normalizedAddress: '',
  };
}

export function assertAddressForChain(
  chainConfig: IChainConfig,
  address: string,
): string {
  const validation = validateAddressForChain(chainConfig, address);
  if (validation.isValid) {
    return validation.normalizedAddress || address;
  }

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_ADDRESS.code,
    `Invalid address for ${chainConfig.networkId}: ${address}`,
    `Provide a valid ${chainConfig.nativeSymbol} address for ${chainConfig.networkId}.`,
  );
}

export function sameAddress(
  chainConfig: IChainConfig,
  left: string,
  right: string,
): boolean {
  if (chainConfig.impl === IMPL_EVM) {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

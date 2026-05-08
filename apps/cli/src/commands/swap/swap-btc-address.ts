import {
  BTC_ADDRESS_TYPES,
  getBtcAddressTypeInfo,
  isBtcImpl,
} from '../../core/btc/address-types';
import { AppError, ERROR_CODES } from '../../errors';
import { getSignerByImpl } from '../../signer';

import type {
  BtcAddressType,
  IBtcAddressTypeInfo,
} from '../../core/btc/address-types';
import type { IChainConfig } from '../../core/chain-resolver';

export type IBtcSwapAddressMetadata = Pick<
  IBtcAddressTypeInfo,
  'addressType' | 'addressEncoding' | 'deriveType'
> & {
  address: string;
  path: string;
};

export interface IBtcSwapAddressing {
  from: IBtcSwapAddressMetadata | null;
  to: IBtcSwapAddressMetadata | null;
}

export function emptyBtcSwapAddressing(): IBtcSwapAddressing {
  return {
    from: null,
    to: null,
  };
}

export function hasBtcSwapAddressing(
  btcAddressing: IBtcSwapAddressing,
): boolean {
  return Boolean(btcAddressing.from || btcAddressing.to);
}

export function isBtcSwapChain(chainConfig: IChainConfig): boolean {
  return isBtcImpl(chainConfig.impl);
}

export function requireBtcSwapAddressType(
  flagName: '--from-address-type' | '--to-address-type',
  addressType: BtcAddressType | undefined,
): BtcAddressType {
  if (addressType) return addressType;

  throw new AppError(
    ERROR_CODES.PARAM_MISSING_REQUIRED.code,
    `Missing required option ${flagName} for BTC swap.`,
    `Use ${flagName} ${BTC_ADDRESS_TYPES.join('|')}.`,
  );
}

export async function getBtcSwapAddressMetadata(
  chainConfig: IChainConfig,
  addressType: BtcAddressType,
): Promise<IBtcSwapAddressMetadata> {
  const info = getBtcAddressTypeInfo(chainConfig.impl, addressType);
  const signer = await getSignerByImpl(chainConfig.impl);
  const addressInfo = await signer.getAddress(chainConfig.networkId, {
    addressType: info.addressType,
  });

  return {
    addressType: info.addressType,
    addressEncoding: info.addressEncoding,
    deriveType: info.deriveType,
    address: addressInfo.address,
    path: info.path,
  };
}

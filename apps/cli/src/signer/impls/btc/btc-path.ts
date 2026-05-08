import type {
  IMPL_BTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';

import { getBtcAddressTypeInfo } from '../../../core/btc/address-types';
import { AppError, ERROR_CODES } from '../../../errors';

import type {
  BtcAddressType,
  IBtcAddressTypeInfo,
} from '../../../core/btc/address-types';

export type IBtcSignerImpl = typeof IMPL_BTC | typeof IMPL_TBTC;

export function validateBtcNetworkId(
  impl: IBtcSignerImpl,
  networkId: string,
): void {
  const expectedNetworkId = `${impl}--0`;
  if (networkId === expectedNetworkId) return;

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CHAIN.code,
    `Unsupported ${impl.toUpperCase()} networkId: ${networkId}`,
    `Use networkId ${expectedNetworkId}.`,
  );
}

export function resolveBtcAddressTypeInfo(
  impl: IBtcSignerImpl,
  addressType: BtcAddressType | undefined,
): IBtcAddressTypeInfo {
  if (!addressType) {
    throw new AppError(
      ERROR_CODES.PARAM_MISSING_REQUIRED.code,
      'BTC getAddress requires addressType.',
      'Choose one of: taproot, native-segwit, nested-segwit, legacy.',
    );
  }

  return getBtcAddressTypeInfo(impl, addressType);
}

export function buildBtcHdTemplate(info: IBtcAddressTypeInfo): string {
  return `m/${info.purpose}'/${info.coinType}'/${INDEX_PLACEHOLDER}'/${info.relPath}`;
}

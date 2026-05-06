import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import {
  IMPL_BTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError, ERROR_CODES } from '../../errors';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export const BTC_ADDRESS_TYPES = [
  'taproot',
  'native-segwit',
  'nested-segwit',
  'legacy',
] as const;

export type BtcAddressType = (typeof BTC_ADDRESS_TYPES)[number];

export interface IBtcAddressTypeInfo {
  addressType: BtcAddressType;
  label: string;
  deriveType: IAccountDeriveTypes;
  addressEncoding: EAddressEncodings;
  purpose: number;
  coinType: number;
  path: string;
  accountPath: string;
  relPath: string;
}

const BTC_IMPLS = [IMPL_BTC, IMPL_TBTC] as const;

const BTC_ADDRESS_TYPE_META: Record<
  BtcAddressType,
  Omit<IBtcAddressTypeInfo, 'coinType' | 'path' | 'accountPath' | 'relPath'>
> = {
  taproot: {
    addressType: 'taproot',
    label: 'Taproot',
    deriveType: 'BIP86',
    addressEncoding: EAddressEncodings.P2TR,
    purpose: 86,
  },
  'native-segwit': {
    addressType: 'native-segwit',
    label: 'Native SegWit',
    deriveType: 'BIP84',
    addressEncoding: EAddressEncodings.P2WPKH,
    purpose: 84,
  },
  'nested-segwit': {
    addressType: 'nested-segwit',
    label: 'Nested SegWit',
    deriveType: 'default',
    addressEncoding: EAddressEncodings.P2SH_P2WPKH,
    purpose: 49,
  },
  legacy: {
    addressType: 'legacy',
    label: 'Legacy',
    deriveType: 'BIP44',
    addressEncoding: EAddressEncodings.P2PKH,
    purpose: 44,
  },
};

function getSupportedAddressTypesText(): string {
  return BTC_ADDRESS_TYPES.join(', ');
}

export function isBtcImpl(impl: string): boolean {
  return BTC_IMPLS.includes(impl as (typeof BTC_IMPLS)[number]);
}

export function assertBtcImpl(
  impl: string,
): asserts impl is (typeof BTC_IMPLS)[number] {
  if (isBtcImpl(impl)) return;

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CHAIN.code,
    `Unsupported BTC chain: "${impl}".`,
    'Choose btc or tbtc.',
  );
}

export function isBtcAddressType(value: unknown): value is BtcAddressType {
  return (
    typeof value === 'string' &&
    BTC_ADDRESS_TYPES.includes(value as BtcAddressType)
  );
}

export function assertBtcAddressType(
  value: unknown,
): asserts value is BtcAddressType {
  if (isBtcAddressType(value)) return;

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_ADDRESS.code,
    `Invalid BTC address type: "${String(
      value,
    )}". Supported values: ${getSupportedAddressTypesText()}.`,
    'Choose a supported BTC address type.',
  );
}

export function getBtcCoinType(impl: string): number {
  assertBtcImpl(impl);
  return impl === IMPL_TBTC ? 1 : 0;
}

export function getBtcAddressTypeInfo(
  impl: string,
  addressTypeInput: unknown,
): IBtcAddressTypeInfo {
  const coinType = getBtcCoinType(impl);
  assertBtcAddressType(addressTypeInput);

  const meta = BTC_ADDRESS_TYPE_META[addressTypeInput];
  const accountPath = `m/${meta.purpose}'/${coinType}'/0'`;

  return {
    ...meta,
    coinType,
    accountPath,
    relPath: '0/0',
    path: `${accountPath}/0/0`,
  };
}

export function listBtcAddressTypeInfos(
  impl: string,
): IBtcAddressTypeInfo[] {
  return BTC_ADDRESS_TYPES.map((addressType) =>
    getBtcAddressTypeInfo(impl, addressType),
  );
}

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { AppError, ERROR_CODES } from '../../errors';

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
    )}". Supported values: ${BTC_ADDRESS_TYPES.join(', ')}.`,
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

export function listBtcAddressTypeInfos(impl: string): IBtcAddressTypeInfo[] {
  return BTC_ADDRESS_TYPES.map((addressType) =>
    getBtcAddressTypeInfo(impl, addressType),
  );
}

// Provider/build-tx responses use varying casing/synonyms for BTC address
// types (e.g. "p2wpkh"/"P2WPKH", "p2sh-p2wpkh"/"P2SH_P2WPKH"). Map any
// recognized form to the canonical EAddressEncodings value so that downstream
// equality/inclusion checks against `fromAddressMeta.addressEncoding` don't
// falsely reject a valid PSBT.
export function normalizeBtcAddressEncoding(
  value: unknown,
): EAddressEncodings | undefined {
  if (typeof value !== 'string') return undefined;
  const canonical = value.replace(/[-\s]/g, '_').toUpperCase();
  const all = Object.values(EAddressEncodings) as string[];
  return all.includes(canonical) ? (canonical as EAddressEncodings) : undefined;
}

export function btcAddressEncodingsInclude(
  candidates: unknown[],
  target: unknown,
): boolean {
  const normalizedTarget = normalizeBtcAddressEncoding(target);
  if (!normalizedTarget) return false;
  return candidates.some(
    (candidate) => normalizeBtcAddressEncoding(candidate) === normalizedTarget,
  );
}

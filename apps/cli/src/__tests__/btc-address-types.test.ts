import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';

import { ERROR_CODES } from '../errors';
import { btcAddressType } from '../schemas/common';
import {
  BTC_ADDRESS_TYPES,
  assertBtcAddressType,
  assertBtcImpl,
  getBtcAddressTypeInfo,
  getBtcCoinType,
  isBtcAddressType,
  isBtcImpl,
  listBtcAddressTypeInfos,
} from '../core/btc/address-types';

describe('btc address types', () => {
  it('exposes canonical address types in user-facing order', () => {
    expect(BTC_ADDRESS_TYPES).toEqual([
      'taproot',
      'native-segwit',
      'nested-segwit',
      'legacy',
    ]);
    expect(
      listBtcAddressTypeInfos(IMPL_BTC).map((info) => info.addressType),
    ).toEqual(BTC_ADDRESS_TYPES);
  });

  it('maps btc address types to app-compatible derive metadata', () => {
    expect(listBtcAddressTypeInfos(IMPL_BTC)).toEqual([
      {
        addressType: 'taproot',
        label: 'Taproot',
        deriveType: 'BIP86',
        addressEncoding: 'P2TR',
        purpose: 86,
        coinType: 0,
        path: "m/86'/0'/0'/0/0",
        accountPath: "m/86'/0'/0'",
        relPath: '0/0',
      },
      {
        addressType: 'native-segwit',
        label: 'Native SegWit',
        deriveType: 'BIP84',
        addressEncoding: 'P2WPKH',
        purpose: 84,
        coinType: 0,
        path: "m/84'/0'/0'/0/0",
        accountPath: "m/84'/0'/0'",
        relPath: '0/0',
      },
      {
        addressType: 'nested-segwit',
        label: 'Nested SegWit',
        deriveType: 'default',
        addressEncoding: 'P2SH_P2WPKH',
        purpose: 49,
        coinType: 0,
        path: "m/49'/0'/0'/0/0",
        accountPath: "m/49'/0'/0'",
        relPath: '0/0',
      },
      {
        addressType: 'legacy',
        label: 'Legacy',
        deriveType: 'BIP44',
        addressEncoding: 'P2PKH',
        purpose: 44,
        coinType: 0,
        path: "m/44'/0'/0'/0/0",
        accountPath: "m/44'/0'/0'",
        relPath: '0/0',
      },
    ]);
  });

  it('maps tbtc address types with testnet coin type', () => {
    expect(getBtcCoinType(IMPL_TBTC)).toBe(1);
    expect(getBtcAddressTypeInfo(IMPL_TBTC, 'taproot')).toMatchObject({
      addressType: 'taproot',
      deriveType: 'BIP86',
      addressEncoding: 'P2TR',
      coinType: 1,
      path: "m/86'/1'/0'/0/0",
      accountPath: "m/86'/1'/0'",
      relPath: '0/0',
    });
  });

  it('validates btc impls and address types', () => {
    expect(isBtcImpl(IMPL_BTC)).toBe(true);
    expect(isBtcImpl(IMPL_TBTC)).toBe(true);
    expect(isBtcImpl('evm')).toBe(false);
    expect(isBtcAddressType('native-segwit')).toBe(true);
    expect(isBtcAddressType('segwit')).toBe(false);
    expect(() => assertBtcImpl('evm')).toThrow(/Unsupported BTC chain/);
    expect(() => assertBtcAddressType('segwit')).toThrow(
      /Invalid BTC address type/,
    );
  });

  it('throws AppError for invalid address type with supported values', () => {
    try {
      getBtcAddressTypeInfo(IMPL_BTC, 'segwit');
      throw new Error('expected invalid address type');
    } catch (error) {
      expect(error).toMatchObject({
        code: ERROR_CODES.PARAM_INVALID_ADDRESS.code,
      });
      expect((error as Error).message).toContain('Invalid BTC address type');
      expect((error as Error).message).toContain('taproot');
      expect((error as Error).message).toContain('native-segwit');
      expect((error as Error).message).toContain('nested-segwit');
      expect((error as Error).message).toContain('legacy');
    }
  });

  it('exports a reusable zod schema for btc address types', () => {
    expect(btcAddressType.parse('legacy')).toBe('legacy');
    expect(() => btcAddressType.parse('segwit')).toThrow();
  });
});

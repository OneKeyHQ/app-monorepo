import { BIP32Factory } from 'bip32';
import * as BitcoinJS from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';

import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { Tx } from '../../../impl/btc/inscribe/sdk';
import ecc from '../provider/nobleSecp256k1Wrapper';
import { AddressEncodings } from '../types';

import type { DBUTXOAccount } from '../../../../types/account';
import type { Networks } from '@cmdcode/tapscript';
import type { BIP32API } from 'bip32/types/bip32';
import type { TinySecp256k1Interface } from 'bitcoinjs-lib/src/types';
import type { ECPairAPI } from 'ecpair/src/ecpair';

export * from './tapRootAccountUtils';
export * from './coinSelectUtils';

type IAccountDefault = {
  namePrefix: string;
  addressEncoding: AddressEncodings;
};

export function getAccountDefaultByPurpose(
  purpose: number,
  impl: string,
): IAccountDefault {
  const coinName = impl ? impl.toUpperCase() : '';
  switch (purpose) {
    case 44:
      return {
        namePrefix: `${coinName} Legacy`,
        addressEncoding: AddressEncodings.P2PKH,
      };
    case 49:
      return {
        namePrefix: `${coinName} Nested SegWit`,
        addressEncoding: AddressEncodings.P2SH_P2WPKH,
      };
    case 84:
      return {
        namePrefix: `${coinName} Native SegWit`,
        addressEncoding: AddressEncodings.P2WPKH,
      };
    case 86:
      return {
        namePrefix: `${coinName} Taproot`,
        addressEncoding: AddressEncodings.P2TR,
      };
    default:
      throw new NotImplemented(`Unsupported purpose ${purpose}.`);
  }
}

export function getBIP44Path(account: DBUTXOAccount, address: string) {
  let realPath = '';
  for (const [key, value] of Object.entries(account.addresses)) {
    if (value === address) {
      realPath = key;
      break;
    }
  }
  return `${account.path}/${realPath}`;
}

export const isTaprootPath = (pathPrefix: string) =>
  pathPrefix.startsWith(`m/86'/`);

export function isWatchAccountTaprootSegwit(xpubSegwit: string) {
  const reg = /^tr\((.*)\)$/;
  const match = reg.exec(xpubSegwit);
  if (match && match[1]) {
    return true;
  }
  return false;
}

export function isTaprootXpubSegwit(xpubSegwit: string) {
  const reg = /tr\(\[(.*)\](.*)\/<0;1>\/\*\)/;
  const match = reg.exec(xpubSegwit);
  if (match && match[2]) {
    return true;
  }
  return false;
}

export function getTaprootXpub(xpubSegwit: string) {
  const reg = /tr\(\[(.*)\](.*)\/<0;1>\/\*\)/;
  const match = reg.exec(xpubSegwit);
  if (match && match[2]) {
    return match[2];
  }
  return xpubSegwit;
}

// eslint-disable-next-line  @typescript-eslint/no-unused-vars
export function decodeBtcRawTx(rawTx: string, network?: Networks) {
  const tx2 = BitcoinJS.Transaction.fromHex(rawTx);
  const txid = tx2.getId();
  const tx = Tx.decode(rawTx);
  return { tx, txid };
}

let bip32: BIP32API | undefined;
let ECPair: ECPairAPI | undefined;
let isEccInit = false;

export function initBitcoinEcc() {
  if (!isEccInit) {
    BitcoinJS.initEccLib(ecc as unknown as TinySecp256k1Interface);
    isEccInit = true;
  }
}

export function getBitcoinBip32() {
  if (!bip32) {
    initBitcoinEcc();
    // @ts-expect-error
    bip32 = BIP32Factory(ecc);
  }
  return bip32;
}
export function getBitcoinECPair() {
  if (!ECPair) {
    initBitcoinEcc();
    // @ts-expect-error
    ECPair = ECPairFactory(ecc);
  }
  return ECPair;
}
